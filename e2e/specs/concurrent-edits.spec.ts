import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '../lib/director.ts'

// Two browser sessions edit the same patient. The first test is the recorded
// demo; the second covers a case that is not worth watching.

const FIRST = 'Noor'
const LAST = 'Castellan'
const ORIGINAL = {
  first_name: FIRST,
  last_name: LAST,
  date_of_birth: '1979-09-12',
  email: 'noor@example.com',
  phone: '(206) 555-0142',
  city: 'Seattle',
}
const MY_EMAIL = 'noor.castellan@example.com'
const THEIR_EMAIL = 'ncastellan@example.org'
const THEIR_PHONE = '(425) 555-0177'
const THEIR_CITY = 'Bellevue'

/** Remove the demo patient if an earlier run left her behind. */
async function removeDemoPatient(request: APIRequestContext) {
  const found = await (await request.get(`/api/patients?search=${FIRST} ${LAST}`)).json()
  for (const patient of found.items) {
    await request.delete(`/api/patients/${patient.id}`)
  }
}

async function createDemoPatient(request: APIRequestContext) {
  await removeDemoPatient(request)
  return (await request.post('/api/patients', { data: ORIGINAL })).json()
}

// Required fields are labelled with a trailing asterisk.
const field = (page: Page, name: string) =>
  page.locator('input').and(page.getByLabel(new RegExp(`^${name}( \\*)?$`)))

