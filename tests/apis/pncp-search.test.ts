// ─────────────────────────────────────────────────────────────────────────────
// Testes unitários – pncp-search (endpoint /api/search/)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { parseNumeroControle } from "../../src/apis/pncp-search.js";

// ─── parseNumeroControle ──────────────────────────────────────────────────────

describe("parseNumeroControle()", () => {
  it("parseia numero de controle valido", () => {
    const result = parseNumeroControle("33683111000107-1-000072/2026");
    expect(result).toEqual({ cnpj: "33683111000107", seq: "000072", ano: "2026" });
  });

  it("retorna null para formato invalido", () => {
    expect(parseNumeroControle("invalido")).toBeNull();
    expect(parseNumeroControle("")).toBeNull();
    expect(parseNumeroControle("123-1-456")).toBeNull();
  });

  it("parseia numeros de sequencial com zeros a esquerda", () => {
    const result = parseNumeroControle("00394460000141-1-000001/2025");
    expect(result).toEqual({ cnpj: "00394460000141", seq: "000001", ano: "2025" });
  });

  it("retorna null se CNPJ tiver menos de 14 digitos", () => {
    expect(parseNumeroControle("1234567890-1-000001/2025")).toBeNull();
  });

  it("parseia sequencial de 1 digito", () => {
    const result = parseNumeroControle("33683111000107-1-1/2025");
    expect(result).toEqual({ cnpj: "33683111000107", seq: "1", ano: "2025" });
  });

  it("aceita modalidade diferente de 1", () => {
    const result = parseNumeroControle("33683111000107-8-000010/2026");
    expect(result).toEqual({ cnpj: "33683111000107", seq: "000010", ano: "2026" });
  });
});
