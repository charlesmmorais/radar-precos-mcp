// ─────────────────────────────────────────────────────────────────────────────
// Utilitários de data
// ─────────────────────────────────────────────────────────────────────────────

/** Formata Date para o formato PNCP: AAAAMMDD */
export function toDataPNCP(data: Date): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${a}${m}${d}`;
}

/** Formata Date para ISO simples: YYYY-MM-DD */
export function toDataISO(data: Date): string {
  return data.toISOString().split("T")[0];
}

/** Subtrai N meses de uma data */
export function subtrairMeses(data: Date, meses: number): Date {
  const resultado = new Date(data);
  resultado.setMonth(resultado.getMonth() - meses);
  return resultado;
}

/**
 * Retorna o intervalo de datas para a janela de busca.
 * @param janelasMeses Quantos meses para trás (padrão: 12)
 */
export function intervaloJanela(janelasMeses = 12): {
  dataInicial: Date;
  dataFinal: Date;
} {
  const dataFinal = new Date();
  const dataInicial = subtrairMeses(dataFinal, janelasMeses);
  return { dataInicial, dataFinal };
}

/** Formata data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/YYYY) */
export function formatarDataBR(dataISO: string): string {
  if (!dataISO || dataISO.length < 10) return dataISO;
  const [ano, mes, dia] = dataISO.substring(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Retorna timestamp ISO 8601 atual */
export function agora(): string {
  return new Date().toISOString();
}

/** Parseia string AAAAMMDD (PNCP) para YYYY-MM-DD */
export function pncpParaISO(dataPNCP: string): string {
  if (!dataPNCP || dataPNCP.length < 8) return dataPNCP;
  const ano = dataPNCP.substring(0, 4);
  const mes = dataPNCP.substring(4, 6);
  const dia = dataPNCP.substring(6, 8);
  return `${ano}-${mes}-${dia}`;
}
