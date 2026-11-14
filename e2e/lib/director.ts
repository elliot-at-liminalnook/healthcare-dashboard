/**
 * Helpers for specs that double as product demos.
 *
 * A demo spec is an ordinary Playwright test with real assertions, driven at a
 * human pace: the mouse glides, typing has rhythm, and captions say what is
 * happening. Every painted frame is captured losslessly over the Chrome
 * DevTools Protocol; `record.sh` turns the frames into a GIF.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test as base, type CDPSession, type Locator, type Page } from '@playwright/test'

const FRAMES_ROOT = process.env.FRAMES_DIR ?? path.resolve('frames')
const OVERLAY = readFileSync(path.join(import.meta.dirname, 'overlay.js'), 'utf8')

/** Space kept clear at the bottom of the screen for the subtitle bar. */
const CAPTION_BAR_HEIGHT = 80

interface TitleCard {
  kicker: string
  title: string
  subtitle: string
}

export class Director {
  private cdp: CDPSession | undefined
  private frames: { file: string; at: number }[] = []
  private pending: Promise<void>[] = []
  private pointer = { x: 600, y: 420 }
  /** When the caption on screen has been up long enough to read. */
  private captionVisibleUntil = 0
  private readonly dir: string

  constructor(
    private readonly page: Page,
    name: string,
  ) {
    this.dir = path.join(FRAMES_ROOT, name)
  }

  /** Open the app behind a title card and start recording. */
  async open(url: string, card: TitleCard): Promise<void> {
    mkdirSync(this.dir, { recursive: true })
    await this.page.addInitScript(`window.__DEMO__ = ${JSON.stringify(card)}`)
    await this.page.addInitScript(OVERLAY)
    await this.page.goto(url)
    await this.page.waitForLoadState('networkidle')

    this.cdp = await this.page.context().newCDPSession(this.page)
    this.cdp.on('Page.screencastFrame', (frame) => {
      const file = `frame-${String(this.frames.length).padStart(5, '0')}.png`
      this.frames.push({ file, at: performance.now() })
      writeFileSync(path.join(this.dir, file), Buffer.from(frame.data, 'base64'))
      this.pending.push(
        this.cdp!.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {}),
      )
    })
    await this.cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
    // Frames are only sent when something repaints, so nudge the title card to
    // get a first frame; otherwise the recording would start at its fade-out.
    await this.page.evaluate(() => {
      const kicker = document.querySelector<HTMLElement>('.demo-title .kicker')
      if (kicker) kicker.style.opacity = '0.82'
    })

    await this.beat(1900)
    await this.page.evaluate(() => (window as any).__demoHideTitle?.())
    // Later page loads, on this site or another, should not show the title again.
    await this.page.addInitScript('window.__DEMO__ = {}')
    await this.beat(900)
  }

  /** Load another page (possibly on another site) and put the cursor back where it was. */
  async goto(url: string): Promise<void> {
    await this.caption('')
    await this.page.goto(url)
    await this.page.mouse.move(this.pointer.x + 1, this.pointer.y)
    await this.page.mouse.move(this.pointer.x, this.pointer.y)
  }

  /** Stop recording and write the frame list (with timings) for ffmpeg. */
  async close(): Promise<void> {
    if (!this.cdp) return
    await this.caption('')
    await this.beat(500)
    await this.cdp.send('Page.stopScreencast')
    await Promise.all(this.pending)
    const end = performance.now()

    const lines = this.frames.flatMap(({ file, at }, index) => {
      const next = this.frames[index + 1]?.at ?? end
      return [`file '${file}'`, `duration ${Math.max((next - at) / 1000, 0.01).toFixed(3)}`]
    })
    // ffmpeg's concat format ignores the final duration unless the file is repeated.
    lines.push(`file '${this.frames.at(-1)!.file}'`)
    writeFileSync(path.join(this.dir, 'frames.txt'), lines.join('\n') + '\n')
  }

  /** Pause, so the viewer can take in what just happened. */
  async beat(ms = 700): Promise<void> {
    await this.page.waitForTimeout(ms)
  }

  /**
   * Describe the scene that is about to play. The caption stays up until the
   * next one, and is never replaced before there has been time to read it.
   * The action waits a moment, so the viewer reads first and then watches.
   * An empty string hides the caption.
   */
  async caption(text: string): Promise<void> {
    const stillReading = this.captionVisibleUntil - performance.now()
    if (stillReading > 0) await this.beat(stillReading)

    await this.page.evaluate((value) => (window as any).__demoCaption(value), text)
    await this.beat(350)
    if (!text) return

    const words = text.split(/\s+/).length
    this.captionVisibleUntil = performance.now() + Math.max(3400, 1400 + words * 340)
    await this.beat(Math.min(900 + words * 90, 2200))
  }

  /** Glide the cursor to the middle of an element, easing in and out. */
  async moveTo(target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded()
    let box = await target.boundingBox()
    // Anything in the bottom strip would sit under the subtitle bar; bring it up.
    const viewport = this.page.viewportSize()
    if (box && viewport && box.y + box.height > viewport.height - CAPTION_BAR_HEIGHT) {
      await this.scrollTo(target, 0)
      box = await target.boundingBox()
    }
    if (!box) throw new Error('Cannot move to an element that is not visible')
    const end = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const start = this.pointer
    const distance = Math.hypot(end.x - start.x, end.y - start.y)
    const steps = Math.max(12, Math.min(40, Math.round(distance / 22)))

    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      await this.page.mouse.move(
        start.x + (end.x - start.x) * eased,
        start.y + (end.y - start.y) * eased,
      )
      await this.page.waitForTimeout(14)
    }
    this.pointer = end
  }

  /** Scroll an element to the middle of the screen, smoothly. */
  async scrollTo(target: Locator, afterMs = 500): Promise<void> {
    await target.evaluate((element) =>
      element.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
    await this.beat(650 + afterMs)
  }

  async click(target: Locator, afterMs = 700): Promise<void> {
    await this.moveTo(target)
    await this.beat(160)
    await this.page.mouse.down()
    await this.beat(70)
    await this.page.mouse.up()
    await this.beat(afterMs)
  }

  /** Click into a field and type with a natural rhythm. */
  async type(target: Locator, text: string, afterMs = 800): Promise<void> {
    await this.click(target, 250)
    for (const character of text) {
      await this.page.keyboard.type(character)
      await this.page.waitForTimeout(24 + Math.random() * 40)
    }
    await this.beat(afterMs)
  }
}

/** `test`, extended with a `director` whose recording is named after the test. */
export const test = base.extend<{ director: Director }>({
  director: async ({ page }, use, testInfo) => {
    const director = new Director(page, testInfo.title)
    await use(director)
    await director.close()
  },
})

export { expect } from '@playwright/test'
