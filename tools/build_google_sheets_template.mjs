import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.join(process.cwd(), "outputs");
const outputPath = path.join(outputDir, "itera-leads-google-sheets-template.xlsx");

const workbook = Workbook.create();

const leads = workbook.worksheets.add("Leads");
leads.showGridLines = false;

const headers = [
  "Fecha",
  "Origen",
  "Nombre",
  "Email",
  "Telefono",
  "Empresa",
  "Servicio",
  "Necesidad",
  "Estado",
  "Score",
  "Session",
];

const sampleRows = [
  [
    new Date(),
    "formulario",
    "Ejemplo Cliente",
    "cliente@empresa.com",
    "+34 600 000 000",
    "Empresa Demo",
    "Automatización de Flujos",
    "Quiere automatizar gestión de leads y agenda.",
    "nuevo",
    55,
    "session_demo_form",
  ],
  [
    new Date(),
    "chat",
    "Lead desde Chat",
    "lead@empresa.com",
    "",
    "Startup IA",
    "Chatbots e IA Conversacional",
    "Ha preguntado por atención al cliente 24/7.",
    "templado",
    35,
    "session_demo_chat",
  ],
];

leads.getRange("A1:K1").values = [headers];
leads.getRange("A2:K3").values = sampleRows;
leads.getRange("A1:K1").format = {
  fill: "#0F172A",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
};
leads.getRange("A1:K3").format = {
  wrapText: true,
  verticalAlignment: "top",
};
leads.getRange("A2:A200").format.numberFormat = "yyyy-mm-dd hh:mm";
leads.getRange("J2:J200").format.numberFormat = "0";
leads.getRange("A1:K200").format.font = { name: "Arial", size: 10 };
leads.getRange("A1:K1").format.rowHeightPx = 28;
leads.getRange("H2:H200").format.wrapText = true;

leads.getRange("A:A").format.columnWidthPx = 145;
leads.getRange("B:B").format.columnWidthPx = 110;
leads.getRange("C:C").format.columnWidthPx = 150;
leads.getRange("D:D").format.columnWidthPx = 190;
leads.getRange("E:E").format.columnWidthPx = 145;
leads.getRange("F:F").format.columnWidthPx = 160;
leads.getRange("G:G").format.columnWidthPx = 190;
leads.getRange("H:H").format.columnWidthPx = 320;
leads.getRange("I:I").format.columnWidthPx = 110;
leads.getRange("J:J").format.columnWidthPx = 80;
leads.getRange("K:K").format.columnWidthPx = 180;

leads.tables.add("A1:K200", true, "LeadsTable");
leads.freezePanes.freezeRows(1);

leads.getRange("B2:B200").dataValidation = {
  rule: { type: "list", values: ["formulario", "chat"] },
};
leads.getRange("I2:I200").dataValidation = {
  rule: { type: "list", values: ["nuevo", "frio", "templado", "caliente", "demo_solicitada", "contactado", "cerrado"] },
};

const readme = workbook.worksheets.add("README");
readme.showGridLines = false;
readme.getRange("A1:D1").merge();
readme.getRange("A1:D1").values = [["ITERA - Plantilla de Google Sheets para n8n"]];
readme.getRange("A1:D1").format = {
  fill: "#0F172A",
  font: { bold: true, color: "#FFFFFF", size: 14 },
};
readme.getRange("A3:D14").values = [
  ["Uso", "Importa este XLSX en Google Sheets y copia el ID de la URL." , "", ""],
  ["Workflow", "Los nodos de n8n deben apuntar a la pestaña Leads.", "", ""],
  ["Sheet ID", "Sustituye REPLACE_WITH_GOOGLE_SHEET_ID en ambos nodos Google Sheets.", "", ""],
  ["", "", "", ""],
  ["Columna", "Tipo", "Usada por", "Notas"],
  ["Fecha", "Fecha/hora", "Formulario y chat", "n8n usa $now"],
  ["Origen", "Texto", "Formulario y chat", "formulario o chat"],
  ["Nombre", "Texto", "Formulario y chat", "Puede venir vacío desde chat"],
  ["Email", "Texto", "Formulario y chat", "Lead principal"],
  ["Telefono", "Texto", "Formulario y chat", "Sin acento para coincidir con n8n"],
  ["Empresa", "Texto", "Formulario y chat", ""],
  ["Servicio", "Texto", "Formulario y chat", ""],
];
readme.getRange("A7:D7").format = {
  fill: "#E2E8F0",
  font: { bold: true, color: "#0F172A" },
};
readme.getRange("A1:D14").format = {
  wrapText: true,
  verticalAlignment: "top",
};
readme.getRange("A:A").format.columnWidthPx = 130;
readme.getRange("B:B").format.columnWidthPx = 260;
readme.getRange("C:C").format.columnWidthPx = 160;
readme.getRange("D:D").format.columnWidthPx = 260;

await fs.mkdir(outputDir, { recursive: true });

const preview = await workbook.render({
  sheetName: "Leads",
  range: "A1:K8",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "itera-leads-google-sheets-template-preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
