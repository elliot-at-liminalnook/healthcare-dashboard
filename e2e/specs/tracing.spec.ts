import { expect, test } from '../lib/director.ts'

const GRAFANA = process.env.GRAFANA_URL ?? 'http://localhost:3000'
const NEW_PHONE = '(206) 555-0142'

/** A Grafana Explore link showing one query. */
function explore(datasource: 'loki' | 'tempo', query: Record<string, unknown>): string {
  const panes = {
    a: {
      datasource,
      queries: [{ refId: 'A', datasource: { type: datasource, uid: datasource }, ...query }],
      range: { from: 'now-30m', to: 'now' },
    },
  }
  const encoded = encodeURIComponent(JSON.stringify(panes))
  return `${GRAFANA}/explore?schemaVersion=1&orgId=1&theme=light&kiosk&panes=${encoded}`
}

test('tracing', async ({ page, request, director }) => {
  const config = await (await request.get('/config.js')).text()
  test.skip(!config.includes('telemetryEnabled: true'), 'Needs the stack with telemetry on')

  const found = await (await request.get('/api/patients?search=Imran Kumar')).json()
  const id: string = found.items[0].id
  // Kept so the patient can be put back exactly as they were.
  const {
    id: _,
    age,
    created_at,
    updated_at,
    ...original
  } = await (await request.get(`/api/patients/${id}`)).json()

  try {
    await director.open(`/patients/${id}`, {
      kicker: 'Healthcare Dashboard · Logging and tracing',
      title: 'One request, end to end',
      subtitle: 'Following a saved change from the browser to the database',
    })

    // --- One change, saved in the app -------------------------------------------
    await director.caption("A patient's phone number is changed and saved.")
    await director.click(page.getByRole('link', { name: 'Edit' }))
    const phone = page.getByLabel('Phone')
    await director.click(phone, 200)
    await phone.selectText() // typing then replaces the old number
    await page.keyboard.type(NEW_PHONE, { delay: 45 })
    await director.beat(300)

    const saving = page.waitForRequest(
      (sent) => sent.method() === 'PUT' && sent.url().includes(`/api/patients/${id}`),
    )
    await director.click(page.getByRole('button', { name: 'Save changes' }), 400)
    // The browser tags the request with a trace id; the API continues the same trace.
    const traceId = (await saving).headers()['traceparent'].split('-')[1]
    await expect(page.getByText('Changes saved')).toBeVisible()
    await expect(page.getByText(NEW_PHONE, { exact: true })).toBeVisible()
    await director.scrollTo(page.getByText(NEW_PHONE, { exact: true }), 300)

    await director.caption(
      'The browser and the API each log the request, and both logs carry the same trace ID.',
    )

    // Both ends send telemetry in batches, so wait until all of it has arrived.
    const logQuery = `{service_name=~"healthcare-.+"} | trace_id="${traceId}"`
    await expect
      .poll(
        async () => {
          const url = `${GRAFANA}/api/datasources/proxy/uid/loki/loki/api/v1/query_range`
          const body = await (await request.get(url, { params: { query: logQuery } })).json()
          return body.data.result.map((stream: any) => stream.stream.service_name).sort()
        },
        { timeout: 45_000 },
      )
      .toEqual(['healthcare-backend', 'healthcare-frontend'])
    await expect
      .poll(
        async () => {
          const response = await request.get(
            `${GRAFANA}/api/datasources/proxy/uid/tempo/api/traces/${traceId}`,
          )
          if (!response.ok()) return []
          const { batches } = await response.json()
          return batches.flatMap((batch: any) =>
            batch.scopeSpans.flatMap((scope: any) => scope.spans.map((span: any) => span.name)),
          )
        },
        { timeout: 45_000 },
      )
      .toEqual(
        expect.arrayContaining(['PUT /patients/{id}', 'PUT /patients/{patient_id}', 'UPDATE']),
      )

    // --- The logs, in Grafana -----------------------------------------------------
    const line =
      '{{.service_name}}   {{.method}} {{.path}}   status {{.status}}   {{.duration_ms}} ms'
    await director.goto(explore('loki', { expr: `${logQuery} | line_format "${line}"` }))
    const browserLog = page.getByText(/healthcare-frontend\s+PUT/).first()
    const apiLog = page.getByText(/healthcare-backend\s+PUT/).first()
    await expect(browserLog).toBeVisible({ timeout: 20_000 })
    await expect(apiLog).toBeVisible()
    await director.caption('In Grafana, searching for the trace ID finds both log lines.')
    await director.scrollTo(apiLog, 600)
    await director.moveTo(browserLog)
    await director.beat(900)
    await director.moveTo(apiLog)
    await director.beat(900)

    // --- The trace, in Grafana ----------------------------------------------------
    await director.goto(explore('tempo', { queryType: 'traceql', query: traceId }))
    const apiSpan = page.getByText('PUT /patients/{patient_id}').first()
    await expect(apiSpan).toBeVisible({ timeout: 20_000 })
    await director.caption(
      'The trace shows the same request passing from the browser, through the API, to the database.',
    )
    await director.scrollTo(apiSpan, 600)
    await director.moveTo(page.getByText('PUT /patients/{id}').first())
    await director.beat(700)
    await director.moveTo(apiSpan)
    await director.beat(700)
    const update = page.getByText('UPDATE', { exact: true }).first()
    await director.moveTo(update)
    await director.caption('The SQL statement that changed the row is a span in that trace.')
    await director.click(update, 1500)
  } finally {
    // Put the patient back as they were, even if a step above failed.
    await request.put(`/api/patients/${id}`, { data: original })
  }
})
