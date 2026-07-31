export function AdminEmailsPage() {
  return (
    <section aria-labelledby="mail-title">
      <div className="mb-6 border-b border-kaist-grey/25 pb-4">
        <h1 id="mail-title" className="text-[32px] font-extrabold tracking-tight text-kaist-black">이메일 일괄발송</h1>
      </div>
      <div className="rounded-[8px] border border-kaist-grey/25 bg-white p-6">
        <h2 className="text-lg font-extrabold text-kaist-darkgreen">현재 사용할 수 없는 기능입니다.</h2>
        <p className="mt-2 text-sm font-semibold text-kaist-grey">메일 발송 서비스가 구성될 때까지 수신자 정보 입력, 미리보기 및 발송 기능을 제공하지 않습니다.</p>
      </div>
    </section>
  );
}
