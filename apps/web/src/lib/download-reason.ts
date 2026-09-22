export function promptDownloadReason(): string | null {
  const value = window.prompt("개인정보 다운로드 사유를 입력해 주세요. (2~200자)");
  if (value === null) return null;

  const reason = value.trim();
  if (reason.length < 2 || reason.length > 200) {
    window.alert("다운로드 사유를 2~200자로 입력해 주세요.");
    return null;
  }

  return reason;
}