test('concurrent-edits', async ({ page, request, director, browser, baseURL }) => {
  const created = await createDemoPatient(request)
  const api = `/api/patients/${created.id}`

  // The colleague: a second browser session with nothing in common with the first.
  const colleagueSession = await browser.newContext({ baseURL })
  const colleague = await colleagueSession.newPage()
  async function colleagueSaves(changes: Record<string, string>) {
    await colleague.goto(`/patients/${created.id}/edit`)
    for (const [label, value] of Object.entries(changes)) {
      await field(colleague, label).fill(value)
    }
    await colleague.getByRole('button', { name: 'Save changes' }).click()
    await expect(colleague.getByText('Changes saved')).toBeVisible()
  }

  const banner = page
    .getByRole('alert')
    .filter({ hasText: 'This patient was changed in another session' })
  const save = page.getByRole('button', { name: 'Save changes' })
  const main = page.getByRole('main')
  const heading = page.getByRole('heading', { name: `${FIRST} ${LAST}`, exact: true })

  await director.open(`/patients/${created.id}`, {
    kicker: 'Healthcare Dashboard',
    title: 'Two people editing one patient',
    subtitle: 'Nobody’s changes are overwritten, and both are told what happened',
  })

  // --- A change arrives while the form is open -----------------------------------
  await director.caption('One person opens a patient and starts correcting the email address.')
  await director.click(page.getByRole('link', { name: 'Edit' }))
  await expect(field(page, 'Email')).toHaveValue(ORIGINAL.email)
  await field(page, 'Email').fill('')
  await director.type(field(page, 'Email'), MY_EMAIL, 300)

  await director.caption(
    'Meanwhile a colleague, in another browser, saves a new phone number and a different email.',
  )
  await colleagueSaves({ Phone: THEIR_PHONE, Email: THEIR_EMAIL })

  await director.caption('Within seconds, the open form says the patient was changed.')
  await expect(banner).toBeVisible({ timeout: 20_000 })
  await director.moveTo(banner)
  await director.beat(1500)

  await director.caption('The phone number had not been touched here, so it shows their new value.')
  await expect(banner).toContainText('Now showing their new value for: Phone.')
  await expect(field(page, 'Phone')).toHaveValue(THEIR_PHONE)
  await director.moveTo(field(page, 'Phone'))
  await director.beat(1200)

  await director.caption(
    'Both changed the email. What was typed is kept, with their value shown beside it.',
  )
  await expect(banner).toContainText(`Email: they entered ${THEIR_EMAIL}`)
  await expect(field(page, 'Email')).toHaveValue(MY_EMAIL)
  await director.moveTo(page.getByRole('button', { name: 'Use their email' }))
  await director.beat(1500)

  await director.caption('Saving now is an informed choice: this email, their phone number.')
  await director.scrollTo(save, 200)
  await director.click(save, 500)
  await expect(page.getByText('Changes saved')).toBeVisible()
  // The page is still scrolled to where the Save button was; bring the record into view.
  await director.scrollTo(heading, 300)
  await director.caption('The patient now has this email and the colleague’s phone number.')
  await director.moveTo(main.getByText(THEIR_PHONE))
  await director.beat(900)
  await director.moveTo(main.getByText(MY_EMAIL))
  await expect(main.getByText(MY_EMAIL)).toBeVisible()
  await expect(main.getByText(THEIR_PHONE)).toBeVisible()
  await director.beat(1500)

  // --- A save that would overwrite a change is refused ---------------------------
  await director.caption('The server also checks. Here the city is being changed.')
  await director.click(page.getByRole('link', { name: 'Edit' }))
  await expect(field(page, 'City')).toHaveValue(ORIGINAL.city)
  await field(page, 'City').fill('')
  await director.type(field(page, 'City'), 'Tacoma', 300)

  // Hold back this form's checks for changes, so its save is certain to be the stale one.
  let holding = true
  let release = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route(`**${api}`, async (route) => {
    if (holding && route.request().method() === 'GET') await released
    await route.continue()
  })

  await director.caption(
    'The colleague saves a different city, and this form is saved before it has noticed.',
  )
  await colleagueSaves({ City: THEIR_CITY })
  const beforeRefusedSave = await (await request.get(api)).json()
  await director.scrollTo(save, 200)
  await director.click(save, 500)

  const refusal = page.getByRole('alert').filter({ hasText: 'The patient was not saved' })
  await expect(refusal).toContainText('changed in another session while you were editing')
  // The colleague's save is intact on the server, and what was typed is still in the form.
  expect(await (await request.get(api)).json()).toEqual(beforeRefusedSave)
  await expect(field(page, 'City')).toHaveValue('Tacoma')
  holding = false
  release()

  await director.caption('The save is refused, so the colleague’s city is not overwritten.')
  await director.scrollTo(refusal, 1500)
  await expect(banner).toContainText(`City: they entered ${THEIR_CITY}`)

  await director.caption('Their value can be taken with one click, and the patient saved again.')
  await director.click(page.getByRole('button', { name: 'Use their city' }), 600)
  await expect(field(page, 'City')).toHaveValue(THEIR_CITY)
  await director.scrollTo(save, 200)
  await director.click(save, 500)
  await expect(page.getByText('Changes saved')).toBeVisible()

  // --- The result ---------------------------------------------------------------
  await director.scrollTo(heading, 300)
  await director.caption(
    'Nothing was lost: the patient has this email, and the colleague’s phone number and city.',
  )
  await director.moveTo(main.getByText(THEIR_PHONE))
  await director.beat(900)
  await director.moveTo(main.getByText(MY_EMAIL))
  await director.beat(900)
  await director.moveTo(main.getByText(THEIR_CITY))
  await expect(main.getByText(THEIR_CITY)).toBeVisible()
  await director.beat(3000)

  // Everything both people entered is on the record.
  const final = await (await request.get(api)).json()
  expect(final).toMatchObject({ email: MY_EMAIL, phone: THEIR_PHONE, city: THEIR_CITY })

  // The rule itself, without the form: a save from an old version is answered with 409.
  const stale = await request.put(api, { data: { ...ORIGINAL, version: 1 } })
  expect(stale.status()).toBe(409)
  expect((await stale.json()).current).toEqual(final)

  await colleagueSession.close()
  await removeDemoPatient(request)
})

test('a failed check for changes leaves the form and what was typed in place', async ({
  page,
  request,
}) => {
  const created = await createDemoPatient(request)
  const api = `/api/patients/${created.id}`
  await page.goto(`/patients/${created.id}/edit`)
  await field(page, 'Phone').fill(THEIR_PHONE)

  // The server has a bad moment: every re-read of the patient fails.
  let failures = 0
  await page.route(`**${api}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    failures += 1
    await route.fulfill({ status: 502, body: 'Bad gateway' })
  })
  // Coming back to the tab makes the form check for changes at once.
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  // The read is tried three times before it is given up on.
  await expect.poll(() => failures, { timeout: 20_000 }).toBeGreaterThanOrEqual(3)
  await page.waitForTimeout(500)

  await expect(page.getByText('Could not load this patient')).toHaveCount(0)
  await expect(field(page, 'Phone')).toHaveValue(THEIR_PHONE)

  // Once the server is back, the same form saves.
  await page.unroute(`**${api}`)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Changes saved')).toBeVisible()
  expect((await (await request.get(api)).json()).phone).toBe(THEIR_PHONE)

  await removeDemoPatient(request)
})
