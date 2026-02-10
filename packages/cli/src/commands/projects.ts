import type { ArgumentsCamelCase, Argv, CommandModule } from "yargs";
import { apiRequest, formatTable, formatTimestamp } from "../api.js";

interface Project {
  id: string;
  name: string;
  status: string;
  repo: string;
  branch: string;
  lastDeploy?: string;
}

interface Deploy {
  id: string;
  status: string;
  createdAt: string;
  finishedAt?: string;
  log?: string;
}

async function findProjectByName(name: string): Promise<Project> {
  const projects = await apiRequest<Project[]>("GET", "/api/projects");
  const project = projects.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (!project) {
    console.error(`Project "${name}" not found.`);
    process.exit(1);
  }
  return project;
}

const projectsCommand: CommandModule = {
  command: "projects",
  describe: "Manage projects",
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: "list",
        describe: "List all projects",
        handler: async () => {
          const projects = await apiRequest<Project[]>("GET", "/api/projects");
          if (projects.length === 0) {
            console.log("No projects found.");
            return;
          }
          const rows = projects.map((p) => [
            p.name,
            p.status,
            p.repo || "-",
            p.branch || "-",
            p.lastDeploy ? formatTimestamp(p.lastDeploy) : "-",
          ]);
          console.log(
            formatTable(["Name", "Status", "Repo", "Branch", "Last Deploy"], rows)
          );
        },
      })
      .command({
        command: "deploy <name>",
        describe: "Trigger a deploy for a project",
        builder: (y: Argv) =>
          y.positional("name", { type: "string", demandOption: true }),
        handler: async (argv: ArgumentsCamelCase<{ name: string }>) => {
          const project = await findProjectByName(argv.name);
          await apiRequest("POST", `/api/projects/${project.id}/deploy`);
          console.log(`Deploy triggered for "${project.name}".`);
        },
      })
      .command({
        command: "stop <name>",
        describe: "Stop a project",
        builder: (y: Argv) =>
          y.positional("name", { type: "string", demandOption: true }),
        handler: async (argv: ArgumentsCamelCase<{ name: string }>) => {
          const project = await findProjectByName(argv.name);
          await apiRequest("POST", `/api/projects/${project.id}/stop`);
          console.log(`Project "${project.name}" stopped.`);
        },
      })
      .command({
        command: "start <name>",
        describe: "Start a project",
        builder: (y: Argv) =>
          y.positional("name", { type: "string", demandOption: true }),
        handler: async (argv: ArgumentsCamelCase<{ name: string }>) => {
          const project = await findProjectByName(argv.name);
          await apiRequest("POST", `/api/projects/${project.id}/start`);
          console.log(`Project "${project.name}" started.`);
        },
      })
      .command({
        command: "logs <name>",
        describe: "Show latest deploy log for a project",
        builder: (y: Argv) =>
          y.positional("name", { type: "string", demandOption: true }),
        handler: async (argv: ArgumentsCamelCase<{ name: string }>) => {
          const project = await findProjectByName(argv.name);
          const deploys = await apiRequest<Deploy[]>(
            "GET",
            `/api/projects/${project.id}/deploys`
          );
          if (deploys.length === 0) {
            console.log("No deploys found.");
            return;
          }
          const latest = deploys[0];
          console.log(`Deploy ${latest.id} (${latest.status})`);
          console.log(`  Started:  ${formatTimestamp(latest.createdAt)}`);
          if (latest.finishedAt) {
            console.log(`  Finished: ${formatTimestamp(latest.finishedAt)}`);
          }
          if (latest.log) {
            console.log("\n--- Log ---");
            console.log(latest.log);
          }
        },
      })
      .demandCommand(1, "Specify a subcommand: list, deploy, stop, start, logs"),
  handler: () => {},
};

export default projectsCommand;
