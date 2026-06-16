// ─────────────────────────────────────────────────────────────────────────────
// Testes unitários – Utilitários de data
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  toDataPNCP,
  toDataISO,
  subtrairMeses,
  formatarDataBR,
  pncpParaISO,
  intervaloJanela,
} from "../../src/utils/date.js";

describe("toDataPNCP()", () => {
  it("formata data corretamente no padrão AAAAMMDD", () => {
    const data = new Date("2024-03-15T12:00:00Z");
    expect(toDataPNCP(data)).toBe("20240315");
  });
});

describe("toDataISO()", () => {
  it("retorna YYYY-MM-DD", () => {
    const data = new Date("2024-06-01T00:00:00Z");
    expect(toDataISO(data)).toBe("2024-06-01");
  });
});

describe("subtrairMeses()", () => {
  it("subtrai meses corretamente", () => {
    const data = new Date("2024-06-15");
    const resultado = subtrairMeses(data, 3);
    expect(resultado.getMonth()).toBe(2); // março (0-indexed)
    expect(resultado.getFullYear()).toBe(2024);
  });

  it("lida com cruzamento de ano", () => {
    const data = new Date("2024-02-01");
    const resultado = subtrairMeses(data, 3);
    expect(resultado.getMonth()).toBe(10); // novembro
    expect(resultado.getFullYear()).toBe(2023);
  });
});

describe("formatarDataBR()", () => {
  it("converte YYYY-MM-DD para DD/MM/YYYY", () => {
    expect(formatarDataBR("2024-06-15")).toBe("15/06/2024");
  });

  it("passa strings inválidas sem modificação", () => {
    expect(formatarDataBR("")).toBe("");
    expect(formatarDataBR("abc")).toBe("abc");
  });
});

describe("pncpParaISO()", () => {
  it("converte AAAAMMDD para YYYY-MM-DD", () => {
    expect(pncpParaISO("20240315")).toBe("2024-03-15");
  });
});

describe("intervaloJanela()", () => {
  it("retorna intervalo de 12 meses por padrão", () => {
    const { dataInicial, dataFinal } = intervaloJanela();
    const diffMs = dataFinal.getTime() - dataInicial.getTime();
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    // ~365 dias (pode variar ±1 por horário de verão)
    expect(diffDias).toBeGreaterThan(360);
    expect(diffDias).toBeLessThan(370);
  });

  it("respeita janela personalizada", () => {
    const { dataInicial, dataFinal } = intervaloJanela(6);
    const diffDias =
      (dataFinal.getTime() - dataInicial.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDias).toBeGreaterThan(175);
    expect(diffDias).toBeLessThan(195);
  });
});
