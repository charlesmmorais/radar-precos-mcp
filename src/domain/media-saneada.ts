// ─────────────────────────────────────────────────────────────────────────────
// Algoritmo de Média Saneada
//
// Metodologia:
//   – Execução iterativa com remoção de outliers via Z-score
//   – Critérios de parada: CV ≤ 25% ou mínimo de 3 amostras
//
// Referência: IN SEGES/ME nº 65/2021, Art. 5º
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FontePreco,
  IteracaoMediaSaneada,
  ResultadoMediaSaneada,
} from "./types.js";

/** CV máximo tolerado (IN SEGES/ME nº 65/2021) */
export const CV_MAXIMO = 0.25;

/** Número mínimo de preços para o preço de referência ser válido */
export const MINIMO_PRECOS = 3;

// ─── Funções estatísticas ─────────────────────────────────────────────────────

/** Média aritmética de um array de números */
export function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

/**
 * Desvio padrão amostral (denominador n-1, "DESVPAD" do Excel).
 * Retorna 0 se houver menos de 2 valores.
 */
export function desvpadAmostral(valores: number[]): number {
  if (valores.length < 2) return 0;
  const m = media(valores);
  const soma = valores.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return Math.sqrt(soma / (valores.length - 1));
}

/**
 * Coeficiente de Variação (CV) = desvpad / média.
 * Retorna 0 se média for 0.
 */
export function coeficienteVariacao(valores: number[]): number {
  const m = media(valores);
  if (m === 0) return 0;
  return desvpadAmostral(valores) / m;
}

/**
 * Calcula Z-score de cada valor: (x - média) / desvpad.
 * Retorna array de zeros se desvpad for 0 (todos valores iguais).
 */
export function calcularZScores(valores: number[]): number[] {
  const m = media(valores);
  const dp = desvpadAmostral(valores);
  if (dp === 0) return valores.map(() => 0);
  return valores.map((v) => (v - m) / dp);
}

// ─── Algoritmo principal ──────────────────────────────────────────────────────

/**
 * Aplica a metodologia de Média Saneada sobre uma lista de fontes de preço.
 *
 * Algoritmo (Média Saneada – IN SEGES/ME nº 65/2021):
 *  1. Calcula média, desvpad e CV da amostra atual
 *  2. Se CV ≤ 25% → para (critério 1 atingido)
 *  3. Se amostra.length ≤ 3 → para (critério 2: manter mínimo)
 *  4. Calcula Z-score de cada valor
 *  5. Remove o valor com maior |Z-score| (o outlier mais distante)
 *  6. Volta ao passo 1
 *
 * @param fontes Lista de fontes de preço coletadas
 * @returns Resultado com preço de referência, CV, iterações e alertas
 */
export function mediaSaneada(fontes: FontePreco[]): ResultadoMediaSaneada {
  const alertas: string[] = [];
  const outliersRemovidos: FontePreco[] = [];
  const iteracoes: IteracaoMediaSaneada[] = [];

  if (fontes.length === 0) {
    return {
      precoReferencia: 0,
      cv: 0,
      totalIteracoes: 0,
      iteracoes: [],
      outliers: [],
      precosValidos: [],
      criterioParada: "minimo_amostras",
      conformeCV: false,
      alertas: ["Nenhuma fonte de preço fornecida."],
    };
  }

  if (fontes.length < MINIMO_PRECOS) {
    alertas.push(
      `Apenas ${fontes.length} fonte(s) disponível(is). ` +
        `O mínimo recomendado é ${MINIMO_PRECOS}. ` +
        "O preço de referência deve ser justificado."
    );
  }

  // Índices dos elementos ainda na amostra (mantemos referência às fontes)
  let indices = fontes.map((_, i) => i);

  let criterioParada: "cv_atingido" | "minimo_amostras" = "minimo_amostras";
  let iterNum = 0;

  while (true) {
    iterNum++;
    const valoresAtual = indices.map((i) => fontes[i].valorUnitario);
    const m = media(valoresAtual);
    const dp = desvpadAmostral(valoresAtual);
    const cv = coeficienteVariacao(valoresAtual);
    const zscores = calcularZScores(valoresAtual);

    // Critério 1: CV dentro do limite aceitável
    if (cv <= CV_MAXIMO) {
      iteracoes.push({
        numero: iterNum,
        amostra: valoresAtual,
        media: m,
        desvpad: dp,
        cv,
        zscores,
        criterioParada: "cv_atingido",
      });
      criterioParada = "cv_atingido";
      break;
    }

    // Critério 2: não remover mais se restar apenas o mínimo
    if (indices.length <= MINIMO_PRECOS) {
      iteracoes.push({
        numero: iterNum,
        amostra: valoresAtual,
        media: m,
        desvpad: dp,
        cv,
        zscores,
        criterioParada: "minimo_amostras",
      });
      criterioParada = "minimo_amostras";

      if (cv > CV_MAXIMO) {
        alertas.push(
          `CV final de ${(cv * 100).toFixed(2)}% supera o limite de ` +
            `${(CV_MAXIMO * 100).toFixed(0)}% mesmo ` +
            "após remoção de outliers. Justificativa adicional necessária."
        );
      }
      break;
    }

    // Identifica o índice com maior |Z-score|
    const maxZAbs = Math.max(...zscores.map(Math.abs));
    const posOutlier = zscores.findIndex((z) => Math.abs(z) === maxZAbs);
    const outlierValor = valoresAtual[posOutlier];
    const outlierFonteIdx = indices[posOutlier];

    iteracoes.push({
      numero: iterNum,
      amostra: valoresAtual,
      media: m,
      desvpad: dp,
      cv,
      zscores,
      outlierRemovido: outlierValor,
    });

    outliersRemovidos.push(fontes[outlierFonteIdx]);
    indices = indices.filter((_, pos) => pos !== posOutlier);
  }

  const precosValidos = indices.map((i) => fontes[i]);
  const valoresFinais = precosValidos.map((f) => f.valorUnitario);
  const cvFinal = coeficienteVariacao(valoresFinais);
  const precoReferencia = media(valoresFinais);

  if (precosValidos.length < MINIMO_PRECOS) {
    alertas.push(
      `Preço de referência calculado com apenas ${precosValidos.length} fonte(s). ` +
        "Verificar necessidade de buscar mais cotações."
    );
  }

  return {
    precoReferencia,
    cv: cvFinal,
    totalIteracoes: iteracoes.length,
    iteracoes,
    outliers: outliersRemovidos,
    precosValidos,
    criterioParada,
    conformeCV: cvFinal <= CV_MAXIMO,
    alertas,
  };
}

// ─── Utilidades de formatação ─────────────────────────────────────────────────

/** Formata valor monetário em R$ */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/** Formata percentual */
export function formatarPercentual(decimal: number): string {
  return `${(decimal * 100).toFixed(2)}%`;
}

/**
 * Deflaciona um preço histórico para a data base usando variação do IPCA.
 * Fórmula: precoAtualizado = precoOriginal × (1 + variacaoIPCA)
 *
 * @param precoOriginal Preço na data de origem
 * @param variacaoIPCA Variação acumulada do IPCA entre data origem e data base (decimal)
 */
export function deflacionar(
  precoOriginal: number,
  variacaoIPCA: number
): number {
  return precoOriginal * (1 + variacaoIPCA);
}
