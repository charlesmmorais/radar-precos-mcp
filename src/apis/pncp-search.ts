// ─────────────────────────────────────────────────────────────────────────────
// Cliente do endpoint de busca textual do PNCP
// URL: https://pncp.gov.br/api/search/
// NOTA: endpoint não-documentado, descoberto por engenharia reversa do portal
//       pncp.gov.br. Sujeito a alteração sem aviso pelo SERPRO/PNCP.
// Referência: IN SEGES/ME nº 65/2021
// ─────────────────────────────────────────────────────────────────────────────

import { criarClienteHttp, sleep } from "../utils/http.js";
import { agora, intervaloJanela } from "../utils/date.js";
import type { FontePreco } from "../domain/types.js";

const SEARCH_URL = "https://pncp.gov.br/api/search";
const INTEGRA_URL = "https://pncp.gov.br/api/pncp";

const clienteSearch = criarClienteHttp(SEARCH_URL, 30_000);
const clienteIntegra = criarClienteHttp(INTEGRA_URL, 30_000);

// ─── Tipos da API /api/search/ ────────────────────────────────────────────────

export type TipoDocumentoPNCP = "edital" | "ata" | "contrato";
export type StatusPNCP =
  | "recebendo_proposta"   // editais abertos
  | "propostas_encerradas" // em julgamento
  | "encerradas"           // homologados
  | "vigente";             // atas/contratos vigentes

export interface PNCPSearchItem {
  id?: string;
  title?: string;
  description?: string;
  item_url?: string;
  document_type?: TipoDocumentoPNCP;
  numero_controle_pncp?: string;
  orgao_cnpj?: string;
  orgao_nome?: string;
  uf?: string;
  municipio_nome?: string;
  modalidade_licitacao_nome?: string;
  data_inicio_vigencia?: string;
  data_fim_vigencia?: string;
  data_assinatura?: string;
  data_publicacao_pncp?: string;
  valor_global?: number;
  cancelado?: boolean;
}

interface PNCPSearchResponse {
  items: PNCPSearchItem[];
  total: number;
}

// ─── Tipos da API /api/pncp (integra) ────────────────────────────────────────

interface PNCPItemIntegra {
  numeroItem: number;
  descricao?: string;
  quantidade?: number;
  unidadeMedida?: string;
  valorUnitarioEstimado?: number;
  valorUnitarioHomologado?: number;
  codigoCatalogoCMPF?: string;
}

interface PNCPResultadoItem {
  niFornecedor?: string;
  nomeFornecedor?: string;
  valorUnitario?: number;
  quantidadeHomologada?: number;
  descricaoObjeto?: string;
}

// ─── Parâmetros de busca ──────────────────────────────────────────────────────

export interface BuscaTextoParams {
  /** Termos para busca textual */
  termoBusca: string;
  /** Tipo de documento a buscar */
  tipoDocumento: TipoDocumentoPNCP;
  /** Status de filtragem (padrão: vigente para ata/contrato, encerradas para edital) */
  status?: StatusPNCP;
  /** UF para filtrar */
  uf?: string;
  /** Código de modalidade (6=Pregão, 8=Dispensa, etc.) */
  modalidade?: number;
  /** Página (padrão: 1) */
  pagina?: number;
  /** Itens por página (padrão: 15) */
  tamanhoPagina?: number;
  /** Filtro client-side de janela temporal em meses (padrão: 12) */
  janelasMeses?: number;
  /** Máximo de FontePreco a retornar após extração de preços */
  limite?: number;
  /** Código CATMAT/CATSER para filtro fino dos itens */
  codigoMaterial?: string;
}

// ─── Funções auxiliares ───────────────────────────────────────────────────────

/**
 * Parseia numero_controle_pncp no formato "CNPJ-1-SEQUENCIAL/ANO"
 * e retorna { cnpj, ano, seq } para uso na API integra.
 */
export function parseNumeroControle(
  numero: string
): { cnpj: string; ano: string; seq: string } | null {
  // Formato esperado: 14dígitos-1-SEQUENCIAL/ANO
  const match = numero.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  if (!match) return null;
  return { cnpj: match[1], seq: match[2], ano: match[3] };
}

