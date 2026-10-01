import type { TelemetryHistoryRow } from '../../api/types';

/*
 * Labels for the agent's telemetry metric names (Desktop-Agent
 * HardwareTelemetryMapper). One place to change when the agent adds metrics.
 */

export interface MetricInfo {
  label: string;
  unit: string;
  /** Sort key: CPU, memory, GPUs, fans. */
  order: number;
}

const RULES: [RegExp, (m: RegExpMatchArray) => MetricInfo][] = [
  [/^cpu\.load_percent$/, () => ({ label: 'CPU load', unit: '%', order: 10 })],
  [/^cpu\.core_max_load_percent$/, () => ({ label: 'CPU busiest core', unit: '%', order: 11 })],
  [/^cpu\.temperature_c$/, () => ({ label: 'CPU temperature', unit: '°C', order: 12 })],
  [/^memory\.usage_percent$/, () => ({ label: 'RAM used', unit: '%', order: 20 })],
  [/^memory\.used_gb$/, () => ({ label: 'RAM used', unit: 'GB', order: 21 })],
  [/^memory\.available_gb$/, () => ({ label: 'RAM free', unit: 'GB', order: 22 })],
  [/^memory\.total_gb$/, () => ({ label: 'RAM total', unit: 'GB', order: 23 })],
  [/^gpu\.(\d+)\.load_percent$/, (m) => ({ label: `GPU ${m[1]} load`, unit: '%', order: 30 + Number(m[1]) * 10 })],
  [/^gpu\.(\d+)\.temperature_c$/, (m) => ({ label: `GPU ${m[1]} temperature`, unit: '°C', order: 31 + Number(m[1]) * 10 })],
  [/^gpu\.(\d+)\.hotspot_temperature_c$/, (m) => ({ label: `GPU ${m[1]} hotspot`, unit: '°C', order: 32 + Number(m[1]) * 10 })],
  [/^gpu\.(\d+)\.memory_temperature_c$/, (m) => ({ label: `GPU ${m[1]} memory temp.`, unit: '°C', order: 33 + Number(m[1]) * 10 })],
  [/^gpu\.(\d+)\.memory_used_mb$/, (m) => ({ label: `GPU ${m[1]} memory used`, unit: 'MB', order: 34 + Number(m[1]) * 10 })],
  [/^gpu\.(\d+)\.memory_free_mb$/, (m) => ({ label: `GPU ${m[1]} memory free`, unit: 'MB', order: 35 + Number(m[1]) * 10 })],
  [/^gpu\.(\d+)\.memory_total_mb$/, (m) => ({ label: `GPU ${m[1]} memory total`, unit: 'MB', order: 36 + Number(m[1]) * 10 })],
  [/^fan\.(\d+)\.speed_rpm$/, (m) => ({ label: `Fan ${m[1]}`, unit: 'rpm', order: 200 + Number(m[1]) })],
];

export function describeMetric(metric: string): MetricInfo {
  for (const [re, make] of RULES) {
    const m = metric.match(re);
    if (m) return make(m);
  }
  return { label: metric, unit: '', order: 999 };
}

/** A snapshot's metrics as [metric, value] pairs in display order. */
export function sortedMetrics(metrics: Record<string, number>): [string, number][] {
  return Object.entries(metrics).sort(([a], [b]) => describeMetric(a).order - describeMetric(b).order || a.localeCompare(b));
}

/** Temperatures at or above this are shown in red. The agent's own alert thresholds decide alerts. */
export const HOT_C = 80;

export function isHot(metric: string, value: number): boolean {
  return metric.endsWith('temperature_c') && value >= HOT_C;
}

export function formatMetric(metric: string, value: number): string {
  const { unit } = describeMetric(metric);
  const digits = unit === 'rpm' || unit === 'MB' ? 0 : 1;
  return `${value.toFixed(digits)} ${unit}`.trim();
}

/** Min / average / max of one metric over the history. */
export interface MetricSummary {
  min: number;
  avg: number;
  max: number;
  samples: number;
}

/** Per metric, over every row that has it (GET …/telemetry/history plus live readings). */
export function summarize(rows: TelemetryHistoryRow[]): Map<string, MetricSummary> {
  const acc = new Map<string, { min: number; max: number; sum: number; samples: number }>();
  for (const row of rows) {
    for (const [metric, value] of Object.entries(row.metrics)) {
      if (!Number.isFinite(value)) continue;
      const a = acc.get(metric);
      if (a) {
        a.min = Math.min(a.min, value);
        a.max = Math.max(a.max, value);
        a.sum += value;
        a.samples += 1;
      } else {
        acc.set(metric, { min: value, max: value, sum: value, samples: 1 });
      }
    }
  }
  return new Map([...acc].map(([metric, a]) => [metric, { min: a.min, avg: a.sum / a.samples, max: a.max, samples: a.samples }]));
}

/** The server keeps one sample a minute: a live reading joins the history only as often, so it doesn't skew the average. */
const SAMPLE_MS = 60_000;

/** Adds a live reading (at most one a minute) and drops rows older than `cutoff` (ms). */
export function appendReading(rows: TelemetryHistoryRow[], reading: TelemetryHistoryRow, cutoff: number): TelemetryHistoryRow[] {
  const kept = rows.filter((r) => Date.parse(r.recordedAt) >= cutoff);
  const last = kept.at(-1);
  if (last && Date.parse(reading.recordedAt) - Date.parse(last.recordedAt) < SAMPLE_MS) return kept;
  return [...kept, reading];
}
