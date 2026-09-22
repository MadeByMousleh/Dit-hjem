import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const [action, ...extra] = process.argv.slice(2);
const commands = {
  login: ["login"],
  new: ["migration", "new"],
  status: ["migration", "list", "--linked"],
  plan: ["db", "push", "--linked", "--dry-run"],
  apply: ["db", "push", "--linked"],
};
let args = commands[action];
if (action === "link") {
  let ref = process.env.SUPABASE_PROJECT_REF?.trim();
  if (!ref && process.env.SUPABASE_URL) {
    const url = new URL(process.env.SUPABASE_URL.trim());
    if (url.hostname.endsWith(".supabase.co")) ref = url.hostname.split(".")[0];
  }
  if (!ref || !/^[a-z0-9]{20}$/.test(ref)) {
    console.error("Set SUPABASE_PROJECT_REF or SUPABASE_URL in .env before linking.");
    process.exit(1);
  }
  args = ["link", "--project-ref", ref];
}
if (!args) {
  console.error("Choose login, link, new, status, plan, or apply.");
  process.exit(1);
}
const cli = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));
const child = spawn(process.execPath, [cli, ...args, ...extra], {
  stdio: "inherit", shell: false, env: process.env,
});
child.on("error", () => { console.error("Could not start Supabase CLI. Run npm install first."); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
