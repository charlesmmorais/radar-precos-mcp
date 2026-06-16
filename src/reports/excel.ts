// ─────────────────────────────────────────────────────────────────────────────
// Gerador de planilha Excel – Mapa de Pesquisa de Preços
// IN SEGES/ME nº 65/2021
// ─────────────────────────────────────────────────────────────────────────────

import ExcelJS from "exceljs";
import type { PesquisaPrecos } from "../domain/types.js";
import { LABELS_FONTE } from "../domain/normas.js";
import { formatarDataBR } from "../utils/date.js";

// ─── Estilos ──────────────────────────────────────────────────────────────────

const COR_HEADER = "1F4E79";   // azul escuro
const COR_SUBHEADER = "2E75B6"; // azul médio
const COR_OUTLIER = "FFC7CE";  // vermelho claro
const COR_VALIDO = "C6EFCE";   // verde claro
const COR_ALERTA = "FFEB9C";   // amarelo

function cellFont(bold = false, color = "000000", size = 11): Partial<ExcelJS.Font> {
  return { bold, color: { argb: `FF${color}` }, size, name: "Calibri" };
}

function headerFill(cor: string): ExcelJS.Fill {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${cor}` },
  };
}

function borda(): Partial<ExcelJS.Borders> {
  const thin: ExcelJS.BorderStyle = "thin";
  return {
    top: { style: thin },
    left: { style: thin },
    bottom: { style: thin },
    right: { style: thin },
  };
}

// ─── Aba: Série de Preços ─────────────────────────────────────────────────────

function criarAbaSeriePrecos(
  wb: ExcelJS.Workbook,
  pesquisa: PesquisaPrecos
): void {
  const ws = wb.addWorksheet("Série de Preços", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  ws.columns = [
    { header: "ID", key: "id", width: 20 },
    { header: "Fonte", key: "fonte", width: 30 },
    { header: "Número de Referência", key: "numero", width: 30 },
    { header: "Descrição do Objeto", key: "descricao", width: 50 },
    { header: "Valor Unitário (R$)", key: "valor", width: 20 },
    { header: "Unid. Medida", key: "unidade", width: 14 },
    { header: "Data Contrato", key: "data", width: 16 },
    { header: "Órgão", key: "orgao", width: 35 },
    { header: "UF", key: "uf", width: 6 },
    { header: "URL Referência", key: "url", width: 40 },
    { header: "Data Consulta", key: "dataConsulta", width: 22 },
  ];

  // Estilo do header
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = cellFont(true, "FFFFFF");
    cell.fill = headerFill(COR_HEADER);
    cell.alignment = { horizontal: "center", wrapText: true };
    cell.border = borda();
  });
  headerRow.height = 30;

  // Todas as fontes
  const todasFontes = [
    ...pesquisa.fontes.pncp,
    ...pesquisa.fontes.compras,
    ...pesquisa.fontes.contratosOrgao,
    ...pesquisa.fontes.midiasEspecializadas,
    ...pesquisa.fontes.cotacoesFornecedores,
  ];

  const outliersIds = new Set(
    pesquisa.analise.outliers.map((o) => o.id)
  );

  todasFontes.forEach((fonte) => {
    const row = ws.addRow({
      id: fonte.id,
      fonte: LABELS_FONTE[fonte.fonte] ?? fonte.fonte,
      numero: fonte.numeroReferencia ?? "",
      descricao: fonte.descricaoObjeto,
      valor: fonte.valorUnitario,
      unidade: fonte.unidadeMedida,
      data: formatarDataBR(fonte.dataContrato),
      orgao: fonte.orgao,
      uf: fonte.uf ?? "",
      url: fonte.urlReferencia ?? "",
      dataConsulta: fonte.dataConsulta.substring(0, 10),
    });

    // Formata célula de valor
    const celValor = row.getCell("valor");
    celValor.numFmt = '"R$"#,##0.00';

    // Destaca outliers x válidos
    const isOutlier = outliersIds.has(fonte.id);
    const corFundo = isOutlier ? COR_OUTLIER : COR_VALIDO;
    row.eachCell((cell) => {
      cell.fill = headerFill(corFundo);
      cell.border = borda();
    });

    if (isOutlier) {
      row.getCell("id").value = `${fonte.id} [OUTLIER]`;
    }
  });

  // Legenda
  ws.addRow([]);
  const legRow = ws.addRow(["Legenda:"]);
  legRow.getCell(1).font = cellFont(true);

  ws.addRow([
    "",
    "Verde = Compõe o preço de referência",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Vermelho = Outlier descartado",
  ]);
}

// ─── Aba: Análise Crítica (Média Saneada) ────────────────────────────────────

function criarAbaAnaliseCritica(
  wb: ExcelJS.Workbook,
  pesquisa: PesquisaPrecos
): void {
  const ws = wb.addWorksheet("Análise Crítica");
  const analise = pesquisa.analise;

  // Título
  ws.mergeCells("A1:F1");
  const tituloCell = ws.getCell("A1");
  tituloCell.value = `Análise Crítica e Tratamento da Pesquisa – ${pesquisa.params.objeto}`;
  tituloCell.font = cellFont(true, "FFFFFF", 12);
  tituloCell.fill = headerFill(COR_HEADER);
  tituloCell.alignment = { horizontal: "center" };
  ws.getRow(1).height = 25;

  let linha = 3;

  analise.iteracoes.forEach((iter) => {
    // Header da iteração
    ws.mergeCells(`A${linha}:F${linha}`);
    const iterCell = ws.getCell(`A${linha}`);
    iterCell.value = `Iteração ${iter.numero}${
      iter.criterioParada ? ` [PARADA: ${iter.criterioParada === "cv_atingido" ? "CV ≤ 25%" : "Mínimo de amostras"}]` : ""
    }`;
    iterCell.font = cellFont(true, "FFFFFF");
    iterCell.fill = headerFill(COR_SUBHEADER);
    ws.getRow(linha).height = 20;
    linha++;

    // Header das colunas
    const hRow = ws.getRow(linha);
    ["Pesquisa", "Valor Unitário (R$)", "Escore Z"].forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = cellFont(true, "FFFFFF");
      cell.fill = headerFill(COR_HEADER);
      cell.border = borda();
      cell.alignment = { horizontal: "center" };
    });
    linha++;

    const amostraInicio = linha;

    // Valores
    iter.amostra.forEach((valor, i) => {
      const row = ws.getRow(linha);
      row.getCell(1).value = String.fromCharCode(65 + i); // A, B, C...
      row.getCell(2).value = valor;
      row.getCell(2).numFmt = '"R$"#,##0.00';
      row.getCell(3).value = iter.zscores[i];
      row.getCell(3).numFmt = "0.000000";

      // Destaca o outlier removido nesta iteração
      if (
        iter.outlierRemovido !== undefined &&
        valor === iter.outlierRemovido &&
        !iter.criterioParada
      ) {
        [1, 2, 3].forEach((c) => {
          row.getCell(c).fill = headerFill(COR_OUTLIER);
        });
      } else {
        [1, 2, 3].forEach((c) => {
          row.getCell(c).fill = headerFill(COR_VALIDO);
        });
      }

      [1, 2, 3].forEach((c) => (row.getCell(c).border = borda()));
      linha++;
    });

    const amostraFim = linha - 1;

    // CV
    const cvRow = ws.getRow(linha);
    cvRow.getCell(1).value = "Coeficiente de Variação";
    cvRow.getCell(1).font = cellFont(true);
    cvRow.getCell(2).value = iter.cv;
    cvRow.getCell(2).numFmt = "0.00%";
    cvRow.getCell(2).fill = headerFill(
      iter.cv <= 0.25 ? COR_VALIDO : COR_ALERTA
    );
    [1, 2].forEach((c) => (cvRow.getCell(c).border = borda()));
    linha++;

    // Média Saneada
    const msRow = ws.getRow(linha);
    msRow.getCell(1).value = "Média Saneada";
    msRow.getCell(1).font = cellFont(true);
    msRow.getCell(2).value = {
      formula: `AVERAGE(B${amostraInicio}:B${amostraFim})`,
      result: iter.media,
    } as ExcelJS.CellFormulaValue;
    msRow.getCell(2).numFmt = '"R$"#,##0.00';
    [1, 2].forEach((c) => (msRow.getCell(c).border = borda()));
    linha += 2; // Espaço entre iterações
  });

  // Resultado final
  ws.mergeCells(`A${linha}:F${linha}`);
  const resultCell = ws.getCell(`A${linha}`);
  resultCell.value = "RESULTADO FINAL";
  resultCell.font = cellFont(true, "FFFFFF", 12);
  resultCell.fill = headerFill(COR_HEADER);
  resultCell.alignment = { horizontal: "center" };
  linha++;

  [
    ["Preço de Referência (Média Saneada)", analise.precoReferencia, '"R$"#,##0.00'],
    ["CV Final", analise.cv, "0.00%"],
    ["Nº de fontes válidas", analise.precosValidos.length, "0"],
    ["Nº de outliers descartados", analise.outliers.length, "0"],
    ["CV aceitável (≤ 25%)", analise.conformeCV ? "SIM" : "NÃO", undefined],
  ].forEach(([label, valor, fmt]) => {
    const row = ws.getRow(linha);
    row.getCell(1).value = label as string;
    row.getCell(1).font = cellFont(true);
    row.getCell(2).value = valor as number | string;
    if (fmt) row.getCell(2).numFmt = fmt as string;
    row.getCell(2).fill = headerFill(
      analise.conformeCV ? COR_VALIDO : COR_ALERTA
    );
    [1, 2].forEach((c) => (row.getCell(c).border = borda()));
    linha++;
  });

  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 18;
}

// ─── Aba: Mapa de Pesquisa ────────────────────────────────────────────────────

function criarAbaMapa(wb: ExcelJS.Workbook, pesquisa: PesquisaPrecos): void {
  const ws = wb.addWorksheet("Mapa de Pesquisa");

  ws.mergeCells("A1:G1");
  const titulo = ws.getCell("A1");
  titulo.value = `MAPA DE PESQUISA DE PREÇOS – ${pesquisa.params.objeto.toUpperCase()}`;
  titulo.font = cellFont(true, "FFFFFF", 13);
  titulo.fill = headerFill(COR_HEADER);
  titulo.alignment = { horizontal: "center" };
  ws.getRow(1).height = 28;

  ws.addRow([]);

  // Informações gerais
  [
    ["Objeto:", pesquisa.params.objeto],
    ["Unidade de Medida:", pesquisa.params.unidadeMedida],
    ["Quantidade:", pesquisa.params.quantidade],
    ["Data Base:", pesquisa.params.dataBase ?? new Date().toISOString().substring(0, 10)],
    ["Data/Hora da Pesquisa:", pesquisa.dataHoraPesquisa],
  ].forEach(([label, valor]) => {
    const row = ws.addRow([label, valor]);
    row.getCell(1).font = cellFont(true);
  });

  ws.addRow([]);

  // Header do mapa
  const hRow = ws.addRow([
    "Pesquisa",
    "Fonte",
    "Nº Referência",
    "Descrição",
    "Valor Unitário (R$)",
    "Unid.",
    "Data",
  ]);
  hRow.eachCell((cell) => {
    cell.font = cellFont(true, "FFFFFF");
    cell.fill = headerFill(COR_SUBHEADER);
    cell.border = borda();
    cell.alignment = { horizontal: "center", wrapText: true };
  });
  hRow.height = 24;

  const validosIds = new Set(pesquisa.analise.precosValidos.map((p) => p.id));
  const outliersIds = new Set(pesquisa.analise.outliers.map((o) => o.id));

  const todas = [
    ...pesquisa.fontes.pncp,
    ...pesquisa.fontes.compras,
    ...pesquisa.fontes.contratosOrgao,
    ...pesquisa.fontes.midiasEspecializadas,
    ...pesquisa.fontes.cotacoesFornecedores,
  ];

  todas.forEach((f, i) => {
    const row = ws.addRow([
      String.fromCharCode(65 + i),
      LABELS_FONTE[f.fonte] ?? f.fonte,
      f.numeroReferencia ?? "",
      f.descricaoObjeto,
      f.valorUnitario,
      f.unidadeMedida,
      formatarDataBR(f.dataContrato),
    ]);

    row.getCell(5).numFmt = '"R$"#,##0.00';

    const cor = outliersIds.has(f.id)
      ? COR_OUTLIER
      : validosIds.has(f.id)
      ? COR_VALIDO
      : "FFFFFF";

    row.eachCell((cell) => {
      cell.fill = headerFill(cor);
      cell.border = borda();
    });
  });

  // Resultado
  ws.addRow([]);
  const resRow = ws.addRow([
    "PREÇO DE REFERÊNCIA",
    "",
    "",
    "",
    pesquisa.analise.precoReferencia,
    pesquisa.params.unidadeMedida,
    "",
  ]);
  resRow.getCell(1).font = cellFont(true, "FFFFFF");
  resRow.getCell(1).fill = headerFill(COR_HEADER);
  resRow.getCell(5).numFmt = '"R$"#,##0.00';
  resRow.getCell(5).font = cellFont(true);
  resRow.getCell(5).fill = headerFill(COR_VALIDO);
  resRow.eachCell((c) => (c.border = borda()));

  ws.columns = [
    { key: "a", width: 10 },
    { key: "b", width: 35 },
    { key: "c", width: 28 },
    { key: "d", width: 50 },
    { key: "e", width: 20 },
    { key: "f", width: 14 },
    { key: "g", width: 14 },
  ];
}

// ─── Aba: Alertas e Pendências ────────────────────────────────────────────────

function criarAbaAlertas(wb: ExcelJS.Workbook, pesquisa: PesquisaPrecos): void {
  const ws = wb.addWorksheet("Alertas e Pendências");

  ws.mergeCells("A1:C1");
  ws.getCell("A1").value = "ALERTAS E PENDÊNCIAS DA PESQUISA";
  ws.getCell("A1").font = cellFont(true, "FFFFFF");
  ws.getCell("A1").fill = headerFill(COR_HEADER);
  ws.getRow(1).height = 22;

  ws.addRow([]);

  const todos = [
    ...pesquisa.analise.alertas.map((a) => ({ tipo: "Alerta Estatístico", mensagem: a })),
    ...pesquisa.pendenciasHumanas.map((p) => ({ tipo: "Pendência Manual", mensagem: p })),
  ];

  ws.addRow(["Tipo", "Mensagem"]).eachCell((c) => {
    c.font = cellFont(true);
    c.border = borda();
  });

  todos.forEach(({ tipo, mensagem }) => {
    const row = ws.addRow([tipo, mensagem]);
    row.getCell(1).fill = headerFill(
      tipo.startsWith("Alerta") ? COR_ALERTA : COR_OUTLIER
    );
    row.eachCell((c) => (c.border = borda()));
    row.height = 18;
  });

  ws.getColumn(1).width = 25;
  ws.getColumn(2).width = 80;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Gera a planilha Excel completa de pesquisa de preços.
 * @param pesquisa Resultado da pesquisa de preços
 * @param caminhoSaida Caminho do arquivo .xlsx a gerar
 */
export async function gerarPlanilha(
  pesquisa: PesquisaPrecos,
  caminhoSaida: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "radar-precos-mcp";
  wb.lastModifiedBy = "radar-precos-mcp";
  wb.created = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  criarAbaMapa(wb, pesquisa);
  criarAbaSeriePrecos(wb, pesquisa);
  criarAbaAnaliseCritica(wb, pesquisa);
  criarAbaAlertas(wb, pesquisa);

  await wb.xlsx.writeFile(caminhoSaida);
}
