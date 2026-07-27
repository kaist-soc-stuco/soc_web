import { AdminList } from '@/components/organisms/admin-list';

export function AdminPaymentsPage() {
  return (
    <section>
      <div className="mb-6 border-b border-kaist-grey/25 pb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">과비 납부 관리</h1>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="rounded-[5px] border border-kaist-grey/25 bg-white px-4 py-1.5 text-sm font-semibold text-kaist-black">2026</div>
        <span className="text-base font-extrabold text-kaist-black">학년도</span>
      </div>

      <AdminList
        title="과비 납부 리스트"
        description="결제 내역은 아직 API에서 제공되지 않아 표시할 수 없습니다."
        columns={[
          { key: 'id', label: '번호' },
          { key: 'year', label: '학년도' },
          { key: 'semester', label: '학기' },
          { key: 'category', label: '구분' },
          { key: 'status', label: '상태' },
          { key: 'updatedAt', label: '수정일' },
        ]}
        rows={[]}
        compact
      />
    </section>
  );
}
