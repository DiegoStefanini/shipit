import type { ArgumentsCamelCase, Argv, CommandModule } from "yargs";
import { apiRequest, formatTable } from "../api.js";

interface Host {
  id: string;
  name: string;
  hostname: string;
  status: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  lastSeen?: string;
}

const hostsCommand: CommandModule = {
  command: "hosts",
  describe: "Manage hosts",
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: "list",
        describe: "List all hosts",
        handler: async () => {
          const hosts = await apiRequest<Host[]>("GET", "/api/hosts");
          if (hosts.length === 0) {
            console.log("No hosts found.");
            return;
          }
          const rows = hosts.map((h) => [
            h.name,
            h.hostname || "-",
            h.status,
            h.cpuUsage != null ? `${h.cpuUsage.toFixed(1)}%` : "-",
            h.memoryUsage != null ? `${h.memoryUsage.toFixed(1)}%` : "-",
            h.diskUsage != null ? `${h.diskUsage.toFixed(1)}%` : "-",
          ]);
          console.log(
            formatTable(["Name", "Hostname", "Status", "CPU", "Memory", "Disk"], rows)
          );
        },
      })
      .command({
        command: "status <name>",
        describe: "Show detailed status for a host",
        builder: (y: Argv) =>
          y.positional("name", { type: "string", demandOption: true }),
        handler: async (argv: ArgumentsCamelCase<{ name: string }>) => {
          const hosts = await apiRequest<Host[]>("GET", "/api/hosts");
          const host = hosts.find(
            (h) => h.name.toLowerCase() === argv.name.toLowerCase()
          );
          if (!host) {
            console.error(`Host "${argv.name}" not found.`);
            process.exit(1);
          }

          console.log(`=== Host: ${host.name} ===\n`);
          console.log(`  Hostname:  ${host.hostname || "-"}`);
          console.log(`  Status:    ${host.status}`);
          console.log(`  CPU:       ${host.cpuUsage != null ? `${host.cpuUsage.toFixed(1)}%` : "-"}`);
          console.log(`  Memory:    ${host.memoryUsage != null ? `${host.memoryUsage.toFixed(1)}%` : "-"}`);
          console.log(`  Disk:      ${host.diskUsage != null ? `${host.diskUsage.toFixed(1)}%` : "-"}`);
          if (host.lastSeen) {
            console.log(`  Last Seen: ${new Date(host.lastSeen).toLocaleString()}`);
          }
        },
      })
      .demandCommand(1, "Specify a subcommand: list, status"),
  handler: () => {},
};

export default hostsCommand;
