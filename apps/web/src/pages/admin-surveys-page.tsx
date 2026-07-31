import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SurveyDto } from '@soc/contracts';
import { SurveyApiError, surveyApi } from '@/lib/survey-api';

export function AdminSurveysPage() {
  const [items, setItems] = useState<SurveyDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    surveyApi.listAdmin(controller.signal).then((result) => { if (active) { setItems(result.items); setStatus('ready'); } }).catch((cause: unknown) => { if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) { setStatus('error'); setError(cause instanceof SurveyApiError && cause.status === 401 ? '관리자 로그인이 필요합니다.' : cause instanceof TypeError ? '네트워크 연결을 확인해 주세요.' : '설문 목록을 불러오지 못했습니다.'); } });
    return () => { active = false; controller.abort(); };
  }, []);
  return <section><div className="mb-6 flex items-center justify-between border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold">설문조사 관리</h1><Link to="/admin/surveys/new/edit" className="rounded bg-kaist-darkgreen-main px-4 py-2 text-white">새 설문 만들기</Link></div>{status === 'error' && <p role="alert" className="text-red-600">{error}</p>}{status === 'loading' && <p role="status">설문 목록을 불러오는 중...</p>}{status === 'ready' && items.length === 0 && <p>등록된 설문이 없습니다.</p>}{status === 'ready' && items.length > 0 && <div className="rounded bg-white p-5 shadow"><table className="w-full text-left"><thead><tr><th>설문명</th><th>상태</th><th>수정일</th><th /></tr></thead><tbody>{items.map((survey) => <tr key={survey.id} className="border-t"><td>{survey.title.value ?? ''}</td><td>{survey.state}</td><td>{new Date(survey.updatedAt).toLocaleString()}</td><td className="flex gap-3"><Link to={`/admin/surveys/${survey.id}/edit`}>편집</Link><Link to={`/admin/surveys/${survey.id}/responses`}>응답/분석</Link></td></tr>)}</tbody></table></div>}</section>;
}
