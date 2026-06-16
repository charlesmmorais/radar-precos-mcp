// ─────────────────────────────────────────────────────────────────────────────
// Testes unitários – Algoritmo de Média Saneada
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  media,
  desvpadAmostral,
  coeficienteVariacao,
  calcularZScores,
  mediaSaneada,
  CV_MAXIMO,
  MINIMO_PRECOS,
} from "../../src/domain/media-saneada.js";
import type { FontePreco } from "../../src/domain/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function criarFonte(id: string, valor: number): FontePreco {
  return {
    id,
    fonte: "pncp_contrato",
    descricaoObjeto: `Objeto ${id}`,
    valorUnitario: valor,
    unidadeMedida: "UN",
    dataContrato: "2024-06-01",
    orgao: "Órgão Teste",
    dataConsulta: new Date().toISOString(),
  };
}

function fontes(valores: number[]): FontePreco[] {
  return valores.map((v, i) => criarFonte(String.fromCharCode(65 + i), v));
}

// ─── Funções estatísticas ─────────────────────────────────────────────────────

describe("media()", () => {
  it("calcula média corretamente", () => {
    expect(media([2, 4, 6])).toBeCloseTo(4);
    expect(media([1, 1, 1, 1])).toBeCloseTo(1);
    expect(media([10])).toBeCloseTo(10);
  });

  it("retorna 0 para array vazio", () => {
    expect(media([])).toBe(0);
  });
});

describe("desvpadAmostral()", () => {
  it("calcula desvio padrão amostral (n-1)", () => {
    // Excel: =DESVPAD({2,4,6}) = 2
    expect(desvpadAmostral([2, 4, 6])).toBeCloseTo(2, 5);
  });

  it("retorna 0 com menos de 2 valores", () => {
    expect(desvpadAmostral([5])).toBe(0);
    expect(desvpadAmostral([])).toBe(0);
  });

  it("retorna 0 quando todos valores são iguais", () => {
    expect(desvpadAmostral([3, 3, 3])).toBeCloseTo(0, 5);
  });
});

describe("coeficienteVariacao()", () => {
  it("calcula CV corretamente", () => {
    const valores = [4.16, 6.33, 4.37, 5.78, 7.0, 6.25, 4.21, 3.15, 5.25];
    const cv = coeficienteVariacao(valores);
    // CV esperado: ~24.58%
    expect(cv).toBeCloseTo(0.2458, 2);
  });

  it("retorna 0 se média for 0", () => {
    expect(coeficienteVariacao([0, 0, 0])).toBe(0);
  });
});

describe("calcularZScores()", () => {
  it("calcula Z-scores com soma zero", () => {
    const valores = [1, 2, 3, 4, 5];
    const zscores = calcularZScores(valores);
    // Soma dos Z-scores deve ser ~0
    const soma = zscores.reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(0, 5);
  });

  it("retorna zeros se desvpad é zero", () => {
    const zscores = calcularZScores([5, 5, 5]);
    expect(zscores.every((z) => z === 0)).toBe(true);
  });
});

// ─── Algoritmo de Média Saneada ───────────────────────────────────────────────

describe("mediaSaneada()", () => {
  it("retorna CV ≤ 25% para os dados de exemplo", () => {
    const vals = [4.16, 6.33, 4.37, 5.78, 7.0, 6.25, 4.21, 3.15, 5.25];
    const resultado = mediaSaneada(fontes(vals));

    // CV inicial é ~24.58%, já dentro do limite → para na iteração 1
    expect(resultado.conformeCV).toBe(true);
    expect(resultado.cv).toBeLessThanOrEqual(CV_MAXIMO);
    expect(resultado.totalIteracoes).toBe(1);
    expect(resultado.outliers).toHaveLength(0);
  });

  it("remove outliers quando CV > 25%", () => {
    // Série com outlier óbvio (1000 vs valores ~100)
    const vals = [100, 105, 98, 110, 103, 1000];
    const resultado = mediaSaneada(fontes(vals));

    expect(resultado.outliers.length).toBeGreaterThan(0);
    expect(resultado.precoReferencia).toBeLessThan(200); // outlier removido
  });

  it("para no mínimo de 3 amostras mesmo com CV alto", () => {
    // 4 valores muito dispersos: sempre vai remover até sobrar 3
    const vals = [1, 10, 100, 1000];
    const resultado = mediaSaneada(fontes(vals));

    expect(resultado.precosValidos.length).toBe(MINIMO_PRECOS);
    expect(resultado.criterioParada).toBe("minimo_amostras");
  });

  it("retorna preço de referência correto para série homogênea", () => {
    const vals = [100, 102, 98, 101, 99];
    const resultado = mediaSaneada(fontes(vals));

    expect(resultado.conformeCV).toBe(true);
    // Média dos 5 valores ≈ 100
    expect(resultado.precoReferencia).toBeCloseTo(100, 0);
  });

  it("retorna objeto vazio com alerta para array vazio", () => {
    const resultado = mediaSaneada([]);
    expect(resultado.precoReferencia).toBe(0);
    expect(resultado.alertas.length).toBeGreaterThan(0);
  });

  it("adiciona alerta quando há menos de 3 fontes", () => {
    const vals = [100, 110];
    const resultado = mediaSaneada(fontes(vals));
    expect(resultado.alertas.some((a) => a.includes("mínimo"))).toBe(true);
  });

  it("remove o outlier com maior |Z-score| em cada iteração", () => {
    // Outlier extremo à direita
    const vals = [100, 102, 98, 99, 101, 500];
    const resultado = mediaSaneada(fontes(vals));

    // O valor 500 deve ter sido removido
    const valorRemovido = resultado.outliers[0]?.valorUnitario;
    expect(valorRemovido).toBe(500);
  });

  it("aplica múltiplas iterações quando necessário", () => {
    // Dois outliers extremos
    const vals = [100, 102, 98, 101, 500, 1000];
    const resultado = mediaSaneada(fontes(vals));

    expect(resultado.totalIteracoes).toBeGreaterThan(1);
  });

  it("mantém a referência das fontes originais nos outliers e válidos", () => {
    const fs = fontes([100, 200, 300, 400, 500, 10000]);
    const resultado = mediaSaneada(fs);

    const todosIds = [
      ...resultado.precosValidos.map((f) => f.id),
      ...resultado.outliers.map((f) => f.id),
    ];

    // Todos os IDs originais devem estar no resultado
    fs.forEach((f) => {
      expect(todosIds).toContain(f.id);
    });
  });

  it("preserva a propriedade conformeCV corretamente", () => {
    // Série que vai ficar com CV > 25% após parar no mínimo
    const vals = [1, 10, 1000]; // extremamente disperso, 3 valores = mínimo
    const resultado = mediaSaneada(fontes(vals));

    expect(resultado.criterioParada).toBe("minimo_amostras");
    expect(resultado.conformeCV).toBe(resultado.cv <= CV_MAXIMO);
  });
});
