// ─────────────────────────────────────────────────────────────────────────────
// Testes de integração – API PNCP (requerem conexão com internet)
// Executar com: npm run test:integration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { buscarContratacoesPNCP } from "../../src/apis/pncp.js";

// Ignora automaticamente em CI (sem internet)
const skipInCI = process.env.CI === "true";

describe.skipIf(skipInCI)("PNCP API – integração real", () => {
  it(
    "busca licitações de software e retorna fontes de preço",
    async () => {
      const fontes = await buscarContratacoesPNCP({
        termoBusca: "licença software",
        codigoModalidade: 6,
        janelasMeses: 6,
        limite: 5,
      });

      // Pode retornar 0 resultados dependendo do período, mas não deve lançar erro
      expect(Array.isArray(fontes)).toBe(true);

      if (fontes.length > 0) {
        const fonte = fontes[0];
        expect(fonte).toHaveProperty("id");
        expect(fonte).toHaveProperty("valorUnitario");
        expect(fonte.valorUnitario).toBeGreaterThan(0);
        expect(fonte).toHaveProperty("fonte");
        expect(fonte).toHaveProperty("dataConsulta");
      }
    },
    120_000 // timeout 2 min (API governamental pode ser lenta)
  );
});
