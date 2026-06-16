// ─────────────────────────────────────────────────────────────────────────────
// Registro e despacho das ferramentas MCP
// ─────────────────────────────────────────────────────────────────────────────

import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { buscarContratacoesPNCP } from "../apis/pncp.js";
import { buscarContratosCompras } from "../apis/compras.js";
import { mediaSaneada } from "../domain/media-saneada.js";
import { validarSerie, URLS_SISTEMAS } from "../domain/normas.js";
import { gerarPlanilha } from "../reports/excel.js";
import { gerarRelatorioWord } from "../reports/word.js";
import { agora, toDataISO } from "../utils/date.js";
import type { FontePreco, ParamsPesquisa, PesquisaPrecos } from "../domain/types.js";
import {
  schemaBuscarContratacoesPNCP,
  schemaBuscarContratosCompras,
  schemaCalcularPrecoReferencia,
  schemaExecutarPesquisa,
  schemaGerarRelatorios,
} from "./schemas.js";

// ─── Definicao das ferramentas ────────────────────────────────────────────────

export const TOOLS: Tool[] = [
  {
    name: "buscar_contratacoes_pncp",
    description:
      "Busca licitacoes e seus itens no PNCP pelo objeto, retornando precos unitarios. " +
      "Cobre fontes primarias (sistemas oficiais de governo) conforme IN SEGES/ME 65/2021.",
    inputSchema: schemaBuscarContratacoesPNCP,
  },
  {
    name: "buscar_contratos_compras",
    description:
      "Busca contratos no portal Contratos.gov.br / Compras.gov.br pelo objeto. " +
      "Cobre fontes primarias/secundarias conforme IN SEGES/ME 65/2021.",
    inputSchema: schemaBuscarContratosCompras,
  },
  {
    name: "calcular_preco_referencia",
    description:
      "Aplica o algoritmo de Media Saneada sobre uma lista de fontes de preco. " +
      "Metodologia conforme IN SEGES/ME 65/2021: " +
      "remocao iterativa de outliers por Z-score ate CV <= 25% ou minimo de 3 amostras.",
    inputSchema: schemaCalcularPrecoReferencia,
  },
  {
    name: "executar_pesquisa_precos",
    description:
      "Executa pesquisa de precos completa: busca automatica no PNCP e Compras.gov.br, " +
      "aplica media saneada e retorna o objeto PesquisaPrecos com preco de referencia.",
    inputSchema: schemaExecutarPesquisa,
  },
  {
    name: "gerar_relatorios",
    description:
      "Gera os documentos finais da pesquisa: planilha Excel e documento Word " +
      "conforme a estrutura da IN SEGES/ME 65/2021.",
    inputSchema: schemaGerarRelatorios,
  },
];

// ─── Despacho de chamadas ─────────────────────────────────────────────────────

