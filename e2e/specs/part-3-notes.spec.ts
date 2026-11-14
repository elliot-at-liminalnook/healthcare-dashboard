import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../lib/director.ts'

const NOTE = 'Repeat labs are back: kidney function has stabilised. Continue the current plan.'

/** Remove notes left behind by an earlier run of this spec. */
async function removeDemoNotes(request: APIRequestContext, patientId: string) {
  const notes = await (await request.get(`/api/patients/${patientId}/notes`)).json()
  for (const note of notes.filter((note: { content: string }) => note.content === NOTE)) {
    await request.delete(`/api/patients/${patientId}/notes/${note.id}`)
  }
}

test('part-3-notes', async ({ page, request, director }) => {
  const found = await (await request.get('/api/patients?search=Richard Baker')).json()
  const patient = found.items[0]
  await removeDemoNotes(request, patient.id)

  await director.open(`/patients/${patient.id}`, {
    kicker: 'Healthcare Dashboard · Part 3',
    title: 'Patient notes',
    subtitle: 'Clinical notes, and a summary written from them',
  })

  // --- The summary -----------------------------------------------------------
  const summary = page.getByRole('region', { name: 'Summary' })
  await expect(summary).toContainText(/Richard Baker is \d+ years old/)
  await expect(summary).toContainText('Written from the profile and 4 notes')
  await director.caption('Every patient opens with a written summary')
  await director.moveTo(page.getByRole('heading', { name: 'Summary' }))
  await director.beat(1200)
  await director.caption('Who they are, what matters clinically, and the story so far', 2200)

  // --- Adding a note ---------------------------------------------------------
  const notes = page.getByRole('region', { name: 'Clinical notes' })
  const addNote = page.getByRole('button', { name: 'Add note' })
  await director.scrollTo(addNote)
  await director.caption('The notes behind it, newest first', 1500)

  await director.caption('An empty note never leaves the browser')
  await director.click(addNote)
  await expect(page.getByText('Write the note before adding it')).toBeVisible()
  await director.beat(900)

  await director.caption('So write a real one')
  await director.type(page.getByRole('textbox', { name: 'New note' }), NOTE, 600)
  await director.click(addNote)
  await expect(page.getByText('Note added')).toBeVisible()
  await expect(notes.getByText(NOTE)).toBeVisible()
  await director.caption('Saved, and at the top of the timeline', 1600)

  // --- The summary follows ---------------------------------------------------
  await director.scrollTo(page.getByRole('heading', { name: 'Summary' }))
  await expect(summary).toContainText('Written from the profile and 5 notes')
  await expect(summary).toContainText(`Most recently, on`)
  await expect(summary).toContainText(NOTE)
  await director.caption('And the summary has already been rewritten')
  await director.moveTo(summary.getByText(/There are 5 clinical notes/))
  await director.beat(2400)

  // --- Deleting --------------------------------------------------------------
  const newest = notes.getByRole('button', { name: /^Delete note from/ }).first()
  await director.scrollTo(newest)
  await director.caption('Deleting asks first')
  await director.click(newest)
  await expect(page.getByRole('dialog')).toContainText('Delete this note?')
  await director.beat(700)
  await director.click(page.getByRole('button', { name: 'Delete note', exact: true }))
  await expect(page.getByText('Note deleted')).toBeVisible()
  await expect(notes.getByText(NOTE)).toHaveCount(0)
  await director.beat(1500)

  await removeDemoNotes(request, patient.id)
})
