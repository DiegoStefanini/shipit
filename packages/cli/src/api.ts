import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ShipitConfig {
  url: string;
  token: string;
}

const CONFIG_PATH = join(homedir(), ".shipit.json");

export function loadConfig(): ShipitConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as ShipitConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: ShipitConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function requireConfig(): ShipitConfig {
  const config = loadConfig();
  if (!config) {
    console.error("Not logged in. Run `shipit login` first.");
    process.exit(1);
  }
  return config;
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const config = requireConfig();
  const url = `${config.url.replace(/\/+$/, "")}${path}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string; message?: string };
      message = err.error || err.message || message;
    } catch {
      // ignore parse errors
    }
    console.error(`Error: ${message}`);
    process.exit(1);
  }

  return (await res.json()) as T;
}

export function formatTable(
  headers: string[],
  rows: string[][]
): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || "").length))
  );

  const sep = widths.map((w) => "-".repeat(w + 2)).join("+");
  const formatRow = (row: string[]) =>
    row.map((cell, i) => ` ${(cell || "").padEnd(widths[i])} `).join("|");

  const lines = [formatRow(headers), sep, ...rows.map(formatRow)];
  return lines.join("\n");
}

export function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}
