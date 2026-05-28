#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { startDslApp } from "./runtime";

function parsePort(raw: string | undefined): number {
  if (!raw) {
    return 3000;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return 3000;
  }
  return value;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`todoDSL CLI

Usage:
  tododsl run <path-to-file.st> [port]
  tododsl <path-to-file.st> [port]

Examples:
  tododsl run ./example/todo-app.st 3000
  tododsl /Users/you/projects/myapp/app.st 5173
`);
}

async function runFile(filePath: string, portRaw?: string): Promise<void> {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`DSL file not found: ${absolute}`);
  }
  if (path.extname(absolute).toLowerCase() !== ".st") {
    // eslint-disable-next-line no-console
    console.warn(`Warning: expected .st file, got ${path.extname(absolute) || "no extension"}`);
  }

  const port = parsePort(portRaw);
  await startDslApp(absolute, port);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const first = args[0];

  if (!first || first === "-h" || first === "--help" || first === "help") {
    printHelp();
    return;
  }

  if (first === "run") {
    const filePath = args[1];
    if (!filePath) {
      throw new Error("Usage: tododsl run <path-to-file.st> [port]");
    }
    await runFile(filePath, args[2]);
    return;
  }

  await runFile(first, args[1]);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
