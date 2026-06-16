// ─────────────────────────────────────────────────────────────────────────────
// Gerador de documento Word – Pesquisa de Preços
// Modelo: IN SEGES/ME nº 65/2021
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  ShadingType,
  convertInchesToTwip,
} from "docx";
import { writeFile } from "fs/promises";
import type { FontePreco, PesquisaPrecos } from "../domain/types.js";
import { LABELS_FONTE, URLS_SISTEMAS, gerarTextoConclusao } from "../domain/normas.js";
import { formatarDataBR } from "../utils/date.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FONTE_PADRAO = "Arial";
const TAMANHO_PADRAO = 22; // half-points (11pt)
const AZUL = "1F4E79";

function bold(text: string, tamanho = TAMANHO_PADRAO): TextRun {
  return new TextRun({ text, bold: true, size: tamanho, font: FONTE_PADRAO });
}

function normal(text: string, tamanho = TAMANHO_PADRAO): TextRun {
  return new TextRun({ text, size: tamanho, font: FONTE_PADRAO });
}

function pendente(text: string): TextRun {
  return new TextRun({
    text,
    size: TAMANHO_PADRAO,
    font: FONTE_PADRAO,
    highlight: "yellow",
    bold: true,
  });
}

function par(runs: TextRun[], nivelIndent = 0): Paragraph {
  return new Paragraph({
    children: runs,
    indent: nivelIndent > 0 ? { left: convertInchesToTwip(nivelIndent * 0.5) } : undefined,
    spacing: { after: 120 },
  });
}

function titulo(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });
}

function subtitulo(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 120, after: 80 },
  });
}

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function percentual(decimal: number): string {
  return `${(decimal * 100).toFixed(2)}%`;
}

function espaco(): Paragraph {
  return new Paragraph({ children: [], spacing: { after: 80 } });
}

// ─── Células de tabela ────────────────────────────────────────────────────────

function celulaHeader(texto: string, widthPct?: number): TableCell {
  return new TableCell({
    children: [par([bold(texto)])],
    ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {}),
    shading: { type: ShadingType.SOLID, color: AZUL, fill: AZUL },
  });
}

function celulaNormal(texto: string): TableCell {
  return new TableCell({ children: [par([normal(texto)])] });
}

// ─── Tabela de fontes de preço ────────────────────────────────────────────────

