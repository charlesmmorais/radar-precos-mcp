// ─────────────────────────────────────────────────────────────────────────────
// Constantes e validações – pesquisa de preços em contratações públicas
// Referência: IN SEGES/ME nº 65/2021
// ─────────────────────────────────────────────────────────────────────────────

import type { FontePreco, FonteTipo } from "./types.js";

/** Janela de validade das fontes primárias: 12 meses */
export const JANELA_FONTES_PRINCIPAIS_MESES = 12;

/** Janela de validade das fontes secundárias: 6 meses */
export const JANELA_FONTES_SECUNDARIAS_MESES = 6;

/** CV máximo para aprovação sem ressalva (IN SEGES/ME nº 65/2021) */
export const CV_LIMITE = 0.25;

/** Mínimo de preços para compor a amostra */
export const MINIMO_AMOSTRAS = 3;

/**
 * Hierarquia de fontes conforme IN SEGES/ME nº 65/2021, Art. 5º.
 * Fontes com prioridade mais alta devem ser buscadas primeiro.
 */
export const HIERARQUIA_FONTES: Record<FonteTipo, number> = {
  pncp_contratacao: 1,
  pncp_contrato: 1,
  compras_contrato: 1,
  painel_precos: 1,
  contrato_orgao: 2,
  midia_especializada: 3,
  cotacao_fornecedor: 4,
};

/**
 * Labels descritivos de cada tipo de fonte para uso nos relatórios.
 */
export const LABELS_FONTE: Record<FonteTipo, string> = {
  pncp_contratacao:
    "Portal Nacional de Contratações Públicas (PNCP) – Licitações",
  pncp_contrato: "Portal Nacional de Contratações Públicas (PNCP) – Contratos",
  compras_contrato: "Compras.gov.br / Contratos.gov.br",
  painel_precos: "Painel de Preços – MPOG",
  contrato_orgao: "Contratação anterior do próprio órgão",
  midia_especializada: "Mídia especializada / Tabela de referência",
  cotacao_fornecedor: "Cotação direta com fornecedor",
};

/**
 * URLs dos sistemas oficiais utilizados na pesquisa.
 */
export const URLS_SISTEMAS = {
  pncp_contratos:
    "https://pncp.gov.br/app/contratos?q=&status=vigente&pagina=1",
  comprasnet: "http://comprasnet.gov.br/ConsultaLicitacoes/ConsLicitacao_texto.asp",
  transparencia_contratos: "https://contratos.comprasnet.gov.br/transparencia#",
  dou: "https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados",
  catalogo_tic:
    "https://www.gov.br/governodigital/pt-br/contratacoes/catalogo-de-solucoes-de-tic",
  banco_precos: "https://www.bancodeprecos.com.br",
};

/**
 * Verifica se uma fonte de preço está dentro da janela de validade
 * conforme a IN SEGES/ME nº 65/2021.
 *
 * @param fonte Fonte de preço a verificar
 * @param dataBase Data base de referência (padrão: hoje)
 * @returns true se a fonte está dentro da janela válida
 */
export function dentroDaJanela(
  fonte: FontePreco,
  dataBase?: Date
): boolean {
  const base = dataBase ?? new Date();
  const dataFonte = new Date(fonte.dataContrato);

  const mesesPermitidos = [
    "pncp_contratacao",
    "pncp_contrato",
    "compras_contrato",
    "painel_precos",
    "contrato_orgao",
  ].includes(fonte.fonte)
    ? JANELA_FONTES_PRINCIPAIS_MESES
    : JANELA_FONTES_SECUNDARIAS_MESES;

  const limiteAnterior = new Date(base);
  limiteAnterior.setMonth(limiteAnterior.getMonth() - mesesPermitidos);

  return dataFonte >= limiteAnterior && dataFonte <= base;
}

/**
 * Valida a série de preços e retorna alertas conforme IN SEGES/ME nº 65/2021.
 */
export function validarSerie(fontes: FontePreco[]): string[] {
  const alertas: string[] = [];

  if (fontes.length === 0) {
    alertas.push("Nenhuma fonte de preço coletada.");
    return alertas;
  }

  if (fontes.length < MINIMO_AMOSTRAS) {
    alertas.push(
      `Série contém apenas ${fontes.length} preço(s). ` +
        `O mínimo recomendado é ${MINIMO_AMOSTRAS}.`
    );
  }

  const fora = fontes.filter((f) => !dentroDaJanela(f));
  if (fora.length > 0) {
    alertas.push(
      `${fora.length} fonte(s) fora da janela de validade: ` +
        fora.map((f) => f.id).join(", ")
    );
  }

  const apenasSecundarias = fontes.every(
    (f) => !["pncp_contratacao", "pncp_contrato", "compras_contrato", "painel_precos"].includes(f.fonte)
  );
  if (apenasSecundarias && fontes.length > 0) {
    alertas.push(
      "Nenhuma fonte primária (sistemas oficiais de governo) encontrada. " +
        "Justificar ausência conforme IN SEGES/ME nº 65/2021, Art. 5º."
    );
  }

  return alertas;
}

/**
 * Gera o texto padrão de conclusão do relatório.
 */
export function gerarTextoConclusao(
  encontrouFontesSimilares: boolean,
  justificativaAusencia?: string
): string {
  if (encontrouFontesSimilares) {
    return (
      "Foi possível realizar uma análise comparativa entre os preços coletados " +
      "com processos com objeto similar de outros entes públicos, propostas dos " +
      "fornecedores e Painel de Preços do Ministério da Economia. Concluímos assim, " +
      "que os valores definidos para as referências de preços representam o melhor " +
      "cenário e está alinhado com a seleção da proposta mais vantajosa pela " +
      "Administração e está apto para demonstrar a razoabilidade e compatibilidade " +
      "com os valores padrões de mercado. Na fixação dos valores do objeto contratual " +
      "foram observadas condutas de modo a afastar o sobrepreço e o superfaturamento, " +
      "nos termos fixados nos incisos I e II do § 1º do art. 31 da Lei nº 13.303/16."
    );
  }

  const motivo = justificativaAusencia ?? "não foram identificados processos com objeto similar";
  return (
    `Não foi possível realizar uma análise comparativa entre os preços do ` +
    `contrato com processos com objeto similar de outros entes públicos, ` +
    `tendo em vista que ${motivo}.`
  );
}
