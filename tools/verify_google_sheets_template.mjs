import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("outputs/itera-leads-google-sheets-template.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);

const sheets = await workbook.inspect({
  kind: "sheet",
  include: "name",
  maxChars: 1000,
});
console.log(sheets.ndjson);

const leads = await workbook.inspect({
  kind: "table",
  range: "Leads!A1:K4",
  include: "values",
  tableMaxRows: 4,
  tableMaxCols: 11,
  maxChars: 3000,
});
console.log(leads.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  maxChars: 1000,
});
console.log(errors.ndjson);
