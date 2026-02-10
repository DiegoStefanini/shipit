import type { ArgumentsCamelCase, Argv, CommandModule } from "yargs";
import { apiRequest, formatTable, formatTimestamp } from "../api.js";

interface Alert {
  id: string;
  message: string;
  level: string;
  source: string;
  createdAt: string;
}

interface Decision {
  id: string;
  ip: string;
  action: string;
  reason?: string;
  hostId?: string;
  expiresAt?: string;
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

function parseDuration(dur: string): number {
  const match = dur.match(/^(\d+)(h|m|d)$/);
  if (!match) {
    console.error(`Invalid duration format "${dur}". Use e.g. 24h, 30m, 7d.`);
    process.exit(1);
  }
  const val = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { m: 60, h: 3600, d: 86400 };
  return val * (multipliers[unit] || 3600);
}

const securityCommand: CommandModule = {
  command: "security",
  describe: "Security alerts and IP management",
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: "alerts",
        describe: "Show security alerts",
        handler: async () => {
          const alerts = await apiRequest<Alert[]>("GET", "/api/security/alerts");
          if (alerts.length === 0) {
            console.log("No security alerts.");
            return;
          }
          const rows = alerts.map((a) => [
            a.level.toUpperCase(),
            a.source || "-",
            a.message,
            formatTimestamp(a.createdAt),
          ]);
          console.log(formatTable(["Level", "Source", "Message", "Time"], rows));
        },
      })
      .command({
        command: "blocked",
        describe: "Show blocked IPs / security decisions",
        handler: async () => {
          const decisions = await apiRequest<Decision[]>(
            "GET",
            "/api/security/decisions"
          );
          if (decisions.length === 0) {
            console.log("No blocked IPs.");
            return;
          }
          const rows = decisions.map((d) => [
            d.ip,
            d.action,
            d.reason || "-",
            d.expiresAt ? formatTimestamp(d.expiresAt) : "permanent",
            formatTimestamp(d.createdAt),
          ]);
          console.log(
            formatTable(["IP", "Action", "Reason", "Expires", "Created"], rows)
          );
        },
      })
      .command({
        command: "block <ip>",
        describe: "Block an IP address",
        builder: (y: Argv) =>
          y
            .positional("ip", { type: "string", demandOption: true })
            .option("host", {
              type: "string",
              describe: "Host name to apply the block on",
            })
            .option("duration", {
              type: "string",
              describe: "Block duration (e.g. 24h, 7d)",
              default: "24h",
            })
            .option("reason", {
              type: "string",
              describe: "Reason for blocking",
              default: "",
            }),
        handler: async (
          argv: ArgumentsCamelCase<{
            ip: string;
            host?: string;
            duration: string;
            reason: string;
          }>
        ) => {
          const hostId = argv.host ? await resolveHostId(argv.host) : undefined;
          const durationSeconds = parseDuration(argv.duration);

          await apiRequest("POST", "/api/security/decisions", {
            ip: argv.ip,
            action: "block",
            hostId,
            duration: durationSeconds,
            reason: argv.reason || undefined,
          });

          console.log(`Blocked ${argv.ip} for ${argv.duration}.`);
        },
      })
      .command({
        command: "unblock <ip>",
        describe: "Unblock an IP address",
        builder: (y: Argv) =>
          y
            .positional("ip", { type: "string", demandOption: true })
            .option("host", {
              type: "string",
              describe: "Host name to remove the block from",
            }),
        handler: async (
          argv: ArgumentsCamelCase<{ ip: string; host?: string }>
        ) => {
          const hostId = argv.host ? await resolveHostId(argv.host) : undefined;

          await apiRequest("DELETE", "/api/security/decisions", {
            ip: argv.ip,
            hostId,
          });

          console.log(`Unblocked ${argv.ip}.`);
        },
      })
      .demandCommand(1, "Specify a subcommand: alerts, blocked, block, unblock"),
  handler: () => {},
};

export default securityCommand;
