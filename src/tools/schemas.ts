// ─────────────────────────────────────────────────────────────────────────────
// JSON Schemas para os inputs das ferramentas MCP
// ─────────────────────────────────────────────────────────────────────────────

type JsonSchema = {
  type: "object";
  required?: string[];
  properties?: Record<string, object>;
  [key: string]: unknown;
};

export const schemaBuscarContratacoesPNCP: JsonSchema = {
  type: "object",
  required: ["termoBusca"],
  properties: {
    termoBusca: {
      type: "string",
      description:
        "Termos para busca textual no objeto da licitacao/contrato.",
    },
    codigoModalidade: {
      type: "number",
      description: "Codigo da modalidade PNCP: 6=Pregao Eletronico, 8=Dispensa, 9=Inexigibilidade. Padrao: 6.",
      default: 6,
    },
    janelasMeses: {
      type: "number",
      description: "Janela de busca em meses (padrao: 12).",
      default: 12,
    },
    uf: {
      type: "string",
      description: "UF para filtrar resultados (ex: SP, DF).",
    },
    limite: {
      type: "number",
      description: "Maximo de fontes a retornar (padrao: 20).",
      default: 20,
    },
  },
};

export const schemaBuscarContratosCompras: JsonSchema = {
  type: "object",
  required: ["termoBusca"],
  properties: {
    termoBusca: {
      type: "string",
      description: "Termos para busca textual no objeto do contrato.",
    },
    cnpjOrgao: {
      type: "string",
      description: "CNPJ do orgao (apenas digitos ou formatado).",
    },
    janelasMeses: {
      type: "number",
      description: "Janela de busca em meses (padrao: 12).",
      default: 12,
    },
    uf: { type: "string", description: "UF para filtrar." },
    limite: {
      type: "number",
      description: "Maximo de resultados (padrao: 20).",
      default: 20,
    },
  },
};

export const schemaCalcularPrecoReferencia: JsonSchema = {
  type: "object",
  required: ["fontes"],
  properties: {
    fontes: {
      type: "array",
      description: "Lista de fontes de preco coletadas.",
      items: {
        type: "object",
        required: [
          "id",
          "fonte",
          "descricaoObjeto",
          "valorUnitario",
          "unidadeMedida",
          "dataContrato",
          "orgao",
          "dataConsulta",
        ],
        properties: {
          id: { type: "string" },
          fonte: {
            type: "string",
            enum: [
              "pncp_contrato",
              "pncp_contratacao",
              "compras_contrato",
              "painel_precos",
              "contrato_orgao",
              "midia_especializada",
              "cotacao_fornecedor",
            ],
          },
          numeroReferencia: { type: "string" },
          descricaoObjeto: { type: "string" },
          valorUnitario: { type: "number" },
          unidadeMedida: { type: "string" },
          dataContrato: { type: "string", description: "YYYY-MM-DD" },
          orgao: { type: "string" },
          uf: { type: "string" },
          urlReferencia: { type: "string" },
          termosBusca: { type: "string" },
          dataConsulta: { type: "string" },
          observacao: { type: "string" },
        },
      },
    },
  },
};

export const schemaExecutarPesquisa: JsonSchema = {
  type: "object",
  required: ["objeto", "unidadeMedida", "quantidade"],
  properties: {
    objeto: {
      type: "string",
      description: "Descricao do objeto da contratacao.",
    },
    codigoMaterial: {
      type: "string",
      description: "Codigo CATMAT ou CATSER (opcional).",
    },
    unidadeMedida: {
      type: "string",
      description: "Unidade de medida (ex: licenca, UN, mes).",
    },
    quantidade: {
      type: "number",
      description: "Quantidade estimada.",
    },
    dataBase: {
      type: "string",
      description: "Data base para deflacao de precos historicos (YYYY-MM-DD). Padrao: hoje.",
    },
    janelasMeses: {
      type: "number",
      description: "Janela de busca em meses (padrao: 12).",
      default: 12,
    },
    uf: { type: "string", description: "UF para filtrar buscas." },
    termosAdicionais: {
      type: "array",
      items: { type: "string" },
      description: "Termos adicionais de busca.",
    },
    codigoModalidade: {
      type: "number",
      description: "Codigo da modalidade PNCP (padrao: 6).",
      default: 6,
    },
  },
};

export const schemaGerarRelatorios: JsonSchema = {
  type: "object",
  required: ["pesquisa", "caminhoExcel", "caminhoWord"],
  properties: {
    pesquisa: {
      type: "object",
      description: "Resultado da pesquisa de precos (retornado por executar_pesquisa_precos).",
    },
    caminhoExcel: {
      type: "string",
      description: "Caminho de saida do arquivo Excel (.xlsx).",
    },
    caminhoWord: {
      type: "string",
      description: "Caminho de saida do documento Word (.docx).",
    },
    responsaveis: {
      type: "array",
      items: { type: "string" },
      description: "Nomes dos responsaveis pela pesquisa (secao 7.9 do relatorio).",
    },
  },
};
