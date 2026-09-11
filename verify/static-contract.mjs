#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const apis = JSON.parse(fs.readFileSync(path.join(root, "verify/trace-apis.json"), "utf8"));
const tinysky = fs.readFileSync(path.join(root, "vendor/cua/types/tinysky_alt.types.d.ts"), "utf8");
const target = fs.readFileSync(path.join(root, "vendor/cua/docs/tinysky-alt-core-cua-repl.md"), "utf8");
const skyClient = fs.readFileSync(
  path.join(root, "vendor/sky/types/window/WindowComputerUseClient.d.ts"),
  "utf8",
);
const ipc = fs.readFileSync(path.join(root, "native/ipc-request-types.txt"), "utf8");
const apiJsonPath = path.join(root, "vendor/browser-desktop/api.json");
const apiJson = fs.existsSync(apiJsonPath) ? fs.readFileSync(apiJsonPath, "utf8") : "";

const mapping = {
  "cua.getApp": { where: [tinysky, target], need: "getApp(" },
  "cua.listApps": { where: [tinysky, target], need: "listApps(" },
  "cua.getBrowser": { where: [tinysky, target], need: "getBrowser(" },
  "cua.listTabs": { where: [tinysky, target], need: "listTabs(" },
  "cua.getTab": { where: [tinysky, target], need: "getTab(" },
  "app.click": { where: [tinysky, target, skyClient], need: "click(" },
  "app.getAXState": { where: [tinysky, target], need: "getAXState(" },
  "app.getAXStateAndScreenshot": { where: [tinysky, target], need: "getAXStateAndScreenshot(" },
  "app.getScreenshot": { where: [tinysky, target], need: "getScreenshot(" },
  "app.pressKey": { where: [tinysky, target], need: "pressKey(" },
  "app.typeText": { where: [tinysky, target], need: "typeText(" },
  "app.setValue": { where: [tinysky, target], need: "setValue(" },
  "app.paste": { where: [tinysky, target], need: "paste(" },
  "app.performSecondaryAction": { where: [tinysky, target], need: "performSecondaryAction(" },
  "tab.click": { where: [tinysky, target], need: "click(" },
  "tab.getAXState": { where: [tinysky, target], need: "getAXState(" },
  "tab.typeText": { where: [tinysky, target], need: "typeText(" },
  "tab.playwright.locator": { where: [apiJson, target], need: "playwright" },
  "tab.dev.logs": { where: [apiJson], need: "logs" },
  "browser.tabs.get": { where: [apiJson, tinysky], need: "tabs" },
  "nodeRepl.write": { where: [target], need: "nodeRepl.write" },
};

const ipcMap = {
  "cua.listApps": "ComputerUseIPCListAppsRequest",
  "cua.getApp": "ComputerUseIPCAppGetSkyshotRequest",
  "app.getAXState": "ComputerUseIPCAppGetSkyshotRequest",
  "app.getAXStateAndScreenshot": "ComputerUseIPCAppGetSkyshotRequest",
  "app.getScreenshot": "ComputerUseIPCAppGetSkyshotRequest",
  "app.click": "ComputerUseIPCAppPerformActionRequest",
  "app.pressKey": "ComputerUseIPCAppPerformActionRequest",
  "app.typeText": "ComputerUseIPCAppPerformActionRequest",
  "app.setValue": "ComputerUseIPCAppPerformActionRequest",
  "app.paste": "ComputerUseIPCAppPerformActionRequest",
  "app.performSecondaryAction": "ComputerUseIPCAppPerformActionRequest",
};

const results = [];
for (const item of apis.apis) {
  const name = item.name;
  if (name === "browser.browserId") {
    results.push({ name, ok: true, note: "property, not a call" });
    continue;
  }
  if (name.startsWith("tab.playwright.locator.")) {
    results.push({ name, ok: apiJson.includes("PlaywrightLocator"), note: "playwright locator method" });
    continue;
  }
  const spec = mapping[name];
  const typeOk = spec ? spec.where.some((src) => src.includes(spec.need)) : false;
  const ipcName = ipcMap[name];
  const ipcOk = ipcName ? ipc.includes(ipcName) : null;
  results.push({
    name,
    count: item.count,
    typeOk: spec ? typeOk : null,
    ipc: ipcName || null,
    ipcOk,
    ok: spec ? typeOk && ipcOk !== false : null,
    unknown: !spec,
  });
}

const report = {
  ts: new Date().toISOString(),
  total: results.length,
  ok: results.filter((r) => r.ok === true).length,
  unknown: results.filter((r) => r.unknown).length,
  failed: results.filter((r) => r.ok === false).length,
  results,
};
const dest = path.join(root, "verify/results/static-contract.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
