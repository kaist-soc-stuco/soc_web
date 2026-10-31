import { StudentFeePaymentImportRowSchema, type StudentFeePaymentImportRow } from "@soc/contracts";
import { nowDate } from "@soc/shared";
import * as XLSX from "xlsx";

const exampleName = "홍길동(예시)";
const exampleNote = "예시 행 · 업로드 시 제외";

export function createFeePaymentTemplate(): Blob {
  const book = XLSX.utils.book_new();
  const today = nowDate().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const serial = Date.parse(`${today}T00:00:00Z`) / 86400000 + 25569;
  const sheet = XLSX.utils.aoa_to_sheet([
    ["학번", "이름", "입금액", "입금일", "메모"],
    ["20260000", exampleName, 45000, serial, exampleNote],
  ]);
  sheet["!cols"] = [14, 20, 16, 18, 44].map(wch => ({ wch }));
  for (let row = 1; row <= 1001; row++) {
    for (let column = 0; column < 5; column++) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = sheet[address] ?? { t: "s", v: "" };
      cell.z = column === 2 ? "#,##0" : column === 3 ? "yyyy-mm-dd" : "@";
      sheet[address] = cell;
    }
  }
  sheet["!ref"] = "A1:E1002";
  sheet["!autofilter"] = { ref: "A1:E1002" };
  XLSX.utils.book_append_sheet(book, sheet, "입금 등록");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["작성 위치", "2행은 예시로 업로드에서 자동 제외됩니다. 3행부터 입력하거나 예시를 실제 정보로 바꿔 주세요."],
    ["필수 항목", "학번(8자리) · 이름 · 이번 입금액 · 입금일. 메모는 선택입니다."],
    ["학번", "텍스트 서식입니다. 이름은 명부에 등록된 이름과 일치하게 입력하세요."],
    ["입금액", "이번에 받은 금액을 입력하세요. 예: 45000 또는 45,000. 기존 누적 금액은 입력하지 마세요."],
    ["입금일", "엑셀 날짜, 2026-10-31, 2026.10.31, 2026/10/31, 20261031, 2026년 10월 31일 형식을 사용할 수 있습니다."],
    ["여러 입금", "이번에 등록할 입금만 한 건씩 입력하세요. 같은 학생의 여러 입금은 각각 한 행에 입력하세요."],
    ["신규 학생", "명부에 없는 학번은 입금 등록과 함께 명부에 추가됩니다."],
    ["입금 취소", "잘못 등록한 입금은 사이트의 납부 상세에서 취소하세요."],
  ]), "작성 안내");
  // SheetJS CE does not serialize frozen panes; add the standard OOXML pane to its ZIP.
  const zip = XLSX.CFB.read(new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" })), { type: "buffer" });
  const path = "xl/worksheets/sheet1.xml";
  const entry = XLSX.CFB.find(zip, path);
  const xml = new TextDecoder().decode(entry.content);
  const views = '<sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C3" sqref="C3"/></sheetView></sheetViews>';
  XLSX.CFB.utils.cfb_add(zip, path, new TextEncoder().encode(/<sheetViews[\s\S]*?<\/sheetViews>/.test(xml) ? xml.replace(/<sheetViews[\s\S]*?<\/sheetViews>/, views) : xml.replace(/<sheetFormatPr|<cols|<sheetData/, match => views + match)));
  return new Blob([new Uint8Array(XLSX.CFB.write(zip, { fileType: "zip", type: "array" }))], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function parsePaidDate(value: unknown, date1904?: boolean): string {
  const text = String(value ?? "").trim();
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}`;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value, { date1904 });
    return date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : "";
  }
  const normalized = text.replace(/년|월/g, "-").replace(/일/g, "").replace(/\s*([-/.])\s*/g, "$1");
  const match = normalized.match(/^(\d{4}|\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  return match ? `${match[1].length === 2 ? "20" : ""}${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : normalized;
}

export function parseFeePaymentSpreadsheet(input: ArrayBuffer): StudentFeePaymentImportRow[] {
  let book: XLSX.WorkBook;
  try { book = XLSX.read(input, { type: "array", cellDates: false }); }
  catch { throw new Error("엑셀 파일을 읽지 못했습니다. 입금 등록 양식을 사용해 주세요."); }
  const sheet = book.Sheets["입금 등록"] ?? book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("입금 등록 시트가 없습니다.");
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const header = (data[0] ?? []).map(cell => String(cell).trim().replace(/\s+/g, ""));
  const aliases = [["학번"], ["이름", "성명"], ["입금액", "입금금액", "이번입금액"], ["입금일", "입금일자", "납부일"], ["메모", "비고"]];
  const columns = aliases.map(names => header.findIndex(value => names.includes(value)));
  if (columns.slice(0, 4).some(column => column < 0)) throw new Error("입금 등록 양식의 학번·이름·입금액·입금일 열이 필요합니다. 전체 명부 파일은 입금 등록에 사용할 수 없습니다.");
  if (aliases.some(names => header.filter(value => names.includes(value)).length > 1)) throw new Error("중복된 열 제목을 확인해 주세요.");
  const entries: StudentFeePaymentImportRow[] = [];
  data.slice(1).forEach((cells, index) => {
    if (!cells.some(value => String(value).trim())) return;
    const get = (column: number) => columns[column] < 0 ? "" : cells[columns[column]] ?? "";
    if (String(get(0)).trim() === "20260000" && String(get(1)).trim() === exampleName && String(get(4)).trim() === exampleNote) return;
    const amountText = String(get(2)).trim().replace(/^₩\s*/, "").replace(/\s*원$/, "");
    const amount = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(amountText) ? Number(amountText.replaceAll(",", "")) : Number.NaN;
    const paidDate = parsePaidDate(get(3), book.Workbook?.WBProps?.date1904);
    const result = StudentFeePaymentImportRowSchema.safeParse({ stdNo: String(get(0)).trim(), nameKo: String(get(1)).trim(), amount, paidDate, note: String(get(4)).trim() || null });
    if (!result.success) {
      const labels: Record<string, string> = { stdNo: "학번(8자리)", nameKo: "이름", amount: "입금액(1원 이상 정수)", paidDate: "입금일(연·월·일)", note: "메모(500자 이내)" };
      throw new Error(`${index + 2}행의 ${labels[String(result.error.issues[0].path[0])] ?? "입력값"}을 확인해 주세요.`);
    }
    entries.push(result.data);
  });
  if (!entries.length || entries.length > 1000) throw new Error("예시를 제외한 실제 입금 내역을 1~1,000건 입력해 주세요.");
  return entries;
}
