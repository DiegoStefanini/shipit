import type { CommandModule } from "yargs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { saveConfig, loadConfig } from "../api.js";

const loginCommand: CommandModule = {
  command: "login",
  describe: "Authenticate with a ShipIt server",
  handler: async () => {
    const rl = createInterface({ input: stdin, output: stdout });

    try {
      const existing = loadConfig();
      const defaultUrl = existing?.url || "http://localhost:3000";

      const url = (await rl.question(`Server URL [${defaultUrl}]: `)) || defaultUrl;
      const username = await rl.question("Username: ");

      // Hide password input
      stdout.write("Password: ");
      const password = await new Promise<string>((resolve) => {
        let pw = "";
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding("utf-8");
        const onData = (ch: string) => {
          if (ch === "\r" || ch === "\n") {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            stdout.write("\n");
            resolve(pw);
          } else if (ch === "\u0003") {
            // Ctrl+C
            process.exit(0);
          } else if (ch === "\u007F" || ch === "\b") {
            if (pw.length > 0) {
              pw = pw.slice(0, -1);
              stdout.write("\b \b");
            }
          } else {
            pw += ch;
            stdout.write("*");
          }
        };
        stdin.on("data", onData);
      });

      const baseUrl = url.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const err = (await res.json()) as { error?: string; message?: string };
          msg = err.error || err.message || msg;
        } catch {
          // ignore
        }
        console.error(`Login failed: ${msg}`);
        process.exit(1);
      }

      const data = (await res.json()) as { token: string };
      saveConfig({ url: baseUrl, token: data.token });
      console.log(`Logged in to ${baseUrl} successfully.`);
    } finally {
      rl.close();
    }
  },
};

export default loginCommand;
