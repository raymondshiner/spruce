type LogEntry = {
  routeId: string;
  method: string;
  status: number;
  latencyMs: number;
  deviceId?: string;
  mode?: string;
  promptTokens?: number;
  completionTokens?: number;
  upstreamCode?: number;
};

const ALLOWED_FIELDS = new Set<keyof LogEntry>([
  'routeId',
  'method',
  'status',
  'latencyMs',
  'deviceId',
  'mode',
  'promptTokens',
  'completionTokens',
  'upstreamCode',
]);

export function logRequest(entry: LogEntry): void {
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(entry) as (keyof LogEntry)[]) {
    if (ALLOWED_FIELDS.has(key) && entry[key] !== undefined) safe[key] = entry[key];
  }
  console.log(JSON.stringify(safe));
}