function tabelaFontes(fontes: FontePreco[]): Table {
  const header = new TableRow({
    children: [
      celulaHeader("Nº", 4),
      celulaHeader("Fonte", 22),
      celulaHeader("Nº Referência", 18),
      celulaHeader("Objeto", 32),
      celulaHeader("Valor Unit.", 12),
      celulaHeader("Data", 12),
    ],
  });

  const linhas = fontes.map((f, i) =>
    new TableRow({
      children: [
        celulaNormal(String(i + 1)),
        celulaNormal(LABELS_FONTE[f.fonte] ?? f.fonte),
        celulaNormal(f.numeroReferencia ?? "—"),
        celulaNormal(f.descricaoObjeto),
        celulaNormal(moeda(f.valorUnitario)),
        celulaNormal(formatarDataBR(f.dataContrato)),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...linhas],
  });
}

// ─── Tabela resumo do preço de referência ────────────────────────────────────

function tabelaResumo(pesquisa: PesquisaPrecos): Table {
  const { params, analise } = pesquisa;
  const valorTotal = analise.precoReferencia * params.quantidade;

  const header = new TableRow({
    children: ["Item", "Descrição", "Quantidade", "Unid.", "Valor Unit. (R$)", "Valor Total (R$)"].map(
      (h) => celulaHeader(h)
    ),
  });

  const linha = new TableRow({
    children: [
      celulaNormal("1"),
      celulaNormal(params.objeto),
      celulaNormal(String(params.quantidade)),
      celulaNormal(params.unidadeMedida),
      celulaNormal(moeda(analise.precoReferencia)),
      new TableCell({ children: [par([bold(moeda(valorTotal))])] }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, linha],
  });
}

// ─── Seção 7.5 – Análise iterativa em parágrafos ─────────────────────────────

function secaoAnaliseIterativa(pesquisa: PesquisaPrecos): (Paragraph | Table)[] {
  const elementos: (Paragraph | Table)[] = [];
  const { analise } = pesquisa;

  analise.iteracoes.forEach((iter) => {
    const parada = iter.criterioParada
      ? ` — PARADA: ${iter.criterioParada === "cv_atingido" ? "CV ≤ 25%" : "Mínimo de amostras"}`
      : "";

    elementos.push(subtitulo(`Iteração ${iter.numero}${parada}`));

    // Tabela da iteração
    const headerRow = new TableRow({
      children: [
        celulaHeader("Pesquisa", 15),
        celulaHeader("Valor Unitário (R$)", 40),
        celulaHeader("Escore Z *", 45),
      ],
    });

    const linhasIter = iter.amostra.map((valor, i) =>
      new TableRow({
        children: [
          celulaNormal(String.fromCharCode(65 + i)),
          celulaNormal(moeda(valor)),
          celulaNormal(iter.zscores[i].toFixed(6)),
        ],
      })
    );

    elementos.push(
      new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...linhasIter],
      })
    );

    elementos.push(espaco());
    elementos.push(
      par([
        bold("Coeficiente de Variação (CV): "),
        normal(`${percentual(iter.cv)}${iter.cv <= 0.25 ? " ✓" : " ⚠"}`),
      ])
    );
    elementos.push(par([bold("Média Saneada: "), normal(moeda(iter.media))]));

    if (iter.outlierRemovido !== undefined && !iter.criterioParada) {
      elementos.push(
        par([bold("Outlier removido: "), normal(moeda(iter.outlierRemovido))], 1)
      );
    }

    elementos.push(espaco());
  });

  elementos.push(
    par([
      normal(
        "* Fórmula Z-score (Excel): =SEERRO((B3-MÉDIA(B$3:B$n))/DESVPAD(B$3:B$n);\"-\")"
      ),
    ])
  );

  return elementos;
}

// ─── Documento principal ──────────────────────────────────────────────────────

