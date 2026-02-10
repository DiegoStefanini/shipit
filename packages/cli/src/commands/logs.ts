import type { ArgumentsCamelCase, Argv, CommandModule } from "yargs";
import { apiRequest, formatTimestamp, requireConfig } from "../api.js";
import WebSocket from "ws";

interface LogEntry {
  id: string;
  message: string;
  level: string;
  source: string;
  hostId?: string;
  createdAt: string;
}

interface Host {
  id: string;
  name: string;
}

async function resolveHostId(name: string): Promise<string> {
  const hosts = await apiRequest<Host[]>("GET", "/api/hosts");
  const host = hosts.find((h) => h.name.toLowerCase() === name.toLowerCase());
  if (!host) {
    console.error(`Host "${name}" not found.`);
    process.exit(1);
  }
  return host.id;
}

const logsCommand: CommandModule<
  object,
  { host?: string; source?: string; level?: string; f?: boolean }
> = {
  command: "logs",
  describe: "View logs, optionally with live tailing",
  builder: (yargs: Argv) =>
    yargs
      .option("host", {
        type: "string",
        describe: "Filter by host name",
      })
      .option("source", {
        type: "string",
        describe: "Filter by log source",
      })
      .option("level", {
        type: "string",
        describe: "Filter by log level",
      })
      .option("f", {
        type: "boolean",
        describe: "Follow / tail logs in real-time",
        default: false,
      }),
  handler: async (
    argv: ArgumentsCamelCase<{
      host?: string;
      source?: string;
      level?: string;
      f?: boolean;
    }>
  ) => {
    const hostId = argv.host ? await resolveHostId(argv.host) : undefined;

    if (argv.f) {
      // Live tailing via WebSocket
      const config = requireConfig();
      const wsBase = config.url
        .replace(/^http:/, "ws:")
        .replace(/^https:/, "wss:")
        .replace(/\/+$/, "");

      const wsSource = argv.source || "all";
      const wsHostId = hostId || "all";
      const wsUrl = `${wsBase}/ws/logs/live/${wsHostId}/${wsSource}`;

      const ws = new WebSocket(wsUrl, {
        headers: { Authorization: `Bearer ${config.token}` },
      });

      ws.on("open", () => {
        console.log("Connected. Tailing logs (Ctrl+C to stop)...\n");
      });

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const entry = JSON.parse(data.toString()) as LogEntry;
          const ts = formatTimestamp(entry.createdAt);
          const level = entry.level.toUpperCase().padEnd(5);
          const source = (entry.source || "").padEnd(12);
          console.log(`${ts}  [${level}] ${source}  ${entry.message}`);
        } catch {
          console.log(data.toString());
        }
      });

      ws.on("error", (err: Error) => {
        console.error(`WebSocket error: ${err.message}`);
        process.exit(1);
      });

      ws.on("close", () => {
        console.log("\nConnection closed.");
        process.exit(0);
      });

      // Keep process alive until Ctrl+C
      process.on("SIGINT", () => {
        ws.close();
        process.exit(0);
      });

      // Prevent handler from returning (keeps process alive)
      await new Promise(() => {});
    } else {
      // Fetch recent logs
      const params = new URLSearchParams();
      if (hostId) params.set("hostId", hostId);
      if (argv.source) params.set("source", argv.source);
      if (argv.level) params.set("level", argv.level);
      params.set("limit", "50");

      const qs = params.toString();
      const path = `/api/logs${qs ? `?${qs}` : ""}`;
      const logs = await apiRequest<LogEntry[]>("GET", path);

      if (logs.length === 0) {
        console.log("No logs found.");
        return;
      }

      for (const entry of logs) {
        const ts = formatTimestamp(entry.createdAt);
        const level = entry.level.toUpperCase().padEnd(5);
        const source = (entry.source || "").padEnd(12);
        console.log(`${ts}  [${level}] ${source}  ${entry.message}`);
      }
    }
  },
};

export default logsCommand;
