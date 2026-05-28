import { startDslApp } from "./runtime";

function parsePort(raw: string | undefined): number {
  if (!raw) {
    return 3000;
  }
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : 3000;
}

async function main() {
  const filePath = process.argv[2];
  const port = parsePort(process.argv[3]);

  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error("Usage: npm run dev -- <path-to-file.hhtml> [port]");
    process.exit(1);
  }

  await startDslApp(filePath, port);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
