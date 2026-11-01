// Runs one tool locally, for real:
//   npm run call -- <tool> '<json args>'
// It checks `env`, validates the input and the output the way MCP Express does.
import { type AnyTool, getMissingEnv, isTool } from "@mcpexpress/core";

// Variables from .env, for tools that read process.env. MCP Express sets them from the
// server's Environment Secrets instead, and never receives this file.
try {
  process.loadEnvFile();
} catch {
  // no .env: fine
}

const entry = await import("../src/tools.js");

const [name, json = "{}"] = process.argv.slice(2);
const tools = Object.values(entry as Record<string, unknown>).filter(isTool) as AnyTool[];
const tool = tools.find((t) => t.name === name);
if (!tool) {
  console.error(`Usage: npm run call -- <tool> '<json args>'\nTools: ${tools.map((t) => t.name).join(", ")}`);
  process.exit(1);
}

const missing = getMissingEnv(tool);
if (missing.length > 0) {
  console.error(`${tool.name} needs ${missing.join(", ")}. Set ${missing.length === 1 ? "it" : "them"} in .env.`);
  process.exit(1);
}

let args: unknown;
try {
  args = JSON.parse(json);
} catch {
  console.error(`Arguments must be JSON, e.g. '{"city":"Paris"}'`);
  process.exit(1);
}

const input = await tool.input["~standard"].validate(args);
if (input.issues) {
  console.error("Invalid input:", input.issues.map((i) => i.message).join("; "));
  process.exit(1);
}

try {
  const result = await tool.execute(input.value, { signal: AbortSignal.timeout(60_000) });
  if (tool.output) {
    const checked = await tool.output["~standard"].validate(result);
    if (checked.issues) throw new Error(`Output doesn't match the schema: ${checked.issues.map((i) => i.message).join("; ")}`);
  }
  console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Tool error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  // Database pools and keep-alive sockets would otherwise keep the process open.
  process.exit();
}
