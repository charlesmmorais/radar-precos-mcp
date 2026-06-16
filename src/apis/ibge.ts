// ─────────────────────────────────────────────────────────────────────────────
// Cliente da API do IBGE – IPCA (deflação de preços históricos)
// https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos
// ─────────────────────────────────────────────────────────────────────────────

import { criarClienteHttp } from "../utils/http.js";

const BASE_URL = "https://servicodados.ibge.gov.br/api/v3";
const cliente = criarClienteHttp(BASE_URL, 30_000);

/** Variação mensal do IPCA para um determinado mês/ano */
export interface VariacaoIPCA {
  periodo: string; // "YYYYMM"
  variacao: number; // decimal (0.005 = 0.5%)
}

interface IBGEResultado {
  id: string;
  resultados: Array<{
    series: Array<{
      localidade: { id: string };
      serie: Record<string, string>;
    }>;
  }>;
}

/**
 * Busca variação mensal do IPCA para o período informado.
 * @param anoMesInicio Formato "YYYYMM"
 * @param anoMesFim Formato "YYYYMM"
 */
export async function buscarIPCA(
  anoMesInicio: string,
  anoMesFim: string
): Promise<VariacaoIPCA[]> {
  // Código 1737 = IPCA - Variação mensal (%)
  // Variável 2266 = IPCA variação mensal
  // Localidade 1 = Brasil
  const url = `/agregados/1737/periodos/${anoMesInicio}-${anoMesFim}/variaveis/2266?localidades=N1[1]`;

  const resp = await cliente.get<IBGEResultado[]>(url);
  const dados = resp.data;

  if (!dados?.length || !dados[0].resultados?.length) return [];

  const serie = dados[0].resultados[0]?.series[0]?.serie ?? {};
  return Object.entries(serie).map(([periodo, variacao]) => ({
    periodo,
    variacao: parseFloat(variacao) / 100,
  }));
}

/**
 * Calcula a variação acumulada do IPCA entre duas datas.
 * Usado para deflacionar preços históricos.
 *
 * @param dataOrigem Data do preço histórico (YYYY-MM-DD)
 * @param dataBase Data base para deflação (YYYY-MM-DD)
 * @returns Variação acumulada em decimal (e.g., 0.15 = 15%)
 */
export async function calcularVariacaoAcumulada(
  dataOrigem: string,
  dataBase: string
): Promise<number> {
  const inicio = dataOrigem.substring(0, 7).replace("-", ""); // YYYYMM
  const fim = dataBase.substring(0, 7).replace("-", ""); // YYYYMM

  if (inicio >= fim) return 0;

  try {
    const variacoes = await buscarIPCA(inicio, fim);
    // Produto das variações mensais: (1+v1) × (1+v2) × ... - 1
    const acumulado = variacoes.reduce(
      (acc, { variacao }) => acc * (1 + variacao),
      1
    );
    return acumulado - 1;
  } catch {
    return 0; // Sem deflação se API indisponível
  }
}
