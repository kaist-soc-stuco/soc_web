import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
};

const verifierExit = run(process.execPath, ["--test", resolve(root, "infra/scripts/verify-migrations.test.mjs")]);
if (verifierExit !== 0) process.exit(verifierExit);

const bashCandidates = process.platform === "win32"
  ? [
      process.env.GIT_BASH_PATH,
      process.env.ProgramFiles ? resolve(process.env.ProgramFiles, "Git/bin/bash.exe") : undefined,
      process.env["ProgramFiles(x86)"] ? resolve(process.env["ProgramFiles(x86)"], "Git/bin/bash.exe") : undefined,
    ].filter((candidate) => candidate && existsSync(candidate))
  : ["bash"];

const bash = bashCandidates[0];
if (!bash) {
  console.error("Git Bash is required for the migration integration script on Windows. Set GIT_BASH_PATH to bash.exe.");
  process.exit(1);
}

const migrationExit = run(bash, ["--noprofile", "--norc", "-lc", "./infra/scripts/test-migrations.sh"]);
process.exit(migrationExit);
