// ─────────────────────────────────────────────────────────────────────────────
// Testes unitários – Validações (IN SEGES/ME nº 65/2021)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  dentroDaJanela,
  validarSerie,
  gerarTextoConclusao,
  JANELA_FONTES_PRINCIPAIS_MESES,
  JANELA_FONTES_SECUNDARIAS_MESES,
} from "../../src/domain/normas.js";
import type { FontePreco } from "../../src/domain/types.js";

function criarFonte(
  daysAgo: number,
  fonte: FontePreco["fonte"] = "pncp_contrato"
): FontePreco {
  const data = new Date();
  data.setDate(data.getDate() - daysAgo);
  return {
    id: `f-${daysAgo}`,
    fonte,
    descricaoObjeto: "Objeto teste",
    valorUnitario: 100,
    unidadeMedida: "UN",
    dataContrato: data.toISOString().substring(0, 10),
    orgao: "Órgão Teste",
    dataConsulta: new Date().toISOString(),
  };
}

describe("dentroDaJanela()", () => {
  it("aceita fontes primárias nos últimos 12 meses", () => {
    expect(dentroDaJanela(criarFonte(30, "pncp_contrato"))).toBe(true);
    expect(dentroDaJanela(criarFonte(360, "pncp_contrato"))).toBe(true);
  });

  it("rejeita fontes primárias com mais de 12 meses", () => {
    expect(dentroDaJanela(criarFonte(400, "pncp_contrato"))).toBe(false);
  });

  it("aceita fontes secundárias nos últimos 6 meses", () => {
    expect(dentroDaJanela(criarFonte(30, "midia_especializada"))).toBe(true);
    expect(dentroDaJanela(criarFonte(170, "cotacao_fornecedor"))).toBe(true);
  });

  it("rejeita fontes secundárias com mais de 6 meses", () => {
    expect(dentroDaJanela(criarFonte(200, "midia_especializada"))).toBe(false);
  });
});

describe("validarSerie()", () => {
  it("retorna alerta para série vazia", () => {
    const alertas = validarSerie([]);
    expect(alertas.some((a) => a.toLowerCase().includes("nenhuma"))).toBe(true);
  });

  it("retorna alerta para menos de 3 fontes", () => {
    const alertas = validarSerie([criarFonte(10), criarFonte(20)]);
    expect(alertas.some((a) => a.includes("mínimo"))).toBe(true);
  });

  it("não retorna alertas para série válida com 3+ fontes primárias recentes", () => {
    const serie = [criarFonte(10), criarFonte(30), criarFonte(60)];
    const alertas = validarSerie(serie);
    expect(alertas).toHaveLength(0);
  });

  it("alerta quando só há fontes secundárias", () => {
    const serie = [
      criarFonte(10, "midia_especializada"),
      criarFonte(20, "cotacao_fornecedor"),
      criarFonte(30, "midia_especializada"),
    ];
    const alertas = validarSerie(serie);
    expect(alertas.some((a) => a.toLowerCase().includes("primária"))).toBe(true);
  });
});

describe("gerarTextoConclusao()", () => {
  it("gera conclusão positiva quando há fontes similares", () => {
    const texto = gerarTextoConclusao(true);
    expect(texto).toContain("análise comparativa");
    expect(texto).toContain("razoabilidade");
    expect(texto).toContain("13.303");
  });

  it("gera conclusão negativa com motivo padrão", () => {
    const texto = gerarTextoConclusao(false);
    expect(texto).toContain("Não foi possível");
    expect(texto).toContain("não foram identificados");
  });

  it("incorpora justificativa personalizada na conclusão negativa", () => {
    const justificativa = "objeto tecnológico inovador sem precedentes no mercado público";
    const texto = gerarTextoConclusao(false, justificativa);
    expect(texto).toContain(justificativa);
  });
});