/** Verifica se uma data ISO está dentro da janela temporal */
function dentroJanela(dataISO: string | undefined, dataInicial: Date): boolean {
  if (!dataISO) return true; // dúvida → mantém
  const data = new Date(dataISO.substring(0, 10));
  return data >= dataInicial;
}

/** Verifica correspondência de termos (case-insensitive, todos devem bater) */
function matchTermos(texto: string | undefined, termos: string[]): boolean {
  if (!texto || termos.length === 0) return true;
  const lower = texto.toLowerCase();
  return termos.every((t) => lower.includes(t.toLowerCase()));
}

function extrairTermos(termoBusca: string): string[] {
  const regex = /"([^"]+)"|(\S+)/g;
  const termos: string[] = [];
  let m;
  while ((m = regex.exec(termoBusca)) !== null) termos.push(m[1] ?? m[2]);
  return termos.filter(Boolean);
}

function gerarId(prefixo: string, ref: string): string {
  return `${prefixo}-${ref.replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)}`;
}

// ─── Passo 1: busca textual ───────────────────────────────────────────────────

/**
 * Chama GET /api/search/ e retorna os itens brutos dentro da janela temporal.
 * Aplica filtro de janelasMeses client-side (o endpoint não suporta filtro de data).
 */
export async function buscarPNCPTexto(
  params: BuscaTextoParams
): Promise<{ items: PNCPSearchItem[]; total: number }> {
  const {
    termoBusca,
    tipoDocumento,
    status,
    uf,
    modalidade,
    pagina = 1,
    tamanhoPagina = 15,
    janelasMeses = 12,
  } = params;

  const { dataInicial } = intervaloJanela(janelasMeses);

  const queryParams: Record<string, string | number> = {
    q: termoBusca,
    tipos_documento: tipoDocumento,
    ordenacao: "-data",
    pagina,
    tam_pagina: tamanhoPagina,
  };

  if (status) queryParams.status = status;
  if (uf) queryParams.uf = uf.toLowerCase();
  if (modalidade) queryParams.modalidade = modalidade;

  const resp = await clienteSearch.get<PNCPSearchResponse>("/", {
    params: queryParams,
  });

  const body = resp.data ?? { items: [], total: 0 };

  // Filtro client-side de janela temporal
  const itensFiltrados = (body.items ?? []).filter((item) => {
    const data = item.data_assinatura ?? item.data_publicacao_pncp ?? item.data_inicio_vigencia;
    return dentroJanela(data, dataInicial);
  });

  return { items: itensFiltrados, total: body.total ?? 0 };
}

// ─── Passo 2: extração de preços unitários ────────────────────────────────────

/**
 * Para cada item de busca, consulta a API integra PNCP para obter
 * preços unitários por item. Retorna lista de FontePreco prontas.
 */
