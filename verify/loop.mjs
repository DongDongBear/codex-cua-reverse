#!/usr/bin/env node
/**
 * Goal loop: run verification layers, write round N, stop when required checks pass.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const NODE = process.execPath;
const MAX_ROUNDS = Number(process.env.CUA_VERIFY_ROUNDS || 3);

const jobs = [
  { id: "static", required: true, file: "static-contract.mjs" },
  { id: "native-ipc", required: true, file: "native-ipc.mjs" },
  { id: "sky-shim", required: true, file: "sky-shim.mjs" },
  { id: "mcp-client", required: false, file: "mcp-client.mjs" },
];

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(NODE, [path.join(here, file)], {
      cwd: here,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ exit: 124, stdout, stderr: stderr + "\nTIMEOUT" });
    }, 45000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exit: code ?? 1, stdout, stderr });
    });
  });
}

function loadResult(id) {
  const p = path.join(here, "results", `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const history = [];
let lastFingerprint = "";
let stall = 0;

for (let round = 1; round <= MAX_ROUNDS; round++) {
  const started = Date.now();
  const results = {};
  for (const job of jobs) {
    const r = await run(job.file);
    results[job.id] = {
      exit: r.exit,
      stderrTail: r.stderr.slice(-800),
      report: loadResult(job.id === "static" ? "static-contract" : job.id),
    };
  }
  const requiredFail = jobs
    .filter((j) => j.required)
    .filter((j) => results[j.id].exit !== 0);
  const summary = {
    round,
    ms: Date.now() - started,
    requiredFail: requiredFail.map((j) => j.id),
    results: Object.fromEntries(
      Object.entries(results).map(([k, v]) => [
        k,
        {
          exit: v.exit,
          passed: v.report?.passed ?? v.report?.ok,
          failed: v.report?.failed,
          checks: (v.report?.checks || v.report?.results || []).map((c) => ({
            name: c.name,
            ok: c.ok,
            error: c.error || null,
          })),
          stderrTail: v.stderrTail,
        },
      ]),
    ),
  };
  fs.mkdirSync(path.join(here, "rounds"), { recursive: true });
  fs.writeFileSync(
    path.join(here, "rounds", `round-${round}.json`),
    JSON.stringify(summary, null, 2),
  );
  history.push({ round, requiredFail: summary.requiredFail, ms: summary.ms });
  const fp = JSON.stringify(summary.requiredFail);
  if (fp === lastFingerprint) stall += 1;
  else stall = 0;
  lastFingerprint = fp;
  if (requiredFail.length === 0) {
    writeFinal(true, summary, history);
    process.exit(0);
  }
  if (stall >= 2) {
    writeFinal(false, summary, history, "stalled");
    process.exit(2);
  }
}

writeFinal(false, history.at(-1), history, "max_rounds");
process.exit(1);

function writeFinal(ok, last, hist, reason) {
  const report = {
    ts: new Date().toISOString(),
    goal: "Every reconstructed CUA API used in traces is live-proven or shape-proven.",
    ok,
    reason: reason || (ok ? "all_required_passed" : "failed"),
    history: hist,
    last,
    artifacts: {
      goal: "verify/GOAL.md",
      rounds: "verify/rounds/",
      results: "verify/results/",
    },
  };
  fs.writeFileSync(path.join(here, "results/LOOP.json"), JSON.stringify(report, null, 2));
  const md = [
    `# CUA verification loop`,
    ``,
    `**Result:** ${ok ? "PASS" : "FAIL"} (${report.reason})`,
    ``,
    `Goal: ${report.goal}`,
    ``,
    `Rounds: ${hist.length}`,
    ``,
    ...hist.map((h) => `- round ${h.round}: requiredFail=${JSON.stringify(h.requiredFail)} (${h.ms}ms)`),
    ``,
    `See \`verify/results/\` and \`verify/GOAL.md\`.`,
    ``,
  ].join("\n");
  fs.writeFileSync(path.join(root, "VERIFICATION.md"), md);
  console.log(JSON.stringify(report, null, 2));
}
