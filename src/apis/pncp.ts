// ─────────────────────────────────────────────────────────────────────────────
// Cliente da API de Consultas do PNCP
// Base URL: https://pncp.gov.br/api/consulta
// Documentação: Manual das APIs de Consultas PNCP v1.0
// ─────────────────────────────────────────────────────────────────────────────

import { criarClienteHttp, sleep } from "../utils/http.js";
import { toDataPNCP, intervaloJanela, agora } from "../utils/date.js";
import type {
  FontePreco,
  PNCPPaginado,
  PNCPContrato,
  PNCPContratacao,
  PNCPItem,
} from "../domain/types.js";

const BASE_URL = "https://pncp.gov.br/api/consulta";
const INTEGRA_URL = "https://pncp.gov.br/api/pncp";

const clienteConsulta = criarClienteHttp(BASE_URL, 90_000);
const clienteIntegra = criarClienteHttp(INTEGRA_URL, 90_000);

// ─── Parâmetros de busca ──────────────────────────────────────────────────────

export interface BuscaContratosParams {
  /** Termos para filtrar por texto no objeto do contrato */
  termoBusca: string;
  /** Janela em meses (padrão: 12) */
  janelasMeses?: number;
  /** UF para filtro */
  uf?: string;
  /** Máximo de resultados a retornar após filtragem textual (padrão: 30) */
  limite?: number;
}

export interface BuscaContratacaoParams {
  termoBusca: string;
  /** Código da modalidade (6=Pregão Eletrônico, 8=Dispensa, etc.) */
  codigoModalidade?: number;
  janelasMeses?: number;
  uf?: string;
  limite?: number;
}

// ─── Funções auxiliares ───────────────────────────────────────────────────────

/** Verifica se o texto do objeto contém os termos de busca (case-insensitive) */
function matchTermos(texto: string | undefined, termos: string[]): boolean {
  if (!texto) return false;
  const lower = texto.toLowerCase();
  return termos.every((t) => lower.includes(t.toLowerCase()));
}

/** Extrai os termos individuais de uma string de busca */
function extrairTermos(termoBusca: string): string[] {
  // Divide por espaço mas respeita frases entre aspas
  const regex = /"([^"]+)"|(\S+)/g;
  const termos: string[] = [];
  let match;
  while ((match = regex.exec(termoBusca)) !== null) {
    termos.push(match[1] ?? match[2]);
  }
  return termos.filter(Boolean);
}

/** Gera ID único para uma fonte */
function gerarId(prefixo: string, referencia: string): string {
  return `${prefixo}-${referencia.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)}`;
}

// ─── Busca de Contratos ───────────────────────────────────────────────────────

/**
 * Busca contratos no PNCP no período especificado e filtra por termo de busca.
 * Endpoint: GET /v1/contratos
 */
export async function buscarContratossPNCP(
  params: BuscaContratosParams
): Promise<FontePreco[]> {
  const {
    termoBusca,
    janelasMeses = 12,
    uf,
    limite = 30,
  } = params;

  const termos = extrairTermos(termoBusca);
  const { dataInicial, dataFinal } = intervaloJanela(janelasMeses);
  const dataConsulta = agora();
  const fontes: FontePreco[] = [];

  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas && fontes.length < limite) {
    const queryParams: Record<string, string | number> = {
      dataInicial: toDataPNCP(dataInicial),
      dataFinal: toDataPNCP(dataFinal),
      pagina,
      tamanhoPagina: 50,
    };

    if (uf) queryParams.uf = uf;

    const resp = await clienteConsulta.get<PNCPPaginado<PNCPContrato>>(
      "/v1/contratos",
      { params: queryParams }
    );

    const body = resp.data;
    totalPaginas = body.totalPaginas || 1;

    for (const contrato of body.data ?? []) {
      const objeto = contrato.objetoContrato ?? "";
      if (!matchTermos(objeto, termos)) continue;

      const valor = contrato.valorGlobal ?? contrato.valorInicial ?? 0;
      if (valor <= 0) continue;

      fontes.push({
        id: gerarId("pncp-ct", contrato.numeroControlePNCP ?? String(pagina)),
        fonte: "pncp_contrato",
        numeroReferencia: contrato.numeroControlePNCP,
        descricaoObjeto: objeto,
        valorUnitario: valor,
        unidadeMedida: "global",
        dataContrato:
          contrato.dataAssinatura?.substring(0, 10) ??
          new Date().toISOString().substring(0, 10),
        orgao: contrato.orgaoEntidade?.razaoSocial ?? "Não informado",
        uf: contrato.orgaoEntidade?.ufSigla,
        urlReferencia: contrato.linkSistemaOrigem,
        termosBusca: termoBusca,
        dataConsulta,
      });

      if (fontes.length >= limite) break;
    }

    if (body.empty || body.paginasRestantes === 0) break;
    pagina++;
    await sleep(300); // Respeitar rate limit
  }

  return fontes;
}

