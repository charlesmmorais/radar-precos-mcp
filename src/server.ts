// ─────────────────────────────────────────────────────────────────────────────
// Servidor MCP – radar-precos-mcp
// Protocolo: Model Context Protocol (stdio JSON-RPC)
// ─────────────────────────────────────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, chamarFerramenta } from "./tools/index.js";

const NOME_SERVIDOR = "radar-precos-mcp";
const VERSAO = "1.0.0";

/**
 * Inicia o servidor MCP via stdio.
 * O processo fica em escuta aguardando mensagens JSON-RPC do cliente.
 */
export async function iniciarServidor(): Promise<void> {
  const server = new Server(
    { name: NOME_SERVIDOR, version: VERSAO },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ── Listar ferramentas disponíveis ────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // ── Executar ferramenta ───────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args || typeof args !== "object") {
      return {
        content: [
          {
            type: "text",
            text: `Argumentos inválidos para a ferramenta "${name}".`,
          },
        ],
        isError: true,
      };
    }

    return chamarFerramenta(name, args as Record<string, unknown>);
  });

  // ── Iniciar transporte stdio ──────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[${NOME_SERVIDOR}] Servidor MCP iniciado (v${VERSAO})\n`
  );
}
