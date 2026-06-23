import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/organisms/admin-layout';
import { AuthGuard } from '@/components/guards/auth-guard';

const HomePage = lazy(() =>
  import('@/pages/home-page').then((module) => ({ default: module.HomePage })),
);
const BoardPage = lazy(() =>
  import('@/pages/board-page').then((module) => ({ default: module.BoardPage })),
);
const LoginCallbackPage = lazy(() =>
  import('@/pages/login-callback-page').then((module) => ({ default: module.LoginCallbackPage })),
);
const SurveyPage = lazy(() =>
  import('@/pages/survey-page').then((module) => ({ default: module.SurveyPage })),
);
const SurveyResultsPage = lazy(() =>
  import('@/pages/survey-results-page').then((module) => ({ default: module.SurveyResultsPage })),
);
const SurveyListPage = lazy(() =>
  import('@/pages/admin/survey-list-page').then((module) => ({ default: module.SurveyListPage })),
);
const SurveyEditorPage = lazy(() =>
  import('@/pages/admin/survey-editor-page').then((module) => ({ default: module.SurveyEditorPage })),
);
const SurveyResponseListPage = lazy(() =>
  import('@/pages/admin/survey-response-list-page').then((module) => ({ default: module.SurveyResponseListPage })),
);
const SurveyResponseDetailPage = lazy(() =>
  import('@/pages/admin/survey-response-detail-page').then((module) => ({ default: module.SurveyResponseDetailPage })),
);
const PermissionPage = lazy(() =>
  import('@/pages/admin/permission-page').then((module) => ({ default: module.PermissionPage })),
);
const UserManagementPage = lazy(() =>
  import('@/pages/admin/user-management-page').then((module) => ({ default: module.UserManagementPage })),
);
const AuditLogPage = lazy(() =>
  import('@/pages/admin/audit-log-page').then((module) => ({ default: module.AuditLogPage })),
);
const FeeManagementPage = lazy(() =>
  import('@/pages/admin/fee-management-page').then((module) => ({ default: module.FeeManagementPage })),
);
const BoardDetailPage = lazy(() =>
  import('@/pages/board-detail-page').then((module) => ({ default: module.BoardDetailPage })),
);
const BoardWritePage = lazy(() =>
  import('@/pages/board-write-page').then((module) => ({ default: module.BoardWritePage })),
);
const BoardEditPage = lazy(() =>
  import('@/pages/board-edit-page').then((module) => ({ default: module.BoardEditPage })),
);
const MyPage = lazy(() =>
  import('@/pages/my-page').then((module) => ({ default: module.MyPage })),
);
const AboutPage = lazy(() =>
  import('@/pages/about-page').then((module) => ({ default: module.AboutPage })),
);
const EventsSurveysPage = lazy(() =>
  import('@/pages/events-surveys-page').then((module) => ({ default: module.EventsSurveysPage })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/privacy-page').then((module) => ({ default: module.PrivacyPage })),
);
const SearchPage = lazy(() =>
  import('@/pages/search-page').then((module) => ({ default: module.SearchPage })),
);
const ContactsPage = lazy(() =>
  import('@/pages/admin/contacts-page').then((module) => ({ default: module.ContactsPage })),
);
const BulkEmailPage = lazy(() =>
  import('@/pages/admin/bulk-email-page').then((module) => ({ default: module.BulkEmailPage })),
);
const AdminIndexPage = lazy(() =>
  import('@/pages/admin/admin-index-page').then((module) => ({ default: module.AdminIndexPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-slate-400">
      불러오는 중...
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/events-surveys" element={<EventsSurveysPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/calendar" element={<Navigate to="/events-surveys?tab=calendar" replace />} />
          <Route path="/board" element={<BoardPage />} />
          <Route
            path="/board/write"
            element={
              <AuthGuard>
                <BoardWritePage />
              </AuthGuard>
            }
          />
          <Route path="/board/:category" element={<BoardPage />} />
          <Route path="/board/:category/:articleId" element={<BoardDetailPage />} />
          <Route
            path="/board/:category/:articleId/edit"
            element={
              <AuthGuard>
                <BoardEditPage />
              </AuthGuard>
            }
          />
          <Route path="/survey/:id" element={<SurveyPage />} />
          <Route path="/survey/:id/results" element={<SurveyResultsPage />} />
          <Route path="/login" element={<LoginCallbackPage />} />
          <Route path="/mypage" element={<MyPage />} />

          {/* Admin Routes with nested Outlet */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminIndexPage />} />
            <Route path="surveys" element={<SurveyListPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route path="audit-logs" element={<AuditLogPage />} />
            <Route path="permissions" element={<PermissionPage />} />
            <Route path="finance" element={<FeeManagementPage />} />
            <Route path="surveys/new" element={<SurveyEditorPage />} />
            <Route path="surveys/:id/edit" element={<SurveyEditorPage />} />
            <Route path="surveys/:id/responses" element={<SurveyResponseListPage />} />
            <Route path="surveys/:id/responses/:responseId" element={<SurveyResponseDetailPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="emails" element={<BulkEmailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
