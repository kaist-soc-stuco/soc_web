import { Navigate } from 'react-router-dom';

import { useAdminGrants } from '@/lib/admin-grants';
import { visibleAdminMenu } from '@/lib/static-site-content';

export function AdminIndexRedirect() {
  const grants = useAdminGrants();
  const menu = visibleAdminMenu(grants.grants);

  if (grants.status === 'idle' || grants.status === 'loading') {
    return <p className="text-sm font-semibold text-[#39404B]">권한을 확인하는 중입니다.</p>;
  }

  if (grants.status === 'error') {
    return <p role="alert" className="text-sm font-semibold text-red-700">관리 권한을 불러올 수 없습니다.</p>;
  }

  const firstVisible = menu[0];
  if (!firstVisible) {
    return <p role="alert" className="text-sm font-semibold text-red-700">접근 가능한 관리 메뉴가 없습니다.</p>;
  }

  return <Navigate to={firstVisible.to} replace />;
}
