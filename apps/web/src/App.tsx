import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/home-page';
import { BoardPage } from '@/pages/board-page';
import { TreeLogin } from '@/pages/login-page';
import { LoginConsentPage } from '@/pages/login-consent-page';
import { SurveyPage } from '@/pages/survey-page';
import { SurveyListPage } from '@/pages/admin/survey-list-page';
import { SurveyEditorPage } from '@/pages/admin/survey-editor-page';
import { SurveyResponseListPage } from '@/pages/admin/survey-response-list-page';
import { SurveyResponseDetailPage } from '@/pages/admin/survey-response-detail-page';
import { PermissionPage } from '@/pages/admin/permission-page';
import { FeeManagementPage } from '@/pages/admin/fee-management-page';
import { BoardDetailPage } from '@/pages/board-detail-page';
import { BoardWritePage } from '@/pages/board-write-page';
import { MyPage } from '@/pages/my-page';


import { AdminLayout } from '@/components/organisms/admin-layout';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/board/:category" element={<BoardPage />} />
        <Route path="/board/:category/write" element={<BoardWritePage />} />
        <Route path="/board/:category/:articleId" element={<BoardDetailPage />} />
        <Route path="/survey/:id" element={<SurveyPage />} />
        <Route path="/login" element={<TreeLogin />} />
        <Route path="/login/consent" element={<LoginConsentPage />} />
        <Route path="/mypage" element={<MyPage />} />

        {/* Admin Routes with nested Outlet */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="surveys" element={<SurveyListPage />} />
          <Route path="permissions" element={<PermissionPage />} />
          <Route path="finance" element={<FeeManagementPage />} />
          <Route path="surveys/new" element={<SurveyEditorPage />} />
          <Route path="surveys/:id/edit" element={<SurveyEditorPage />} />
          <Route path="surveys/:id/responses" element={<SurveyResponseListPage />} />
          <Route path="surveys/:id/responses/:responseId" element={<SurveyResponseDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