export async function extrairPrecosDosResultados(
  itensSearch: PNCPSearchItem[],
  params: {
    termoBusca: string;
    tipoDocumento: TipoDocumentoPNCP;
    codigoMaterial?: string;
    limite?: number;
  }
): Promise<FontePreco[]> {
  const { termoBusca, tipoDocumento, codigoMaterial, limite = 30 } = params;
  const termos = extrairTermos(termoBusca);
  const dataConsulta = agora();
  const fontes: FontePreco[] = [];

  for (const itemSearch of itensSearch) {
    if (fontes.length >= limite) break;
    if (!itemSearch.numero_controle_pncp) continue;
    if (itemSearch.cancelado) continue;

    const parsed = parseNumeroControle(itemSearch.numero_controle_pncp);
    if (!parsed) continue;

    const { cnpj, ano, seq } = parsed;

    try {
      // Busca itens da contratação/ata/contrato
      const itensResp = await clienteIntegra.get<PNCPItemIntegra[]>(
        `/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`,
        { params: { pagina: 1, tamanhoPagina: 100 } }
      );

      const itens: PNCPItemIntegra[] = Array.isArray(itensResp.data)
        ? itensResp.data
        : [];

      for (const item of itens) {
        if (fontes.length >= limite) break;

        // Filtro por codigoMaterial (CATMAT/CATSER) se fornecido
        if (codigoMaterial && item.codigoCatalogoCMPF) {
          if (!item.codigoCatalogoCMPF.includes(codigoMaterial)) continue;
        }

        // Filtro textual no item
        if (!matchTermos(item.descricao, termos)) continue;

        let valorUnitario = 0;

        if (tipoDocumento === "edital" || tipoDocumento === "ata") {
          // Para editais e atas, busca resultado homologado (preço vencedor)
          try {
            const resultResp = await clienteIntegra.get<PNCPResultadoItem[]>(
              `/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens/${item.numeroItem}/resultados`,
              { params: { pagina: 1, tamanhoPagina: 10 } }
            );
            const resultados: PNCPResultadoItem[] = Array.isArray(resultResp.data)
              ? resultResp.data
              : [];
            // Pega o menor valor homologado (vencedor)
            const menorValor = resultados
              .map((r) => r.valorUnitario ?? 0)
              .filter((v) => v > 0)
              .sort((a, b) => a - b)[0];
            valorUnitario = menorValor ?? item.valorUnitarioHomologado ?? item.valorUnitarioEstimado ?? 0;
          } catch {
            valorUnitario = item.valorUnitarioHomologado ?? item.valorUnitarioEstimado ?? 0;
          }
          await sleep(150);
        } else {
          // Para contratos, usa valor homologado ou estimado diretamente
          valorUnitario = item.valorUnitarioHomologado ?? item.valorUnitarioEstimado ?? 0;
        }

        if (valorUnitario <= 0) continue;

        const dataContrato =
          itemSearch.data_assinatura?.substring(0, 10) ??
          itemSearch.data_publicacao_pncp?.substring(0, 10) ??
          itemSearch.data_inicio_vigencia?.substring(0, 10) ??
          new Date().toISOString().substring(0, 10);

        const fonteTipo = tipoDocumento === "contrato"
          ? "pncp_contrato"
          : "pncp_contratacao";

        fontes.push({
          id: gerarId(
            `pncp-${tipoDocumento.substring(0, 2)}`,
            `${itemSearch.numero_controle_pncp ?? "?"}-${item.numeroItem}`
          ),
          fonte: fonteTipo,
          numeroReferencia: `${itemSearch.numero_controle_pncp} – Item ${item.numeroItem}`,
          descricaoObjeto:
            item.descricao ??
            itemSearch.description ??
            itemSearch.title ??
            "",
          valorUnitario,
          unidadeMedida: item.unidadeMedida ?? "UN",
          dataContrato,
          orgao: itemSearch.orgao_nome ?? "Não informado",
          uf: itemSearch.uf?.toUpperCase(),
          urlReferencia: itemSearch.item_url
            ? `https://pncp.gov.br${itemSearch.item_url}`
            : undefined,
          termosBusca: termoBusca,
          dataConsulta,
          observacao: `Tipo: ${tipoDocumento}`,
        });
      }
    } catch {
      // Item inacessível — ignora silenciosamente
    }

    await sleep(200);
  }

  return fontes;
}

// ─── Função principal combinada ───────────────────────────────────────────────

/**
 * Busca preços no PNCP usando o endpoint de busca textual e extrai
 * preços unitários via API integra. Resolve o timeout da API REST oficial.
 *
 * Fluxo:
 *   /api/search/ (busca indexada) → numero_controle_pncp[]
 *     → /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens
 *       → /api/pncp/v1/…/itens/{num}/resultados (para editais/atas)
 *         → FontePreco[]
 */
export async function buscarPrecosPNCPTexto(
  params: BuscaTextoParams
): Promise<FontePreco[]> {
  const { tipoDocumento, limite = 20 } = params;

  // Define status padrão por tipo de documento
  const statusDefault: StatusPNCP =
    tipoDocumento === "edital" ? "encerradas" : "vigente";

  const paramsComStatus: BuscaTextoParams = {
    status: statusDefault,
    ...params,
  };

  const { items } = await buscarPNCPTexto(paramsComStatus);

  if (items.length === 0) return [];

  return extrairPrecosDosResultados(items, {
    termoBusca: params.termoBusca,
    tipoDocumento,
    codigoMaterial: params.codigoMaterial,
    limite,
  });
}
