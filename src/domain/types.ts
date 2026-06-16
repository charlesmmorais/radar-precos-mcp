// ─────────────────────────────────────────────────────────────────────────────
// Tipos de domínio – radar-precos-mcp
// Referência: IN SEGES/ME nº 65/2021
// ─────────────────────────────────────────────────────────────────────────────

/** Fontes válidas de preço conforme hierarquia da IN SEGES/ME nº 65/2021 */
export type FonteTipo =
  | "pncp_contrato"       // I – sistemas oficiais de governo (PNCP contratos)
  | "pncp_contratacao"    // I – sistemas oficiais de governo (PNCP licitações)
  | "compras_contrato"    // I/II – Compras.gov.br / ComprasNet
  | "painel_precos"       // I – Painel de Preços MPOG
  | "contrato_orgao"      // III – contratação anterior do próprio órgão
  | "midia_especializada" // IV – mídia especializada / tabela aprovada
  | "cotacao_fornecedor"; // V – cotação direta com fornecedor

/** Uma entrada de preço coletada de qualquer fonte */
export interface FontePreco {
  /** Identificador único gerado internamente */
  id: string;
  /** Tipo/origem da fonte */
  fonte: FonteTipo;
  /** Número do contrato ou processo licitatório */
  numeroReferencia?: string;
  /** Descrição do objeto contratado */
  descricaoObjeto: string;
  /** Valor unitário em R$ */
  valorUnitario: number;
  /** Unidade de medida */
  unidadeMedida: string;
  /** Data de assinatura ou publicação (YYYY-MM-DD) */
  dataContrato: string;
  /** Nome do órgão contratante */
  orgao: string;
  /** UF do órgão */
  uf?: string;
  /** URL de referência para evidência */
  urlReferencia?: string;
  /** Termos utilizados na busca */
  termosBusca?: string;
  /** Data/hora da consulta (ISO 8601) */
  dataConsulta: string;
  /** Observações livres */
  observacao?: string;
}

/** Uma iteração do algoritmo de média saneada */
export interface IteracaoMediaSaneada {
  numero: number;
  /** Preços presentes nesta iteração (após remoção de outliers anteriores) */
  amostra: number[];
  media: number;
  desvpad: number;
  /** Coeficiente de Variação em decimal (0.25 = 25%) */
  cv: number;
  /** Z-scores de cada valor */
  zscores: number[];
  /** Valor removido nesta iteração (se houver) */
  outlierRemovido?: number;
  /** Motivo de parada desta iteração (se for a última) */
  criterioParada?: "cv_atingido" | "minimo_amostras";
}

/** Resultado completo do cálculo de preço de referência */
export interface ResultadoMediaSaneada {
  /** Preço de referência final (média da amostra saneada) */
  precoReferencia: number;
  /** CV final em decimal */
  cv: number;
  /** Número de iterações realizadas */
  totalIteracoes: number;
  /** Histórico de todas as iterações */
  iteracoes: IteracaoMediaSaneada[];
  /** Fontes descartadas como outliers */
  outliers: FontePreco[];
  /** Fontes que compõem o preço de referência */
  precosValidos: FontePreco[];
  /** Critério de parada atingido */
  criterioParada: "cv_atingido" | "minimo_amostras";
  /** true se CV final ≤ 25% (dentro do limite aceitável) */
  conformeCV: boolean;
  /** Alertas e avisos */
  alertas: string[];
}

/** Resultado da verificação no Catálogo de Soluções de TIC */
export interface CatalogoTICResult {
  encontrado: boolean;
  link: string;
  dataConsulta: string;
  precoMaximo?: number;
  observacao: string;
}

