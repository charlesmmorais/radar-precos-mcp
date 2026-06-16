// ─────────────────────────────────────────────────────────────────────────────
// Cliente da API Compras.gov.br / Transparência Contratos
// Endpoint: https://contratos.comprasnet.gov.br/api
// ─────────────────────────────────────────────────────────────────────────────

import { criarClienteHttp, sleep } from "../utils/http.js";
import { agora, intervaloJanela } from "../utils/date.js";
import type { FontePreco } from "../domain/types.js";

const BASE_URL = "https://contratos.comprasnet.gov.br/api";
const cliente = criarClienteHttp(BASE_URL, 60_000);

export interface BuscaComprasParams {
  termoBusca: string;
  /** CNPJ do órgão (sem formatação) – opcional */
  cnpjOrgao?: string;
  janelasMeses?: number;
  uf?: string;
  limite?: number;
}

interface ComprasContratoRaw {
  id?: number;
  numero?: string;
  objeto?: string;
  valor_inicial?: number;
  valor_global?: number;
  data_assinatura?: string;
  data_vigencia_fim?: string;
  fornecedor?: {
    nome?: string;
    cnpj?: string;
  };
  unidade_gestora?: {
    codigo?: string;
    nome?: string;
    uf_sigla?: string;
  };
  link_sistema_origem?: string;
}

function matchTermos(texto: string | undefined, termos: string[]): boolean {
  if (!texto) return false;
  const lower = texto.toLowerCase();
  return termos.every((t) => lower.includes(t.toLowerCase()));
}

function extrairTermos(termoBusca: string): string[] {
  const regex = /"([^"]+)"|(\S+)/g;
  const termos: string[] = [];
  let match;
  while ((match = regex.exec(termoBusca)) !== null) {
    termos.push(match[1] ?? match[2]);
  }
  return termos.filter(Boolean);
}

/**
 * Busca contratos no portal Transparência Contratos.gov.br.
 * Filtra localmente por termo de busca no objeto.
 *
 * NOTA: A API pública não suporta busca textual full-text; por isso
 * fazemos paginação e filtramos client-side.
 */
export async function buscarContratosCompras(
  params: BuscaComprasParams
): Promise<FontePreco[]> {
  const { termoBusca, cnpjOrgao, janelasMeses = 12, limite = 20 } = params;

  const termos = extrairTermos(termoBusca);
  const { dataInicial } = intervaloJanela(janelasMeses);
  const dataConsulta = agora();
  const fontes: FontePreco[] = [];

  const queryParams: Record<string, string | number> = {
    pagina: 1,
    tamanhoPagina: 50,
  };

  if (cnpjOrgao) {
    queryParams.cnpj_orgao = cnpjOrgao.replace(/\D/g, "");
  }

  let pagina = 1;
  const maxPaginas = 5;

  while (pagina <= maxPaginas && fontes.length < limite) {
    queryParams.pagina = pagina;

    try {
      const resp = await cliente.get<ComprasContratoRaw[]>("/contrato", {
        params: queryParams,
      });

      const lista = resp.data ?? [];
      if (lista.length === 0) break;

      for (const ct of lista) {
        const dataAssinatura = ct.data_assinatura?.substring(0, 10) ?? "";
        // Filtra por janela temporal
        if (dataAssinatura && new Date(dataAssinatura) < dataInicial) continue;

        if (!matchTermos(ct.objeto, termos)) continue;

        const valor = ct.valor_inicial ?? ct.valor_global ?? 0;
        if (valor <= 0) continue;

        fontes.push({
          id: `compras-${ct.id ?? pagina}-${fontes.length}`,
          fonte: "compras_contrato",
          numeroReferencia: ct.numero,
          descricaoObjeto: ct.objeto ?? "",
          valorUnitario: valor,
          unidadeMedida: "global",
          dataContrato: dataAssinatura,
          orgao: ct.unidade_gestora?.nome ?? "Não informado",
          uf: ct.unidade_gestora?.uf_sigla,
          urlReferencia: ct.link_sistema_origem,
          termosBusca: termoBusca,
          dataConsulta,
        });

        if (fontes.length >= limite) break;
      }
    } catch {
      // API pode estar indisponível — interrompe silenciosamente
      break;
    }

    pagina++;
    await sleep(300);
  }

  return fontes;
}
