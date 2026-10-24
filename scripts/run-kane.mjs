import { readdirSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
// Kane assurance writes designed tests here; moving them into a subfolder drops their requirement link.
const testDir = ".testmuai/tests";
const files = readdirSync(testDir)
  .filter((f) => f.endsWith("_test.md"))
  .map((f) => `${testDir}/${f}`);
if (!files.length) {
  console.error(
    "Kane gate blocked: generate requirement-linked _test.md files through Kane assurance first.",
  );
  process.exit(1);
}
mkdirSync("artifacts", { recursive: true });
const result = spawnSync("kane-cli", ["testrun", "run", ...files, "--agent", "--headless", "--parallel", "4"], {
  stdio: ["ignore", "pipe", "inherit"],
  env: { ...process.env, KANE_CLI_USER_AGENT: "emergency-caller-ci" },
  encoding: "utf8",
});
const { writeFileSync } = await import("node:fs");
writeFileSync("artifacts/kane.ndjson", result.stdout ?? "");
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
const events = (result.stdout ?? "")
  .split("\n")
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
if (result.status !== 0 || !events.some((e) => e.type === "testrun_done")) {
  console.error(
    "Kane did not complete successfully. Inspect artifacts/kane.ndjson.",
  );
  process.exit(1);
}
console.log("Kane completed with exit code 0. Evidence stream saved.");
