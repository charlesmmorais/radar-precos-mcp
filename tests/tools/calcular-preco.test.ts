// ─────────────────────────────────────────────────────────────────────────────
// Testes unitários – Ferramenta calcular_preco_referencia
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from "vitest";
import { chamarFerramenta } from "../../src/tools/index.js";
import type { FontePreco } from "../../src/domain/types.js";

// Mocks das APIs externas (não queremos bater em APIs reais nos testes unitários)
vi.mock("../../src/apis/pncp.js", () => ({
  buscarContratacoesPNCP: vi.fn().mockResolvedValue([]),
  buscarContratossPNCP: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../src/apis/compras.js", () => ({
  buscarContratosCompras: vi.fn().mockResolvedValue([]),
}));

function criarFonte(id: string, valor: number): FontePreco {
  return {
    id,
    fonte: "pncp_contrato",
    descricaoObjeto: "Licença de Software",
    valorUnitario: valor,
    unidadeMedida: "licença",
    dataContrato: "2024-06-01",
    orgao: "Ministério da Fazenda",
    dataConsulta: new Date().toISOString(),
  };
}

describe("calcular_preco_referencia", () => {
  it("calcula preço de referência para série válida", async () => {
    const fontes: FontePreco[] = [
      criarFonte("A", 4.16),
      criarFonte("B", 6.33),
      criarFonte("C", 4.37),
      criarFonte("D", 5.78),
      criarFonte("E", 7.00),
      criarFonte("F", 6.25),
      criarFonte("G", 4.21),
      criarFonte("H", 3.15),
      criarFonte("I", 5.25),
    ];

    const result = await chamarFerramenta("calcular_preco_referencia", {
      fontes,
    });

    expect(result.isError).toBe(false);
    const data = JSON.parse(result.content[0].text);
    expect(data.precoReferencia).toBeGreaterThan(0);
    expect(data.conformeCV).toBe(true); // CV ~24.58% ≤ 25%
    expect(data.cvFormatado).toMatch(/\d+[.,]\d+%/);
  });

  it("identifica e remove outlier óbvio", async () => {
    const fontes: FontePreco[] = [
      criarFonte("A", 100),
      criarFonte("B", 105),
      criarFonte("C", 98),
      criarFonte("D", 110),
      criarFonte("E", 103),
      criarFonte("F", 10000), // outlier extremo
    ];

    const result = await chamarFerramenta("calcular_preco_referencia", {
      fontes,
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.outliersRemovidos).toBeGreaterThan(0);
    expect(data.precoReferencia).toBeLessThan(200); // outlier excluído
    expect(data.conformeCV).toBe(true);
  });

  it("retorna erro para lista de fontes vazia", async () => {
    const result = await chamarFerramenta("calcular_preco_referencia", {
      fontes: [],
    });
    expect(result.isError).toBe(true);
  });

  it("adiciona alertas quando CV supera 25% após mínimo de amostras", async () => {
    // 3 valores extremamente dispersos
    const fontes: FontePreco[] = [
      criarFonte("A", 1),
      criarFonte("B", 100),
      criarFonte("C", 10000),
    ];

    const result = await chamarFerramenta("calcular_preco_referencia", {
      fontes,
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.alertas.length).toBeGreaterThan(0);
    expect(data.conformeCV).toBe(false);
  });

  it("retorna estrutura completa com todas as propriedades esperadas", async () => {
    const fontes: FontePreco[] = [
      criarFonte("A", 500),
      criarFonte("B", 510),
      criarFonte("C", 495),
    ];

    const result = await chamarFerramenta("calcular_preco_referencia", {
      fontes,
    });
    const data = JSON.parse(result.content[0].text);

    expect(data).toHaveProperty("precoReferencia");
    expect(data).toHaveProperty("precoReferenciaFormatado");
    expect(data).toHaveProperty("cv");
    expect(data).toHaveProperty("cvFormatado");
    expect(data).toHaveProperty("conformeCV");
    expect(data).toHaveProperty("totalFontes");
    expect(data).toHaveProperty("fontesValidas");
    expect(data).toHaveProperty("outliersRemovidos");
    expect(data).toHaveProperty("totalIteracoes");
    expect(data).toHaveProperty("criterioParada");
    expect(data).toHaveProperty("alertas");
    expect(data).toHaveProperty("resultado");
  });
});

describe("ferramenta desconhecida", () => {
  it("retorna erro para ferramenta inexistente", async () => {
    const result = await chamarFerramenta("ferramenta_inexistente", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("desconhecida");
  });
});