// ─── Busca de Contratações (licitações) com itens ────────────────────────────

/**
 * Busca contratações no PNCP e extrai preços dos itens.
 * Combina: GET /v1/contratacoes/publicacao → GET /v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens
 *
 * Esta abordagem retorna preços unitários por item, muito mais precisos
 * que o valor global do contrato.
 */
export async function buscarContratacoesPNCP(
  params: BuscaContratacaoParams
): Promise<FontePreco[]> {
  const {
    termoBusca,
    codigoModalidade = 6, // Pregão Eletrônico como padrão
    janelasMeses = 12,
    uf,
    limite = 20,
  } = params;

  const termos = extrairTermos(termoBusca);
  const { dataInicial, dataFinal } = intervaloJanela(janelasMeses);
  const dataConsulta = agora();
  const fontes: FontePreco[] = [];

  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas && fontes.length < limite) {
    const queryParams: Record<string, string | number> = {
      dataInicial: toDataPNCP(dataInicial),
      dataFinal: toDataPNCP(dataFinal),
      codigoModalidadeContratacao: codigoModalidade,
      pagina,
      tamanhoPagina: 50,
    };

    if (uf) queryParams.uf = uf;

    const resp = await clienteConsulta.get<PNCPPaginado<PNCPContratacao>>(
      "/v1/contratacoes/publicacao",
      { params: queryParams }
    );

    const body = resp.data;
    totalPaginas = body.totalPaginas || 1;

    for (const contratacao of body.data ?? []) {
      if (!matchTermos(contratacao.objetoCompra, termos)) continue;
      if (!contratacao.numeroControlePNCP) continue;

      // Extrai CNPJ, ano e sequencial do número de controle
      // Formato: CNPJ-1-SEQUENTIAL/YEAR
      const partes = contratacao.numeroControlePNCP.split("-");
      if (partes.length < 3) continue;

      const cnpj = partes[0];
      const parteSeqAno = partes[2]; // "SEQUENTIAL/YEAR"
      const [seqStr, anoStr] = parteSeqAno.split("/");

      if (!cnpj || !seqStr || !anoStr) continue;

      // Busca os itens da contratação para obter preços unitários
      try {
        const itensResp = await clienteIntegra.get<PNCPItem[]>(
          `/v1/orgaos/${cnpj}/compras/${anoStr}/${seqStr}/itens`,
          { params: { pagina: 1, tamanhoPagina: 100 } }
        );

        for (const item of itensResp.data ?? []) {
          const valorUnitario =
            item.valorUnitarioHomologado ??
            item.valorUnitarioEstimado ??
            0;

          if (valorUnitario <= 0) continue;
          if (!matchTermos(item.descricao, termos)) continue;

          fontes.push({
            id: gerarId(
              "pncp-lc",
              `${contratacao.numeroControlePNCP}-${item.numeroItem}`
            ),
            fonte: "pncp_contratacao",
            numeroReferencia: `${contratacao.numeroControlePNCP} – Item ${item.numeroItem}`,
            descricaoObjeto:
              item.descricao ?? contratacao.objetoCompra ?? "",
            valorUnitario,
            unidadeMedida: item.unidadeMedida ?? "UN",
            dataContrato:
              contratacao.dataPublicacaoPncp?.substring(0, 10) ??
              new Date().toISOString().substring(0, 10),
            orgao: contratacao.orgaoEntidade?.razaoSocial ?? "Não informado",
            uf: contratacao.orgaoEntidade?.ufSigla,
            urlReferencia: contratacao.linkSistemaOrigem,
            termosBusca: termoBusca,
            dataConsulta,
          });

          if (fontes.length >= limite) break;
        }
      } catch {
        // Contratação pode não ter itens acessíveis – ignorar silenciosamente
      }

      if (fontes.length >= limite) break;
      await sleep(200);
    }

    if (body.empty || body.paginasRestantes === 0) break;
    pagina++;
    await sleep(300);
  }

  return fontes;
}
