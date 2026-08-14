import { spawn } from "node:child_process";

process.env.VITE_DEV_SERVER_URL ??= "http://127.0.0.1:5173";

const child = spawn("npx", ["electron", "."], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
