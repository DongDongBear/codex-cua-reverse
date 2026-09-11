// ../../../project/cua/cua_repl/src/launch.ts
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import process from "node:process";
try {
  const executable = process.env.CUA_REPL_NODE_REPL_PATH;
  if (!executable || !isAbsolute(executable)) {
    throw new Error("CUA_REPL_NODE_REPL_PATH must name an absolute executable");
  }
  const surfaces = new Set(
    (process.env.CUA_REPL_ENABLED_SURFACES ?? "browser,computer").split(",").map((surface) => surface.trim()).filter(Boolean)
  );
  for (const surface of surfaces) {
    if (surface !== "browser" && surface !== "computer") {
      throw new Error(`Unknown CUA_REPL_ENABLED_SURFACES value: ${surface}`);
    }
  }
  if (surfaces.size === 0) {
    throw new Error(
      "CUA_REPL_ENABLED_SURFACES must enable browser or computer"
    );
  }
  const setupOptions = {
    browser: surfaces.has("browser"),
    computer: surfaces.has("computer")
  };
  let bannerName = "banner.js";
  if (!setupOptions.browser) {
    bannerName = "banner-computer.js";
  } else if (!setupOptions.computer) {
    bannerName = "banner-browser.js";
  }
  const resource = (name) => readFile(new URL(`../resources/${name}`, import.meta.url), "utf8");
  const [
    banner,
    description,
    browserDescription,
    computerDescription,
    outputDescription,
    resetDescription,
    serverInstructions
  ] = await Promise.all([
    resource(bannerName),
    resource("js-tool-description.md"),
    setupOptions.browser ? resource("browser-description.md") : "Browser APIs are disabled.",
    setupOptions.computer ? resource("computer-description.md") : "Native computer APIs are disabled.",
    resource("js-output-description.md"),
    resource("js-reset.md"),
    resource("server-instructions.md")
  ]);
  const child = spawn(executable, [], {
    env: {
      ...process.env,
      NODE_REPL_TRUSTED_SERVICES: JSON.stringify({
        ...setupOptions.browser ? { browser: "@oai/browser-desktop/service" } : {},
        ...setupOptions.computer ? { sky: "@oai/sky/service" } : {}
      }),
      NODE_REPL_JS_BANNER: banner,
      NODE_REPL_TOOL_OVERRIDES: JSON.stringify({
        server_instructions: serverInstructions.trim(),
        tools: {
          js: {
            description: [
              description,
              browserDescription,
              computerDescription,
              outputDescription
            ].join("\n\n"),
            field_descriptions: {
              code: "JavaScript to execute using the initialized CUA runtime."
            }
          },
          js_reset: { description: resetDescription }
        }
      })
    },
    stdio: "inherit"
  });
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
  const forwardSignal = (signal) => {
    child.kill(signal);
  };
  for (const signal of signals) process.on(signal, forwardSignal);
  child.once("error", (error) => {
    console.error(`CUA REPL could not start: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("close", (code, signal) => {
    for (const name of signals) process.off(name, forwardSignal);
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code != null && code >= 0 ? code : 1;
  });
} catch (error) {
  console.error(
    `CUA REPL could not start: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
