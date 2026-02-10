import type { CommandModule } from "yargs";
import { apiRequest } from "../api.js";

interface Project {
  id: string;
  name: string;
  status: string;
}

interface Host {
  id: string;
  name: string;
  status: string;
}

interface SecurityOverview {
  totalAlerts: number;
  recentAlerts: Array<{ message: string; level: string; createdAt: string }>;
}

const statusCommand: CommandModule = {
  command: "status",
  describe: "Show overall ShipIt status overview",
  handler: async () => {
    const [projects, hosts, security] = await Promise.all([
      apiRequest<Project[]>("GET", "/api/projects"),
      apiRequest<Host[]>("GET", "/api/hosts"),
      apiRequest<SecurityOverview>("GET", "/api/security/overview"),
    ]);

    console.log("=== ShipIt Status ===\n");

    // Projects summary
    const running = projects.filter((p) => p.status === "running").length;
    const stopped = projects.filter((p) => p.status === "stopped").length;
    console.log(`Projects: ${projects.length} total (${running} running, ${stopped} stopped)`);

    // Hosts summary
    const online = hosts.filter((h) => h.status === "online").length;
    const offline = hosts.filter((h) => h.status !== "online").length;
    console.log(`Hosts:    ${hosts.length} total (${online} online, ${offline} offline)`);

    // Security summary
    console.log(`Alerts:   ${security.totalAlerts} total`);

    if (security.recentAlerts && security.recentAlerts.length > 0) {
      console.log("\nRecent alerts:");
      for (const alert of security.recentAlerts.slice(0, 5)) {
        const level = alert.level.toUpperCase().padEnd(5);
        console.log(`  [${level}] ${alert.message}`);
      }
    }
  },
};

export default statusCommand;
