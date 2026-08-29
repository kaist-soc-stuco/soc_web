import { createApiClient } from '@soc/api-client';
import { nowMs } from '@soc/shared';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AdminLayout } from '@/components/organisms/admin-layout';
import { AuthGuard } from '@/components/guards/auth-guard';
import { useCurrentSession } from '@/hooks/use-current-session';
import { resolveApiBaseUrl } from '@/lib/api-base-url';
import { PublicOperationalContent } from '@/features/site-content/public-operational-content';
import { ChannelTalkProvider } from '@/features/channel-talk/channel-talk-provider';
import { BoardPage } from '@/pages/board-page';
import { FaqPage } from '@/pages/faq-page';

const HomePage = lazy(() =>
  import('@/pages/home-page').then((module) => ({ default: module.HomePage })),
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
const VoteListPage = lazy(() =>
  import('@/pages/vote-list-page').then((module) => ({ default: module.VoteListPage })),
);
const VotePage = lazy(() =>
  import('@/pages/vote-page').then((module) => ({ default: module.VotePage })),
);
const AdminVoteListPage = lazy(() =>
  import('@/pages/admin/vote-list-page').then((module) => ({ default: module.VoteListPage })),
);
const VoteEditorPage = lazy(() =>
  import('@/pages/admin/vote-editor-page').then((module) => ({ default: module.VoteEditorPage })),
);
const BoardManagementPage = lazy(() =>
  import('@/pages/admin/board-management-page').then((module) => ({ default: module.BoardManagementPage })),
);
const FaqManagementPage = lazy(() =>
  import('@/pages/admin/faq-management-page').then((module) => ({ default: module.FaqManagementPage })),
);
const ContentModerationPage = lazy(() =>
  import('@/pages/admin/content-moderation-page').then((module) => ({ default: module.ContentModerationPage })),
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
const RoadmapPage = lazy(() =>
  import('@/pages/roadmap-page').then((module) => ({ default: module.RoadmapPage })),
);
const EventsSurveysPage = lazy(() =>
  import('@/pages/events-surveys-page').then((module) => ({ default: module.EventsSurveysPage })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/privacy-page').then((module) => ({ default: module.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import('@/pages/terms-page').then((module) => ({ default: module.TermsPage })),
);
const SearchPage = lazy(() =>
  import('@/pages/search-page').then((module) => ({ default: module.SearchPage })),
);
const ContactsPage = lazy(() =>
  import('@/pages/admin/contacts-page').then((module) => ({ default: module.ContactsPage })),
);
const SiteContentPage = lazy(() =>
  import('@/pages/admin/site-content-page').then((module) => ({ default: module.SiteContentPage })),
);
const RoadmapManagementPage = lazy(() =>
  import('@/pages/admin/roadmap-management-page').then((module) => ({ default: module.RoadmapManagementPage })),
);
const CalendarManagementPage = lazy(() =>
  import('@/pages/admin/calendar-management-page').then((module) => ({ default: module.CalendarManagementPage })),
);
const BulkEmailPage = lazy(() =>
  import('@/pages/admin/bulk-email-page').then((module) => ({ default: module.BulkEmailPage })),
);
const AdminIndexPage = lazy(() =>
  import('@/pages/admin/admin-index-page').then((module) => ({ default: module.AdminIndexPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/not-found-page').then((module) => ({ default: module.NotFoundPage })),
);

function LegacyEventsSurveysRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const destination = tab === 'survey' ? '/surveys' : tab === 'calendar' ? '/calendar' : '/events';
  const selected = searchParams.get('selected');
  const query = selected ? `?selected=${encodeURIComponent(selected)}` : '';

  return <Navigate to={`${destination}${query}`} replace />;
}

/**
 * Keep an authenticated session alive while the user is actively using the site.
 * Refresh rotation is server-side sliding expiry; this client trigger makes route
 * changes and returning to a visible tab count as activity without refreshing
 * continuously in the background.
 */
function SessionKeepAlive() {
  const location = useLocation();
  const { data: session } = useCurrentSession();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    if (!session?.authenticated || session.storageMode === 'temporary') return;

    let cancelled = false;
    const refreshIfNeeded = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;

      const now = nowMs();
      if (now - lastRefreshAtRef.current < 9 * 60 * 1000) return;

      lastRefreshAtRef.current = now;
      try {
        if (cancelled) return;
        await apiClient.refreshSession();
      } catch {
        // Normal API requests still own the expired-session redirect path.
        // Do not interrupt navigation because a background refresh was late.
        lastRefreshAtRef.current = 0;
      }
    };

    void refreshIfNeeded();
    const intervalId = window.setInterval(() => void refreshIfNeeded(), 10 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshIfNeeded();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [apiClient, location.pathname, location.search, session?.authenticated]);

  return null;
}

function PreventImageGhostDrag() {
  useEffect(() => {
    const preventImageDrag = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    };

    document.addEventListener('dragstart', preventImageDrag);
    return () => document.removeEventListener('dragstart', preventImageDrag);
  }, []);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <PreventImageGhostDrag />
      <SessionKeepAlive />
      <ChannelTalkProvider>
        <PublicOperationalContent />
        <Suspense fallback={null}>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/life/roadmap" element={<RoadmapPage />} />
          <Route path="/about/roadmap" element={<Navigate to="/life/roadmap" replace />} />
          <Route path="/events-surveys" element={<LegacyEventsSurveysRedirect />} />
          <Route path="/events" element={<EventsSurveysPage view="event" />} />
          <Route path="/events/:articleId" element={<BoardDetailPage forcedCategory="_EVENT" publicBasePath="/events" />} />
          <Route path="/events/write" element={<AuthGuard><BoardWritePage forcedCategory="_EVENT" /></AuthGuard>} />
          <Route path="/events/:articleId/edit" element={<AuthGuard><BoardEditPage forcedCategory="_EVENT" /></AuthGuard>} />
          <Route path="/surveys" element={<EventsSurveysPage view="survey" />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/board/faq" element={<FaqPage />} />
          <Route path="/board/faq/:articleId" element={<BoardDetailPage forcedCategory="faq" publicBasePath="/board/faq" />} />
          <Route path="/about/faq" element={<Navigate to="/board/faq" replace />} />
          <Route path="/about/pledges" element={<Navigate to="/about#work" replace />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/calendar" element={<EventsSurveysPage view="calendar" />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/board/FAQ" element={<Navigate to="/board/faq" replace />} />
          <Route path="/board/_EVENT" element={<Navigate to="/events" replace />} />
          <Route path="/board/_EVENT/write" element={<Navigate to="/events/write" replace />} />
          <Route
            path="/board/write"
            element={
              <AuthGuard>
                <BoardWritePage />
              </AuthGuard>
            }
          />
          <Route
            path="/board/:category/write"
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
          <Route path="/votes" element={<VoteListPage />} />
          <Route path="/votes/:id" element={<VotePage />} />
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
            <Route path="boards" element={<BoardManagementPage />} />
            <Route path="faq" element={<FaqManagementPage />} />
            <Route path="moderation" element={<ContentModerationPage />} />
            <Route path="surveys/new" element={<SurveyEditorPage />} />
            <Route path="surveys/:id/edit" element={<SurveyEditorPage />} />
            <Route path="surveys/:id/responses" element={<SurveyResponseListPage />} />
            <Route path="surveys/:id/responses/:responseId" element={<SurveyResponseDetailPage />} />
            <Route path="votes" element={<AdminVoteListPage />} />
            <Route path="votes/new" element={<VoteEditorPage />} />
            <Route path="votes/:id" element={<VoteEditorPage />} />
            <Route path="content" element={<SiteContentPage />} />
            <Route path="roadmap" element={<RoadmapManagementPage />} />
            <Route path="calendar" element={<CalendarManagementPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="emails" element={<BulkEmailPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ChannelTalkProvider>
    </BrowserRouter>
  );
}
