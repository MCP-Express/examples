---
name: mcpexpress-builder
description: Create, edit or test MCP tools in an MCP Express project (defineTool from @mcpexpress/core). Use when asked to add a tool, change a tool's inputs or behaviour, connect a tool to an API or database, or run, check or package the tools.
---

# Building tools for MCP Express

This project serves MCP tools. Each tool is a `defineTool({ ... })` from `@mcpexpress/core`,
exported from `src/tools.ts`. MCP Express installs the dependencies, bundles `src/tools.ts` and
serves every exported tool to AI clients.

## Project layout

```
src/tools.ts          entry file: export every tool from here
src/tools/<name>.ts   one tool per file
scripts/call.ts       npm run call -- <tool> '<json>'   runs a tool locally
scripts/package.mjs   npm run package                   builds the zip to upload
```

## Adding a tool

1. Create `src/tools/<kebab-name>.ts` exporting a camelCase const from `defineTool`.
2. Add `export { myTool } from "./tools/<kebab-name>.js";` to `src/tools.ts` (keep the `.js`
   extension: the project is ESM).
3. Need a package? `npm install <package>`. Any pure-JavaScript npm package works. Packages
   with native binaries (sharp, bcrypt, better-sqlite3, canvas) or an install step (Prisma,
   Puppeteer) don't run on MCP Express: pick a pure-JS alternative (jimp, bcryptjs, pg).
4. Check it: `npm run typecheck`, then `npm run call -- <tool_name> '<json args>'`.

## Template

```ts
import { defineTool } from "@mcpexpress/core";
import { z } from "zod";

export const getWeather = defineTool({
  name: "get_weather",
  title: "Current weather",
  description:
    "Get the current weather for a city. Use for today's conditions, not forecasts. " +
    "Returns temperature in °C and a short summary.",
  input: z.object({
    city: z.string().min(1).describe("City name, optionally with country, e.g. 'Paris, FR'"),
  }),
  output: z.object({ temperatureC: z.number(), summary: z.string() }),
  annotations: { readOnlyHint: true, openWorldHint: true },
  env: ["OPENWEATHER_API_KEY"],
  execute: async ({ city }, { signal }) => {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("q", city);
    url.searchParams.set("units", "metric");
    url.searchParams.set("appid", process.env.OPENWEATHER_API_KEY!);
    const res = await fetch(url, { signal });
    if (res.status === 404) throw new Error(`No city named "${city}". Try adding the country.`);
    if (!res.ok) throw new Error(`Weather service error: HTTP ${res.status}`);
    const data = await res.json();
    return { temperatureC: data.main.temp, summary: data.weather[0].description };
  },
});
```

## Rules for each field

- **`name`**: snake_case verb_noun (`get_weather`, `create_invoice`), unique in the project,
  1-128 characters of letters, digits, `_`, `-`, `.`. Don't rename existing tools: clients use
  the name.
- **`title`**: short display name for people.
- **`description`**: written for the model. Say what the tool does, when to use it (and when
  not), what it returns, and limits. One to three sentences. Never just "Weather tool".
- **`input`**: a `z.object({ ... })`. `.describe()` every field with an example; the model reads
  these. Prefer `z.enum`, `.min/.max`, `.int()` and `.default()` over free text. Leave `input`
  out entirely for a tool with no arguments.
- **`output`** (optional): a `z.object` when a program or later step reads the result; then
  `execute` must return exactly that shape. Leave it out for free-form answers.
- **`annotations`**: set them honestly.
  - `readOnlyHint: true` when nothing is changed, sent or paid.
  - `destructiveHint: false` when a write only adds (sending a message, creating a record).
  - `idempotentHint: true` when repeating the same call has no further effect.
  - `openWorldHint: false` when it only touches your own systems (your database), `true` for
    the web and third-party APIs.
- **`env`**: names of the environment variables the tool can't run without. Names only, never
  values. MCP Express checks them before every call and returns an error naming any that are
  missing, so `process.env.NAME!` is safe inside `execute`. Leave optional variables out.
- **`execute(input, { signal })`**:
  - Read `process.env` here, never at the top of a file: the server imports the code before
    variables exist.
  - Pass `signal` to `fetch`, axios (`{ signal }`) and anything else that accepts it.
  - On failure, `throw new Error("...")` with a message the model can act on. Never return
    error text as a normal result.
  - Return a string, any JSON value, or data matching `output`.
  - Never log or return secrets.

## Shared clients

Create database pools and API clients once, lazily, in a separate module (`src/db.ts`), not per
call and not at import time:

```ts
import pg from "pg";

let pool: pg.Pool | undefined;
export const db = () => (pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL!, max: 5 }));
```

Tools using it list `"DATABASE_URL"` in `env`. Always pass SQL values as parameters
(`db().query("... where id = $1", [id])`), never inside the SQL string.

## Secrets

- Locally: put values in `.env` (git-ignored); `npm run call` loads it. Keep a `.env.example`
  with the names and empty values.
- On MCP Express: the user sets them in the server's **Environment Secrets** tab. The uploaded
  zip never contains `.env`.

## Before you finish

- [ ] `npm run typecheck` passes.
- [ ] `npm run call -- <tool_name> '<json>'` returns the expected result (a tool that needs
      secrets the user hasn't provided: say which variables to put in `.env`, don't invent values).
- [ ] The tool is exported from `src/tools.ts`.
- [ ] Every input field has `.describe()`, and `env` lists every required variable.
- [ ] Tell the user to run `npm run package` and upload the zip in the server's **Tools** tab,
      and to add any new `env` variables in **Environment Secrets**.