export async function chamarFerramenta(
  nome: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    switch (nome) {
      case "buscar_contratacoes_pncp":
        return await chamarBuscarContratacoesPNCP(args);
      case "buscar_contratos_compras":
        return await chamarBuscarContratosCompras(args);
      case "calcular_preco_referencia":
        return await chamarCalcularPrecoReferencia(args);
      case "executar_pesquisa_precos":
        return await chamarExecutarPesquisa(args);
      case "gerar_relatorios":
        return await chamarGerarRelatorios(args);
      default:
        return erro(`Ferramenta desconhecida: ${nome}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return erro(`Erro ao executar ${nome}: ${msg}`);
  }
}

// ─── Implementacoes ───────────────────────────────────────────────────────────

async function chamarBuscarContratacoesPNCP(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const {
    termoBusca,
    codigoModalidade = 6,
    janelasMeses = 12,
    uf,
    limite = 20,
  } = args as {
    termoBusca: string;
    codigoModalidade?: number;
    janelasMeses?: number;
    uf?: string;
    limite?: number;
  };

  const fontes = await buscarContratacoesPNCP({
    termoBusca,
    codigoModalidade,
    janelasMeses,
    uf,
    limite,
  });

  return sucesso({
    total: fontes.length,
    fontes,
    mensagem:
      fontes.length === 0
        ? `Nenhuma licitacao encontrada no PNCP para "${termoBusca}" nos ultimos ${janelasMeses} meses.`
        : `${fontes.length} item(s) encontrado(s) no PNCP para "${termoBusca}".`,
  });
}

async function chamarBuscarContratosCompras(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const {
    termoBusca,
    cnpjOrgao,
    janelasMeses = 12,
    uf,
    limite = 20,
  } = args as {
    termoBusca: string;
    cnpjOrgao?: string;
    janelasMeses?: number;
    uf?: string;
    limite?: number;
  };

  const fontes = await buscarContratosCompras({
    termoBusca,
    cnpjOrgao,
    janelasMeses,
    uf,
    limite,
  });

  return sucesso({
    total: fontes.length,
    fontes,
    mensagem:
      fontes.length === 0
        ? `Nenhum contrato encontrado em Compras.gov.br para "${termoBusca}".`
        : `${fontes.length} contrato(s) encontrado(s) em Compras.gov.br.`,
  });
}

async function chamarCalcularPrecoReferencia(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { fontes } = args as { fontes: FontePreco[] };

  if (!Array.isArray(fontes) || fontes.length === 0) {
    return erro("Informe ao menos uma fonte de preco.");
  }

  const alertasValidacao = validarSerie(fontes);
  const resultado = mediaSaneada(fontes);

  return sucesso({
    precoReferencia: resultado.precoReferencia,
    precoReferenciaFormatado: resultado.precoReferencia.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    }),
    cv: resultado.cv,
    cvFormatado: `${(resultado.cv * 100).toFixed(2)}%`,
    conformeCV: resultado.conformeCV,
    totalFontes: fontes.length,
    fontesValidas: resultado.precosValidos.length,
    outliersRemovidos: resultado.outliers.length,
    totalIteracoes: resultado.totalIteracoes,
    criterioParada: resultado.criterioParada,
    alertas: [...alertasValidacao, ...resultado.alertas],
    resultado,
  });
}

async function chamarExecutarPesquisa(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const params = args as unknown as ParamsPesquisa;

  const dataBase = params.dataBase ?? toDataISO(new Date());
  const janelasMeses = params.janelasMeses ?? 12;
  const termoBusca = [params.objeto, ...(params.termosAdicionais ?? [])].join(" ");

  const [fontesPNCP, fontesCompras] = await Promise.allSettled([
    buscarContratacoesPNCP({
      termoBusca,
      codigoModalidade: params.codigoModalidade ?? 6,
      janelasMeses,
      uf: params.uf,
      limite: 20,
    }),
    buscarContratosCompras({
      termoBusca,
      janelasMeses,
      uf: params.uf,
      limite: 20,
    }),
  ]);

  const pncp: FontePreco[] =
    fontesPNCP.status === "fulfilled" ? fontesPNCP.value : [];
  const compras: FontePreco[] =
    fontesCompras.status === "fulfilled" ? fontesCompras.value : [];

  const todasFontes = [...pncp, ...compras];
  const analise = mediaSaneada(todasFontes);
  const alertasValidacao = validarSerie(todasFontes);

  const pendencias: string[] = [
    "Preencher data/hora exata de acesso a cada portal (secoes 7.2.1.3.x)",
    "Verificar Banco de Precos (bancodeprecos.com.br) e incluir valores encontrados",
    "Verificar contratos anteriores do proprio orgao de mesmo objeto (Fonte III)",
    "Confirmar se objeto faz parte do Catalogo de Solucoes de TIC",
    "Preencher responsaveis pela pesquisa (secao 7.9)",
  ];

  if (pncp.length < 3) {
    pendencias.push(
      `Apenas ${pncp.length} fonte(s) encontrada(s) no PNCP. Considere ampliar os termos de busca ou o periodo.`
    );
  }

  const pesquisa: PesquisaPrecos = {
    params: { ...params, dataBase },
    fontes: {
      pncp,
      compras,
      catalogoTIC: {
        encontrado: false,
        link: URLS_SISTEMAS.catalogo_tic,
        dataConsulta: agora(),
        observacao: "Verificacao manual necessaria",
      },
      cotacoesFornecedores: [],
      midiasEspecializadas: [],
      contratosOrgao: [],
    },
    serieCompleta: todasFontes.map((f) => f.valorUnitario),
    analise: {
      ...analise,
      alertas: [...alertasValidacao, ...analise.alertas],
    },
    dataHoraPesquisa: agora(),
    pendenciasHumanas: pendencias,
  };

  return sucesso({
    resumo: {
      objeto: params.objeto,
      fontesEncontradas: todasFontes.length,
      fontesPNCP: pncp.length,
      fontesCompras: compras.length,
      precoReferencia: analise.precoReferencia,
      precoReferenciaFormatado: analise.precoReferencia.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      cv: analise.cv,
      cvFormatado: `${(analise.cv * 100).toFixed(2)}%`,
      conformeCV: analise.conformeCV,
    },
    alertas: [...alertasValidacao, ...analise.alertas],
    pendenciasHumanas: pendencias,
    pesquisa,
  });
}

async function chamarGerarRelatorios(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const {
    pesquisa,
    caminhoExcel,
    caminhoWord,
    responsaveis = [],
  } = args as {
    pesquisa: PesquisaPrecos;
    caminhoExcel: string;
    caminhoWord: string;
    responsaveis?: string[];
  };

  const erros: string[] = [];

  try {
    await gerarPlanilha(pesquisa, caminhoExcel);
  } catch (e) {
    erros.push(`Excel: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await gerarRelatorioWord(pesquisa, caminhoWord, responsaveis);
  } catch (e) {
    erros.push(`Word: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (erros.length > 0) {
    return erro(`Erros ao gerar relatorios:\n${erros.join("\n")}`);
  }

  return sucesso({
    mensagem: "Relatorios gerados com sucesso.",
    arquivos: { excel: caminhoExcel, word: caminhoWord },
    pendenciasHumanas: pesquisa.pendenciasHumanas,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sucesso(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}

function erro(mensagem: string): CallToolResult {
  return {
    content: [{ type: "text", text: mensagem }],
    isError: true,
  };
}
