import { expect, test } from '../lib/director.ts'

test('part-2-dashboard', async ({ page, director }) => {
  await director.open('/', {
    kicker: 'Healthcare Dashboard · Part 2',
    title: 'The core dashboard',
    subtitle: 'Navigation, a fast patient list, and a page for every patient',
  })

  // --- Dashboard: counts that link into the list -----------------------------
  await director.caption('The practice at a glance')
  const critical = page.getByRole('link', { name: /Critical/ })
  await expect(critical).toContainText('13')
  await director.moveTo(page.getByRole('link', { name: /All patients/ }))
  await director.beat(400)
  await director.caption('One click to the patients who need attention')
  await director.click(critical)
  await expect(page).toHaveURL(/status=critical/)
  await expect(page.getByText('13 matching')).toBeVisible()
  await director.beat(900)

  // --- List: server-side paging, search, sort --------------------------------
  await director.click(page.getByRole('radiogroup').getByText('All', { exact: true }))
  await expect(page.getByText('200 total')).toBeVisible()
  await director.caption('200 patients, paged by the server')
  await director.beat(500)

  const search = page.getByRole('textbox', { name: 'Search patients by name' })
  await director.caption('Search as you type. The list never blocks.')
  await director.type(search, 'garc')
  await expect(page.getByRole('row').nth(1)).toContainText('Garcia')
  await director.beat(900)
  await director.click(page.getByRole('button', { name: 'Clear search' }))
  await expect(page.getByText('200 total')).toBeVisible()

  await director.caption('Sort by any column')
  const age = page.getByRole('button', { name: 'Age' })
  // Ages grow with the calendar, so compare the two ends rather than fixed numbers.
  const ageInRow = async (row: number) =>
    Number(await page.getByRole('row').nth(row).getByRole('cell').nth(1).innerText())
  await director.click(age)
  await expect(page).toHaveURL(/sort=age$/)
  await expect.poll(() => ageInRow(1)).toBeLessThan(5)
  const youngest = await ageInRow(1)
  await director.click(age)
  await expect(page).toHaveURL(/sort=age&order=desc/)
  await expect.poll(() => ageInRow(1)).toBeGreaterThan(90)
  expect(youngest).toBeLessThan(await ageInRow(1))
  await director.beat(600)

  await director.caption('Page, search and sort live in the URL')
  await director.click(page.getByRole('button', { name: '3', exact: true }))
  await expect(page).toHaveURL(/page=3.*sort=age.*order=desc/)
  await expect(page.getByText('41–60 of 200')).toBeVisible()
  await director.beat(700)

  // --- Detail page ------------------------------------------------------------
  await director.caption('Every patient has a page of their own')
  const row = page.getByRole('row').nth(3)
  const name = await row.getByRole('link').innerText()
  await director.click(row.getByRole('link'))
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByText('Medical information')).toBeVisible()
  await director.moveTo(page.getByText('Medical information'))
  await director.beat(1500)

  // --- Navigation and the 404 page -------------------------------------------
  await director.caption('The sidebar gets out of the way')
  const toggle = page.getByRole('button', { name: 'Toggle navigation' }).last()
  await director.click(toggle, 900)
  await director.click(toggle, 700)

  await director.caption('Even a wrong turn lands somewhere friendly', 300)
  await page.goto('/patients/who/are/you')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await director.beat(1300)
  await director.click(page.getByRole('link', { name: 'Back to dashboard' }))
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await director.beat(1200)
})
