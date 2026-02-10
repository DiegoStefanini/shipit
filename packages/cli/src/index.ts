#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import loginCommand from "./commands/login.js";
import statusCommand from "./commands/status.js";
import projectsCommand from "./commands/projects.js";
import hostsCommand from "./commands/hosts.js";
import logsCommand from "./commands/logs.js";
import securityCommand from "./commands/security.js";

yargs(hideBin(process.argv))
  .scriptName("shipit")
  .version("1.0.0")
  .usage("Usage: shipit <command> [options]")
  .command(loginCommand)
  .command(statusCommand)
  .command(projectsCommand)
  .command(hostsCommand)
  .command(logsCommand)
  .command(securityCommand)
  .demandCommand(1, "Specify a command to run.")
  .strict()
  .help()
  .parse();
