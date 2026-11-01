// Example Tool: pure logic with no external service, no secrets and no network.
import { defineTool } from "@mcpexpress/core";
import { z } from "zod";

// --- 1. Define your Input and Output Schemas --------------------------------------------------
const InputSchema = z.object({
  a: z.number().describe("The first number"),
  b: z.number().describe("The second number"),
});

const OutputSchema = z.object({ sum: z.number() });

// --- 2. Action Function -----------------------------------------------------------------------
const add = ({ a, b }: z.infer<typeof InputSchema>) => ({ sum: a + b });

// --- 3. Define the tool -----------------------------------------------------------------------
export const addNumbers = defineTool({
  name: "add_numbers",
  title: "Add numbers",
  description: "Add two numbers together and return their sum.",
  input: InputSchema,
  output: OutputSchema,
  // Touches nothing outside this function: read-only, and no outside systems involved.
  annotations: { readOnlyHint: true, openWorldHint: false },
  execute: (args) => add(args),
});
