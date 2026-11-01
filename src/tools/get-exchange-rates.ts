// Example Tool: The smallest complete tool. Calls a public API that needs no key.
// Data source: Frankfurter (European Central Bank reference rates). https://frankfurter.dev
//
// Every tool file in this project follows the same layout, top to bottom:
//   1. Input / Output schemas  what goes in, what comes out
//   2. An Action function      does the actual work (network, database, ...)
//   3. defineTool({...})       metadata + wiring; stays short
import { defineTool } from "@mcpexpress/core";
import { z } from "zod";
import { READ_ONLY_OPEN } from "../lib/annotations.js";
import { createClient } from "../lib/http.js";

// --- 1. Define your Input and Output Schemas --------------------------------------------------
// Schemas are defined in plain zod syntax enabling full control.
const Currency = z
  .string()
  .regex(/^[A-Za-z]{3}$/, "3-letter currency code, e.g. USD")
  .transform((code) => code.toUpperCase());

// For this example we want to accept a base currency and target currencies to convert to
const InputSchema = z.object({
  base: Currency.default("USD"),
  symbols: z.array(Currency).min(1).max(20).optional().describe("Currencies to convert to; all when omitted"),
});

// We define the output schema to match what the Frankfurter API returns
const OutputSchema = z.object({
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

// --- 2. Action Function -----------------------------------------------------------------------
// We define the code which fetches the rates from the frankfurter api
async function fetchRates({ base, symbols }: z.infer<typeof InputSchema>, signal?: AbortSignal) {
  const api = createClient("https://api.frankfurter.dev/v1");
  const { data } = await api.get("/latest", { params: { base, symbols: symbols?.join(",") }, signal });
  return OutputSchema.parse(data);
}

// --- 3. Define the tool -----------------------------------------------------------------------
// Define your tool and add it to src/tools.ts to be auto detected on MCP Express.
export const getExchangeRates = defineTool({
  name: "get_exchange_rates",
  title: "Exchange rates",
  description: "Latest reference exchange rates from the European Central Bank, from one currency to others.",
  input: InputSchema,
  output: OutputSchema,
  annotations: READ_ONLY_OPEN,
  execute: (args, { signal }) => fetchRates(args, signal),
});
