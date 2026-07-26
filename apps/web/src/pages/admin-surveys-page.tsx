import { AdminList } from '@/components/organisms/admin-list';
import { adminSurveyRows } from '@/lib/mock-data';

export function AdminSurveysPage() {
  return (
    <section>
      <div className="mb-6 border-b border-kaist-grey/25 pb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">설문조사 관리</h1>
      </div>

      <AdminList
        title="설문조사 관리 리스트"
        description="작성 중인 설문과 응답 중인 설문을 관리하고 편집 화면으로 이동할 수 있습니다."
        columns={[
          { key: 'id', label: '번호' },
          { key: 'title', label: '설문명' },
          { key: 'audience', label: '대상' },
          { key: 'status', label: '상태' },
          { key: 'updatedAt', label: '수정일' },
        ]}
        rows={adminSurveyRows}
        actionBasePath="/admin/surveys"
        actionLabel="새 설문 만들기"
        compact
      />
    </section>
  );
}
