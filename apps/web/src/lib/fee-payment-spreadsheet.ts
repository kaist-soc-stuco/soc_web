import { StudentFeePaymentImportRowSchema, type StudentFeePaymentImportRow } from "@soc/contracts";
import * as XLSX from "xlsx";

export function createFeePaymentTemplate(): Blob {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["학번", "이름", "입금액", "입금일", "납부 방법", "메모"]]);
  sheet["!cols"] = [14, 18, 16, 16, 16, 40].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(book, sheet, "입금 등록");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["필수 항목", "학번(8자리) · 이름 · 입금액 · 입금일"],
    ["입금액", "이번에 실제로 입금한 금액을 입력하세요."],
    ["입금일", "YYYY-MM-DD 형식으로 입력하세요. 예: 2026-10-31"],
    ["납부 방법", "계좌이체 · 현금 · 기타 중 입력하세요. 비워 두면 계좌이체로 등록됩니다."],
    ["여러 입금", "같은 학생의 여러 입금은 각각 한 행에 입력하세요. 이번에 등록할 입금만 포함하세요."],
    ["신규 학생", "명부에 없는 학번은 입금 등록과 함께 명부에 추가됩니다."],
    ["기존 기록 정정", "사이트의 납부 상세에서 정정·취소하세요."],
  ]), "작성 안내");
  return new Blob([XLSX.write(book, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function parseFeePaymentSpreadsheet(input: ArrayBuffer): StudentFeePaymentImportRow[] {
  let book: XLSX.WorkBook;
  try { book = XLSX.read(input, { type: "array", cellDates: false }); }
  catch { throw new Error("엑셀 파일을 읽지 못했습니다. 입금 등록 양식을 사용해 주세요."); }
  const sheet = book.Sheets["입금 등록"] ?? book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("입금 등록 시트가 없습니다.");
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const header = (data[0] ?? []).map(cell => String(cell).trim().replace(/\s+/g, ""));
  const aliases = [["학번"], ["이름"], ["입금액", "입금금액", "이번입금액"], ["입금일", "입금일자"], ["납부방법", "입금방법"], ["메모"]];
  const columns = aliases.map(names => header.findIndex(value => names.includes(value)));
  if (columns.slice(0, 4).some(column => column < 0)) throw new Error("입금 등록 양식의 학번·이름·입금액·입금일 열이 필요합니다. 전체 명부 파일은 입금 등록에 사용할 수 없습니다.");
  if (aliases.some(names => header.filter(value => names.includes(value)).length > 1)) throw new Error("중복된 열 제목을 확인해 주세요.");
  const methods: Record<string, StudentFeePaymentImportRow["paymentMethod"]> = {
    "": "BANK_TRANSFER", "계좌이체": "BANK_TRANSFER", "현금": "CASH", "기타": "OTHER",
    BANK_TRANSFER: "BANK_TRANSFER", CASH: "CASH", OTHER: "OTHER",
  };
  const entries: StudentFeePaymentImportRow[] = [];
  data.slice(1).forEach((cells, index) => {
    if (!cells.some(value => String(value).trim())) return;
    const get = (column: number) => columns[column] < 0 ? "" : cells[columns[column]] ?? "";
    const amountText = String(get(2)).trim();
    const amount = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(amountText) ? Number(amountText.replaceAll(",", "")) : Number.NaN;
    let paidDate = String(get(3)).trim();
    if (typeof get(3) === "number") {
      const date = XLSX.SSF.parse_date_code(get(3) as number, { date1904: book.Workbook?.WBProps?.date1904 });
      paidDate = date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : "";
    }
    if (!Object.hasOwn(methods, String(get(4)).trim())) throw new Error(`${index + 2}행의 납부 방법을 확인해 주세요. 계좌이체·현금·기타 중 입력할 수 있습니다.`);
    const result = StudentFeePaymentImportRowSchema.safeParse({ stdNo: String(get(0)).trim(), nameKo: String(get(1)).trim(),
      amount, paidDate, paymentMethod: methods[String(get(4)).trim()], note: String(get(5)).trim() || null });
    if (!result.success) {
      const labels: Record<string, string> = { stdNo: "학번(8자리)", nameKo: "이름", amount: "입금액(1원 이상 정수)", paidDate: "입금일(YYYY-MM-DD)", paymentMethod: "납부 방법", note: "메모(500자 이내)" };
      throw new Error(`${index + 2}행의 ${labels[String(result.error.issues[0].path[0])] ?? "입력값"}을 확인해 주세요.`);
    }
    entries.push(result.data);
  });
  if (!entries.length || entries.length > 1000) throw new Error("한 번에 1~1,000건의 입금을 등록할 수 있습니다.");
  return entries;
}
