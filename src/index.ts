// ─────────────────────────────────────────────────────────────────────────────
// Entry point – radar-precos-mcp
// ─────────────────────────────────────────────────────────────────────────────

import { iniciarServidor } from "./server.js";

iniciarServidor().catch((err: unknown) => {
  process.stderr.write(
    `[radar-precos-mcp] Erro fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
