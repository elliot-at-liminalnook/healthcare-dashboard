import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../lib/director.ts'

const FIRST = 'Maya'
const LAST = 'Lindqvist'

/** Remove the demo patient if an earlier run left her behind. */
async function removeDemoPatient(request: APIRequestContext) {
  const found = await (await request.get(`/api/patients?search=${FIRST} ${LAST}`)).json()
  for (const patient of found.items) {
    await request.delete(`/api/patients/${patient.id}`)
  }
}

test('forms', async ({ page, request, director }) => {
  await removeDemoPatient(request)
  // Required fields are labelled with a trailing asterisk.
  const field = (name: string) =>
    page.locator('input').and(page.getByLabel(new RegExp(`^${name}( \\*)?$`)))

  await director.open('/patients', {
    kicker: 'Healthcare Dashboard',
    title: 'Adding and editing patients',
    subtitle: 'One form for both, with validation and error handling',
  })

  // --- Client-side validation ---------------------------------------------------
  await director.caption('A patient is added from the patient list.')
  await director.click(page.getByRole('link', { name: 'Add patient' }))
  await expect(page.getByRole('heading', { name: 'New patient' })).toBeVisible()

  const save = page.getByRole('button', { name: 'Add patient' })
  await director.caption(
    'Required fields are checked in the browser, using rules generated from the API schema.',
  )
  await director.scrollTo(save, 200)
  await director.click(save, 500)
  await expect(page.getByText('Required', { exact: true })).toHaveCount(3)
  await director.scrollTo(field('First name'), 1200)

  await director.type(field('First name'), FIRST, 200)
  await director.type(field('Last name'), LAST, 200)
  await director.type(field('Date of birth'), 'Mar 4, 1988', 100)
  await page.keyboard.press('Tab')
  await expect(page.getByText('Required', { exact: true })).toHaveCount(0)

  await director.caption('Each field is checked again when it loses focus.')
  await director.type(field('Email'), 'maya@', 100)
  await page.keyboard.press('Tab')
  await expect(page.getByText('Enter a valid email address')).toBeVisible()
  await director.beat(1600)
  await director.type(field('Email'), 'example.com', 100)
  await page.keyboard.press('Tab')
  await expect(page.getByText('Enter a valid email address')).toHaveCount(0)

  // --- Medical information ------------------------------------------------------
  await director.caption('Conditions and allergies are entered as tags.')
  await director.scrollTo(field('Last visit'), 200)
  await director.click(field('Blood type'), 400)
  await director.click(page.getByRole('option', { name: 'O+' }), 400)
  await director.type(field('Conditions'), 'Asthma', 100)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape') // close the suggestions so they cover nothing
  await director.type(field('Allergies'), 'Peanuts', 100)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')

  // --- Server-side validation ---------------------------------------------------
  await director.caption('The server checks that the last visit is not before the date of birth.')
  await director.type(field('Last visit'), 'Feb 1, 1980', 100)
  await page.keyboard.press('Tab')
  await director.click(save, 600)
  const serverError = page.getByText('Cannot be before the date of birth')
  await expect(serverError).toBeVisible()
  await director.caption('Errors from the server are shown under the field they apply to.')
  await director.moveTo(serverError)
  await director.beat(1200)
  await field('Last visit').fill('')
  await director.type(field('Last visit'), 'Nov 2, 2026', 100)
  await page.keyboard.press('Tab')
  await expect(serverError).toHaveCount(0)

  // --- Network failure ----------------------------------------------------------
  let offline = true
  await page.route('**/api/patients', (route) =>
    offline && route.request().method() === 'POST'
      ? route.abort('internetdisconnected')
      : route.continue(),
  )
  await director.caption(
    'If the connection fails, an error is shown and the form keeps what was entered.',
  )
  await director.click(save, 700)
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Could not reach the server')
  await director.scrollTo(alert, 1500)

  offline = false
  await director.caption('Once the connection is back, the same form is saved.')
  await director.scrollTo(save, 200)
  await director.click(save, 400)
  await expect(page.getByText(`${FIRST} ${LAST} was added`)).toBeVisible()
  await expect(page.getByRole('heading', { name: `${FIRST} ${LAST}` })).toBeVisible()
  await expect(page.getByText('Peanuts', { exact: true })).toBeVisible()
  await director.beat(1500)

  // --- Editing ------------------------------------------------------------------
  await director.caption('Editing a patient uses the same form.')
  await director.click(page.getByRole('link', { name: 'Edit' }))
  await expect(page.getByRole('heading', { name: `Edit ${FIRST} ${LAST}` })).toBeVisible()
  await expect(field('Email')).toHaveValue('maya@example.com')
  await director.scrollTo(field('Status'), 200)
  await director.click(field('Status'), 400)
  await director.click(page.getByRole('option', { name: 'Critical' }), 400)
  await director.click(page.getByRole('button', { name: 'Save changes' }), 400)
  await expect(page.getByText('Changes saved')).toBeVisible()
  await expect(page.getByRole('main').getByText('Critical', { exact: true })).toBeVisible()
  await director.beat(1200)

  // --- Deleting -----------------------------------------------------------------
  await director.caption('Deleting a patient requires confirmation.')
  await director.click(page.getByRole('button', { name: 'Delete', exact: true }))
  await expect(page.getByRole('dialog')).toContainText('cannot be undone')
  await director.beat(900)
  await director.click(page.getByRole('button', { name: 'Delete patient' }), 400)
  await expect(page.getByText(`${FIRST} ${LAST} was deleted`)).toBeVisible()
  await expect(page).toHaveURL(/\/patients$/)
  await expect(page.getByText('200 total')).toBeVisible()
})
