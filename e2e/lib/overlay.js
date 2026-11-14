// Runs inside the page before the app loads (Playwright `addInitScript`).
// Draws what a headless browser does not: a mouse cursor, click ripples,
// a subtitle bar and an opening title card. Nothing here intercepts input.
;(() => {
  const config = window.__DEMO__ ?? {}
  const FONT = "'Inter Variable', system-ui, sans-serif"

  const style = document.createElement('style')
  style.textContent = `
    .demo-layer { position: fixed; z-index: 2147483647; pointer-events: none; font-family: ${FONT}; }
    .demo-cursor { top: 0; left: 0; width: 24px; height: 24px; will-change: transform;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    .demo-ripple { width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
      border: 2px solid #147d80; background: rgba(20,125,128,.25);
      animation: demo-ripple .5s ease-out forwards; }
    @keyframes demo-ripple { to { transform: scale(3.6); opacity: 0; } }
    /* A subtitle bar along the bottom edge. The page gets matching bottom
       padding, so content can always be scrolled clear of it. */
    .demo-caption { left: 0; right: 0; bottom: 0; min-height: 60px; padding: 14px 40px;
      display: flex; align-items: center; justify-content: center; text-align: center;
      background: #1c262b; color: #fff; font-size: 18px; font-weight: 600;
      letter-spacing: .1px; line-height: 1.4;
      transform: translateY(100%); transition: transform .3s ease; }
    .demo-caption.on { transform: translateY(0); }
    .demo-caption span { transition: opacity .18s ease; }
    .demo-caption.swap span { opacity: 0; }
    .mantine-AppShell-main { padding-bottom: 120px !important; }
    .demo-title { inset: 0; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; color: #fff; text-align: center;
      background: #0f7578; /* flat: gradients band badly in a GIF's limited palette */
      transition: opacity .55s ease; }
    .demo-title.off { opacity: 0; }
    .demo-title .kicker { font-size: 15px; font-weight: 600; letter-spacing: 2.4px;
      text-transform: uppercase; opacity: .8; }
    .demo-title .title { font-size: 54px; font-weight: 700; letter-spacing: -1px; }
    .demo-title .subtitle { font-size: 21px; font-weight: 500; opacity: .9; }
    .demo-title svg { width: 54px; height: 54px; margin-bottom: 6px; }
  `

  const cursor = document.createElement('div')
  cursor.className = 'demo-layer demo-cursor'
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 2.5v17.2l4.6-4.3 3 6.9 3-1.3-3-6.8h6.3z" fill="#1c262b" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'

  const caption = document.createElement('div')
  caption.className = 'demo-layer demo-caption'

  function place(x, y) {
    cursor.style.transform = `translate(${x - 4}px, ${y - 2}px)`
    sessionStorage.setItem('demo-cursor', JSON.stringify([x, y]))
  }

  function mount() {
    document.head.append(style)
    document.body.append(caption, cursor)
    // Keep the cursor where it was across full page loads.
    const [x, y] = JSON.parse(sessionStorage.getItem('demo-cursor') ?? '[600, 420]')
    place(x, y)

    if (config.title && !sessionStorage.getItem('demo-title-shown')) {
      sessionStorage.setItem('demo-title-shown', '1')
      const card = document.createElement('div')
      card.className = 'demo-layer demo-title'
      card.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19.5 13.6 12 21l-7.5-7.4A5 5 0 1 1 12 7a5 5 0 1 1 7.5 6.6"/>
          <path d="M3 13h2l2 3 2-6 1 3h3"/>
        </svg>
        <div class="kicker"></div><div class="title"></div><div class="subtitle"></div>`
      card.querySelector('.kicker').textContent = config.kicker ?? ''
      card.querySelector('.title').textContent = config.title
      card.querySelector('.subtitle').textContent = config.subtitle ?? ''
      document.body.append(card)
      cursor.style.opacity = '0'
      window.__demoHideTitle = () => {
        card.classList.add('off')
        setTimeout(() => {
          card.remove()
          cursor.style.opacity = '1'
        }, 600)
      }
    }
  }

  window.addEventListener('mousemove', (event) => place(event.clientX, event.clientY), true)
  window.addEventListener(
    'mousedown',
    (event) => {
      const ripple = document.createElement('div')
      ripple.className = 'demo-layer demo-ripple'
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      document.body.append(ripple)
      setTimeout(() => ripple.remove(), 600)
    },
    true,
  )

  const captionText = document.createElement('span')
  caption.append(captionText)

  window.__demoCaption = (text) => {
    if (!text) return caption.classList.remove('on')
    if (!caption.classList.contains('on')) {
      captionText.textContent = text
      return caption.classList.add('on')
    }
    // The bar stays in place; only the words cross-fade.
    caption.classList.add('swap')
    setTimeout(() => {
      captionText.textContent = text
      caption.classList.remove('swap')
    }, 190)
  }

  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
