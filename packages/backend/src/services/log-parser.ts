export interface ParsedLog {
  timestamp: number;
  level: string;
  message: string;
  service?: string;
}

export function parseDockerLog(line: string): ParsedLog {
  // Docker log format: "2024-01-15T10:30:00.123456789Z message here"
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+(.*)/);
  if (match) {
    const ts = new Date(match[1]).getTime();
    const message = match[2];
    return {
      timestamp: isNaN(ts) ? Date.now() : ts,
      level: detectLevel(message),
      message,
    };
  }
  return {
    timestamp: Date.now(),
    level: detectLevel(line),
    message: line,
  };
}

const PRIORITY_MAP: Record<number, string> = {
  0: 'error',
  1: 'error',
  2: 'error',
  3: 'error',
  4: 'warn',
  5: 'info',
  6: 'info',
  7: 'debug',
};

export function parseJournalctlJson(json: Record<string, unknown>): ParsedLog {
  const realtimeUs = json.__REALTIME_TIMESTAMP;
  const timestamp = realtimeUs ? Math.floor(Number(realtimeUs) / 1000) : Date.now();

  const message = (json.MESSAGE as string) ?? '';
  const priority = parseInt(String(json.PRIORITY ?? '6'), 10);
  const level = PRIORITY_MAP[priority] ?? 'info';
  const service = (json.SYSLOG_IDENTIFIER as string) ?? (json._COMM as string) ?? undefined;

  return { timestamp, level, message, service };
}

export function parseAccessLog(line: string): ParsedLog & { method?: string; path?: string; status?: number } {
  // Combined log format: IP - - [date] "METHOD /path HTTP/1.1" status size "referer" "ua"
  const match = line.match(
    /^[\d.]+ - - \[([^\]]+)\] "(\w+)\s+(\S+)\s+[^"]*"\s+(\d+)\s+/,
  );
  if (match) {
    const ts = new Date(match[1].replace(':', ' ').replace(/\//, '-').replace(/\//, '-')).getTime();
    const method = match[2];
    const path = match[3];
    const status = parseInt(match[4], 10);
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    return {
      timestamp: isNaN(ts) ? Date.now() : ts,
      level,
      message: line,
      method,
      path,
      status,
    };
  }
  return {
    timestamp: Date.now(),
    level: detectLevel(line),
    message: line,
  };
}

export function detectLevel(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('error') || lower.includes('fatal') || lower.includes('panic')) return 'error';
  if (lower.includes('warn')) return 'warn';
  if (lower.includes('debug')) return 'debug';
  return 'info';
}
