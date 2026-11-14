import { expect, test } from '../lib/director.ts'

test('dashboard', async ({ page, director }) => {
  await director.open('/', {
    kicker: 'Healthcare Dashboard',
    title: 'Dashboard and patient list',
    subtitle: 'Navigation, the patient list, and a page for each patient',
  })

  // --- Dashboard: counts that link into the list -----------------------------
  await director.caption('The dashboard shows how many patients are in each status.')
  const critical = page.getByRole('link', { name: /Critical/ })
  await expect(critical).toContainText('13')
  await director.moveTo(page.getByRole('link', { name: /All patients/ }))
  await director.moveTo(critical)

  await director.caption('Each count links to the patient list, filtered by that status.')
  await director.click(critical)
  await expect(page).toHaveURL(/status=critical/)
  await expect(page.getByText('13 matching')).toBeVisible()

  // --- List: server-side paging, search, sort --------------------------------
  await director.caption('The list holds 200 patients and is paginated by the server.')
  await director.click(page.getByRole('radiogroup').getByText('All', { exact: true }))
  await expect(page.getByText('200 total')).toBeVisible()

  const search = page.getByRole('textbox', { name: 'Search patients by name' })
  await director.caption('The list stays visible and usable while a search is loading.')
  await director.type(search, 'garc')
  await expect(page.getByRole('row').nth(1)).toContainText('Garcia')
  await director.beat(1200)
  await director.click(page.getByRole('button', { name: 'Clear search' }))
  await expect(page.getByText('200 total')).toBeVisible()

  await director.caption('Each column can be sorted in either direction.')
  const age = page.getByRole('button', { name: 'Age' })
  // Ages grow with the calendar, so compare the two ends rather than fixed numbers.
  const ageInRow = async (row: number) =>
    Number(await page.getByRole('row').nth(row).getByRole('cell').nth(1).innerText())
  await director.click(age, 1100)
  await expect(page).toHaveURL(/sort=age$/)
  await expect.poll(() => ageInRow(1)).toBeLessThan(5)
  const youngest = await ageInRow(1)
  await director.click(age, 1100)
  await expect(page).toHaveURL(/sort=age&order=desc/)
  await expect.poll(() => ageInRow(1)).toBeGreaterThan(90)
  expect(youngest).toBeLessThan(await ageInRow(1))

  await director.caption('The page, search and sort order are stored in the URL.')
  await director.click(page.getByRole('button', { name: '3', exact: true }))
  await expect(page).toHaveURL(/page=3.*sort=age.*order=desc/)
  await expect(page.getByText('41–60 of 200')).toBeVisible()

  // --- Detail page ------------------------------------------------------------
  await director.caption('Each patient has a page with their personal and medical information.')
  const row = page.getByRole('row').nth(3)
  const name = await row.getByRole('link').innerText()
  await director.click(row.getByRole('link'))
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Medical information' })).toBeVisible()
  await director.scrollTo(page.getByRole('heading', { name: 'Medical information' }), 1200)

  // --- Navigation and the 404 page -------------------------------------------
  await director.caption('The sidebar can be collapsed and reopened.')
  const toggle = page.getByRole('button', { name: 'Toggle navigation' }).last()
  await director.click(toggle, 1000)
  await director.click(toggle, 800)

  // A full page load, so the caption is shown once the new page is up.
  await director.caption('')
  await page.goto('/patients/no/such/page')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await director.caption('An unknown URL shows a "Page not found" page.')
  await director.click(page.getByRole('link', { name: 'Back to dashboard' }))
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
})
