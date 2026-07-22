import { AdminList } from '@/components/organisms/admin-list';
import { adminPaymentRows } from '@/lib/mock-data';

export function AdminPaymentsPage() {
  return (
    <section>
      <div className="mb-8 border-b border-kaist-grey/25 pb-5">
        <h1 className="text-[36px] font-extrabold tracking-tight text-kaist-black lg:text-[44px]">과비 납부 관리</h1>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="rounded-[5px] border border-kaist-grey/25 bg-white px-4 py-1.5 text-sm font-semibold text-kaist-black">2026</div>
        <span className="text-[18px] font-extrabold text-kaist-black">학년도</span>
      </div>

      <AdminList
        title="과비 납부 리스트"
        description="과비 납부 현황을 한 번에 확인할 수 있도록 Figma 표 스타일에 맞춘 기본 리스트입니다."
        columns={[
          { key: 'id', label: '번호' },
          { key: 'year', label: '학년도' },
          { key: 'semester', label: '학기' },
          { key: 'category', label: '구분' },
          { key: 'status', label: '상태' },
          { key: 'updatedAt', label: '수정일' },
        ]}
        rows={adminPaymentRows}
        compact
      />
    </section>
  );
}