export async function gerarRelatorioWord(
  pesquisa: PesquisaPrecos,
  caminhoSaida: string,
  responsaveis: string[] = []
): Promise<void> {
  const { params, analise, fontes, dataHoraPesquisa, pendenciasHumanas } = pesquisa;
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  const todasFontes: FontePreco[] = [
    ...fontes.pncp,
    ...fontes.compras,
    ...fontes.contratosOrgao,
    ...fontes.midiasEspecializadas,
    ...fontes.cotacoesFornecedores,
  ];

  const encontrouFontes = todasFontes.length > 0;

  // Monta a lista completa de filhos da seção
  const children: (Paragraph | Table)[] = [

    // ── Cabeçalho ──────────────────────────────────────────────────────────
    new Paragraph({
      children: [
        new TextRun({
          text: "PESQUISA DE PREÇOS DE MERCADO",
          bold: true,
          size: 28,
          font: FONTE_PADRAO,
          color: AZUL,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Objeto: ${params.objeto}`,
          size: TAMANHO_PADRAO,
          font: FONTE_PADRAO,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),

    // ── 7.1 ─────────────────────────────────────────────────────────────────
    titulo("7.1. Processo de Pesquisa e Análise Crítica"),
    par([
      normal(
        `O processo de pesquisa e análise crítica dos preços para a contratação ` +
          `${params.objeto} seguiu as orientações da IN SEGES/ME nº 65/2021.`
      ),
    ]),

    // ── 7.2 ─────────────────────────────────────────────────────────────────
    titulo("7.2. Caracterização das Fontes Consultadas"),
    subtitulo("7.2.1.1. I – Sistemas Oficiais de Governo"),
    par([
      normal(
        "Composição de custos unitários nos sistemas oficiais de governo, em execução ou concluídas " +
          "no período de 12 (doze) meses anterior à data da pesquisa de preços."
      ),
    ]),

    subtitulo("7.2.1.3.2. Portal Nacional de Contratações Públicas – PNCP"),
    par([
      normal(`Link: ${URLS_SISTEMAS.pncp_contratos}, consulta realizada em `),
      pendente(dataHoje),
      normal(", pelos termos "),
      pendente(`"${params.objeto}"`),
      normal(", conforme Tabela I (planilha Excel anexa)."),
    ]),

    subtitulo("7.2.1.3.3. Portal de Compras do Governo Federal"),
    par([
      normal(`Link: ${URLS_SISTEMAS.comprasnet}, consulta realizada em `),
      pendente(dataHoje),
      normal(", pelos termos "),
      pendente(`"${params.objeto}"`),
      normal(", conforme Tabela I."),
    ]),

    subtitulo("7.2.1.3.4. Transparência Contratos.gov.br"),
    par([
      normal(`Link: ${URLS_SISTEMAS.transparencia_contratos}, consulta realizada em `),
      pendente(dataHoje),
      normal(", pelos termos "),
      pendente(`"${params.objeto}"`),
      normal(", conforme Tabela I."),
    ]),

    subtitulo("7.2.1.2. II – Contratações similares de outros entes públicos"),
    par([
      normal(
        "Contratações similares de outros entes públicos, em execução ou concluídas no período de " +
          "12 (doze) meses anterior à data da pesquisa, inclusive mediante sistema de registro de preços."
      ),
    ]),

    subtitulo("7.2.1.4. III – Contratações anteriores do próprio órgão"),
    fontes.contratosOrgao.length > 0
      ? par([normal(`${fontes.contratosOrgao.length} contrato(s) identificado(s) com objeto similar.`)])
      : par([pendente("[PENDÊNCIA: Preencher tabela de contratos anteriores ou justificar ausência]")]),

    subtitulo("7.2.1.5. IV – Mídia especializada / Tabela de referência aprovada"),
    par([
      normal(
        `Catálogo de Soluções de TIC: ${URLS_SISTEMAS.catalogo_tic}, consulta em ${dataHoje}. `
      ),
      normal(
        fontes.catalogoTIC.encontrado
          ? "O objeto FAZ parte do Catálogo de Soluções de TIC. Preços não podem ser superiores ao catálogo."
          : "O objeto NÃO faz parte do Catálogo de Soluções de TIC."
      ),
    ]),

    subtitulo("7.2.1.6. V – Pesquisa direta com fornecedores"),
    fontes.cotacoesFornecedores.length > 0
      ? par([normal(`Foram obtidas ${fontes.cotacoesFornecedores.length} proposta(s) comercial(is) de fornecedores.`)])
      : par([pendente("[PENDÊNCIA: Se aplicável, descrever as empresas consultadas e respostas recebidas]")]),

    subtitulo("7.2.1.7. VI – Convenções Coletivas de Trabalho"),
    par([
      normal(
        "Não se aplica para a presente contratação, por se tratar de contratação de serviços/subscrição de TIC."
      ),
    ]),

    subtitulo("7.2.1.8. VII – Banco Nacional de Notas Fiscais"),
    par([
      normal(
        "Não foi possível consultar o banco nacional de notas fiscais, " +
          "considerando que o acesso ainda não foi regulamentado pelo Governo Federal."
      ),
    ]),

    // ── 7.3 ─────────────────────────────────────────────────────────────────
    titulo("7.3. Série de Preços Coletados"),
    par([
      normal(
        `Foram coletados ${todasFontes.length} preço(s) de referência para o objeto "${params.objeto}". ` +
          "A série completa consta na Tabela I a seguir e na planilha Excel anexa."
      ),
    ]),
    espaco(),
  ];

  // Tabela de fontes (pode ser vazia)
  if (todasFontes.length > 0) {
    children.push(tabelaFontes(todasFontes));
  } else {
    children.push(par([pendente("[PENDÊNCIA: Inserir tabela com preços coletados]")]));
  }

  children.push(
    espaco(),

    // ── 7.4 Metodologia ───────────────────────────────────────────────────────
    titulo("7.4. Metodologia para Análise dos Preços Coletados"),
    subtitulo("7.4.1. Média Saneada"),
    par([
      normal(
        "A metodologia adotada visa identificar uma medida de resumo sobre a série de preços " +
          "pesquisados, representando de forma mais adequada (sem distorções) o valor médio " +
          "unitário do item de contratação. Optou-se pela avaliação da Média Saneada, metodologia " +
          "robusta de identificação e eliminação de valores discrepantes (outliers)."
      ),
    ]),
    subtitulo("7.4.2. Passos da metodologia"),
    par([normal("I – Aferição da homogeneidade dos dados;")], 1),
    par([normal("II – Identificação dos valores discrepantes (outliers);")], 1),
    par([normal("III – Remoção desses valores da amostra;")], 1),
    par([normal("IV – Recálculo até atingir os critérios de parada.")], 1),
    subtitulo("7.4.3. Critérios de parada"),
    par([normal("I – Coeficiente de Variação (CV) ≤ 25%; ou")], 1),
    par([normal("II – Amostra com no mínimo 3 (três) preços.")], 1),

    // ── 7.5 Análise iterativa ─────────────────────────────────────────────────
    titulo("7.5. Série de Preços Coletados – Análise Iterativa"),
    par([
      normal(
        "A tabela a seguir apresenta o processo iterativo de saneamento da amostra, " +
          "com identificação e remoção dos outliers em cada iteração."
      ),
    ]),
  );

  // Insere iterações
  secaoAnaliseIterativa(pesquisa).forEach((el) => children.push(el));

  children.push(
    espaco(),

    // ── 7.6 ──────────────────────────────────────────────────────────────────
    titulo("7.6. Metodologia para Obtenção do Preço Estimado"),
    par([
      normal(
        `A obtenção do preço estimado deu-se com base na média saneada dos valores obtidos na ` +
          `pesquisa de preços, em razão da representatividade estatística da série coletada ` +
          `(CV final = ${percentual(analise.cv)}).`
      ),
    ]),
    analise.outliers.length > 0
      ? par([
          bold("Preços desconsiderados (outliers): "),
          normal(analise.outliers.map((o) => `${o.id} – ${moeda(o.valorUnitario)}`).join("; ")),
        ])
      : par([normal("Nenhum preço foi desconsiderado após análise.")]),

    // ── 7.7 ──────────────────────────────────────────────────────────────────
    titulo("7.7. Preço de Referência"),
    par([
      normal("Com base no estudo da pesquisa de preços, o valor unitário estimado de referência será de "),
      bold(moeda(analise.precoReferencia)),
      normal(", conforme tabela abaixo:"),
    ]),
    espaco(),
    tabelaResumo(pesquisa),
    espaco(),

    // ── 7.8 ──────────────────────────────────────────────────────────────────
    titulo("7.8. Conclusão"),
    par([normal(gerarTextoConclusao(encontrouFontes))]),
    par([
      normal(
        "Concluímos assim, que os valores definidos para as referências de preços representam o " +
          "melhor cenário e estão alinhados com a seleção da proposta mais vantajosa pela Administração " +
          "e aptos para demonstrar a razoabilidade e compatibilidade com os valores padrões de mercado."
      ),
    ]),
    par([
      normal(
        "Na fixação dos valores do objeto contratual foram observadas condutas de modo a afastar " +
          "o sobrepreço e o superfaturamento, nos termos fixados nos incisos I e II do § 1º do art. " +
          "31 da Lei nº 13.303/2016."
      ),
    ]),
  );

  // Pendências
  if (pendenciasHumanas.length > 0) {
    children.push(subtitulo("Pendências para Preenchimento Manual"));
    pendenciasHumanas.forEach((p) => {
      children.push(par([pendente(`⚠ ${p}`)], 1));
    });
  }

  children.push(
    // ── 7.9 ──────────────────────────────────────────────────────────────────
    titulo("7.9. Identificação dos Responsáveis pela Pesquisa de Preços"),
    par([
      normal("Os responsáveis pelo estudo de preços de mercado foram os empregados: "),
      responsaveis.length > 0
        ? normal(responsaveis.join("; "))
        : pendente("[PENDÊNCIA: Incluir nome(s) e matrícula(s) do(s) responsável(is)]"),
    ]),

    // ── Rodapé ───────────────────────────────────────────────────────────────
    new Paragraph({ children: [], spacing: { before: 480 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Documento gerado automaticamente por radar-precos-mcp em ${dataHoraPesquisa}`,
          size: 18,
          color: "888888",
          font: FONTE_PADRAO,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(caminhoSaida, buffer);
}