/** Parâmetros de entrada da pesquisa de preços */
export interface ParamsPesquisa {
  /** Descrição do objeto da contratação */
  objeto: string;
  /** Código CATMAT ou CATSER (opcional) */
  codigoMaterial?: string;
  /** Unidade de medida */
  unidadeMedida: string;
  /** Quantidade estimada */
  quantidade: number;
  /**
   * Data base para deflação de preços históricos (YYYY-MM-DD).
   * Usa hoje se não informado.
   */
  dataBase?: string;
  /**
   * Janela de busca em meses (padrão: 12).
   * IN SEGES 65/2021 limita a 12 meses para fontes I/II/III.
   */
  janelasMeses?: number;
  /** UF para filtrar resultados */
  uf?: string;
  /** Termos adicionais para busca textual */
  termosAdicionais?: string[];
  /** Modalidade PNCP (6=Pregão Eletrônico, 8=Dispensa, etc.) */
  codigoModalidade?: number;
}

/** Resultado completo da pesquisa de preços */
export interface PesquisaPrecos {
  params: ParamsPesquisa;
  fontes: {
    pncp: FontePreco[];
    compras: FontePreco[];
    catalogoTIC: CatalogoTICResult;
    cotacoesFornecedores: FontePreco[];
    midiasEspecializadas: FontePreco[];
    contratosOrgao: FontePreco[];
  };
  /** Série completa antes da saneação */
  serieCompleta: number[];
  analise: ResultadoMediaSaneada;
  /** Data/hora da pesquisa */
  dataHoraPesquisa: string;
  /** Campos que requerem preenchimento humano */
  pendenciasHumanas: string[];
}

// ─── Tipos de resposta da API PNCP ───────────────────────────────────────────

export interface PNCPPaginado<T> {
  data: T[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}

export interface PNCPContrato {
  numeroContratoEmpenho?: string;
  numeroControlePNCP?: string;
  numeroControlePNCPCompra?: string;
  orgaoEntidade?: {
    cnpj: string;
    razaoSocial: string;
    municipioNome?: string;
    ufSigla?: string;
  };
  objetoContrato?: string;
  valorInicial?: number;
  valorGlobal?: number;
  dataAssinatura?: string;
  dataVigenciaInicio?: string;
  dataVigenciaFim?: string;
  niFornecedor?: string;
  nomeFornecedor?: string;
  tipoPessoa?: string;
  tipoContrato?: { id: number; nome: string };
  situacaoContrato?: { nome: string };
  porteEmpresa?: { id: number; nome: string };
  linkSistemaOrigem?: string;
}

export interface PNCPContratacao {
  numeroControlePNCP?: string;
  orgaoEntidade?: {
    cnpj: string;
    razaoSocial: string;
    municipioNome?: string;
    ufSigla?: string;
  };
  objetoCompra?: string;
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  dataPublicacaoPncp?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  modalidadeNome?: string;
  situacaoCompraNome?: string;
  linkSistemaOrigem?: string;
}

export interface PNCPItem {
  numeroItem: number;
  descricao?: string;
  quantidade?: number;
  unidadeMedida?: string;
  valorUnitarioEstimado?: number;
  valorUnitarioHomologado?: number;
}

// ─── Tipos de resposta Compras.gov.br ────────────────────────────────────────

export interface ComprasContrato {
  id?: number;
  numero?: string;
  objeto?: string;
  valorInicialCompra?: number;
  dataAssinatura?: string;
  dataVigenciaFim?: string;
  fornecedorNome?: string;
  fornecedorCnpj?: string;
  uasgNome?: string;
  uasgCodigo?: string;
  uf?: string;
  linkSistemaOrigem?: string;
}

// ─── Tabelas de domínio PNCP ─────────────────────────────────────────────────

export const MODALIDADES_PNCP: Record<number, string> = {
  1: "Leilão Eletrônico",
  2: "Diálogo Competitivo",
  3: "Concurso",
  4: "Concorrência Eletrônica",
  5: "Concorrência Presencial",
  6: "Pregão Eletrônico",
  7: "Pregão Presencial",
  8: "Dispensa de Licitação",
  9: "Inexigibilidade",
  10: "Manifestação de Interesse",
  11: "Pré-qualificação",
  12: "Credenciamento",
  13: "Leilão Presencial",
};

export const SITUACAO_CONTRATACAO: Record<number, string> = {
  1: "Divulgada no PNCP",
  2: "Revogada",
  3: "Anulada",
  4: "Suspensa",
};
