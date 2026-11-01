// Annotations are hints that tell clients (and users) what a tool does to the world,
// so they can decide whether to ask for confirmation. They don't enforce anything.
// Most tools fall into one of two presets, so they live here instead of being repeated inline.
import type { ToolAnnotations } from "@mcpexpress/core";

/** Reads from an external service: safe to call, but it does reach the internet. */
export const READ_ONLY_OPEN: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };

/** Reads from your own infrastructure only (e.g. your database), not the open internet. */
export const READ_ONLY_LOCAL: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
