/**
 * OpenTelemetry setup for the browser. Loaded on demand, only when telemetry
 * is enabled, so it adds nothing to the main bundle otherwise.
 *
 * Traces: page load and every `fetch`. API calls carry a `traceparent` header,
 * so the backend's spans and logs join the same trace.
 * Logs: whatever the application logger emits.
 */
import { context, propagation, trace, TraceFlags } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { BatchSpanProcessor, StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import type { LogLevel, LogSink } from './logger.ts'

/** Same-origin path that nginx (or the Vite dev server) forwards to the OTLP collector. */
const OTLP_PATH = '/otlp'

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

/** Start tracing and log export. Returns the sink the application logger writes to. */
export function startOtel(): LogSink {
  const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'healthcare-frontend' })

  context.setGlobalContextManager(new StackContextManager().enable())
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  trace.setGlobalTracerProvider(
    new TracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor({
          exporter: new OTLPTraceExporter({ url: `${OTLP_PATH}/v1/traces` }),
        }),
      ],
    }),
  )

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${OTLP_PATH}/v1/logs` }),
      }),
    ],
  })
  logs.setGlobalLoggerProvider(loggerProvider)

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      // Do not trace the exporter's own requests.
      new FetchInstrumentation({ ignoreUrls: [new RegExp(`${OTLP_PATH}/`)] }),
    ],
  })

  const otelLogger = loggerProvider.getLogger('app')
  return (level, message, { trace_id, span_id, ...attributes }) => {
    // A log about an API call names that call's trace. Attaching it as the
    // record's trace context is what lets Grafana link the log to the trace.
    const logContext =
      typeof trace_id === 'string' && typeof span_id === 'string'
        ? trace.setSpanContext(context.active(), {
            traceId: trace_id,
            spanId: span_id,
            traceFlags: TraceFlags.SAMPLED,
          })
        : undefined

    otelLogger.emit({
      severityNumber: SEVERITY[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes,
      context: logContext,
    })
  }
}
