import { uiText } from "@/lib/i18n/surface-catalog";
import { useLocale } from '@/lib/locale-store';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AdminRouteGuard, NotFoundPage } from '@/components/organisms/admin-route-guard';
import { getEvent } from '@/lib/event-api';
const AdminPage = lazy(() => import('@/pages/admin-page').then((module) => ({ default: module.AdminPage })));
const AboutPage = lazy(() => import('@/pages/about-page').then((module) => ({ default: module.AboutPage })));
const HomePage = lazy(() => import('@/pages/home-page').then((module) => ({ default: module.HomePage })));
const BoardHubPage = lazy(() => import('@/pages/board-hub-page').then((module) => ({ default: module.BoardHubPage })));
const BoardPage = lazy(() => import('@/pages/board-page').then((module) => ({ default: module.BoardPage })));
const BoardPostPage = lazy(() => import('@/pages/board-post-page').then((module) => ({ default: module.BoardPostPage })));
const BoardWritePage = lazy(() => import('@/pages/board-write-page').then((module) => ({ default: module.BoardWritePage })));
const CalendarPage = lazy(() => import('@/pages/calendar-page').then((module) => ({ default: module.CalendarPage })));
const EventsPage = lazy(() => import('@/pages/events-page').then((module) => ({ default: module.EventsPage })));
const EventSurveyPage = lazy(() => import('@/pages/event-survey-page').then((module) => ({ default: module.EventSurveyPage })));
const FaqPage = lazy(() => import('@/pages/faq-page').then((module) => ({ default: module.FaqPage })));
const RoadmapPage = lazy(() => import('@/pages/roadmap-page').then((module) => ({ default: module.RoadmapPage })));
const TreeLogin = lazy(() => import('@/pages/login-page').then((module) => ({ default: module.TreeLogin })));
const LoginConsentPage = lazy(() => import('@/pages/login-consent-page').then((module) => ({ default: module.LoginConsentPage })));
const ChatPage = lazy(() => import('@/pages/chat-page').then((module) => ({ default: module.ChatPage })));
const MyPage = lazy(() => import('@/pages/mypage-page').then((module) => ({ default: module.MyPage })));
const AdminDashboardPage = lazy(() => import('@/pages/admin-dashboard-page').then((module) => ({ default: module.AdminDashboardPage })));
const AdminPaymentsPage = lazy(() => import('@/pages/admin-payments-page').then((module) => ({ default: module.AdminPaymentsPage })));
const AdminSurveysPage = lazy(() => import('@/pages/admin-surveys-page').then((module) => ({ default: module.AdminSurveysPage })));
const AdminSurveyEditPage = lazy(() => import('@/pages/admin-survey-edit-page').then((module) => ({ default: module.AdminSurveyEditPage })));
const AdminSurveyOperationsPage = lazy(() => import('@/pages/admin-survey-operations-page').then((module) => ({ default: module.AdminSurveyOperationsPage })));
const AdminContactsPage = lazy(() => import('@/pages/admin-contacts-page').then((module) => ({ default: module.AdminContactsPage })));
const AdminEmailsPage = lazy(() => import('@/pages/admin-emails-page').then((module) => ({ default: module.AdminEmailsPage })));
const AdminUsersPage = lazy(() => import('@/pages/admin-users-page').then((module) => ({ default: module.AdminUsersPage })));
const AdminPermissionsPage = lazy(() => import('@/pages/admin-permissions-page').then((module) => ({ default: module.AdminPermissionsPage })));
const AdminAuditLogsPage = lazy(() => import('@/pages/admin-audit-logs-page').then((module) => ({ default: module.AdminAuditLogsPage })));
const AdminBoardsPage = lazy(() => import('@/pages/admin-boards-page').then((module) => ({ default: module.AdminBoardsPage })));
const AdminFaqsPage = lazy(() => import('@/pages/admin-faqs-page').then((module) => ({ default: module.AdminFaqsPage })));
const AdminEventsPage = lazy(() => import('@/pages/admin-events-page').then((module) => ({ default: module.AdminEventsPage })));
export function LegacyEventSurveyResolver() {
    const { eventId } = useParams<{
        eventId: string;
    }>();
    const [resolution, setResolution] = useState<{
        eventId: string;
        surveyId: string;
    } | null>(null);
    const [status, setStatus] = useState<'loading' | 'unavailable' | 'error'>('loading');
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setResolution(null);
        setStatus('loading');
        if (!eventId) {
            setStatus('unavailable');
            return () => controller.abort();
        }
        getEvent(eventId, 'ko', controller.signal)
            .then((event) => {
            if (!active)
                return;
            if (typeof event.surveyId === 'string' && event.surveyId.length > 0) {
                setResolution({ eventId, surveyId: event.surveyId });
            }
            else
                setStatus('unavailable');
        })
            .catch((cause: unknown) => {
            if (active && !(cause instanceof DOMException && cause.name === 'AbortError'))
                setStatus('error');
        });
        return () => {
            active = false;
            controller.abort();
        };
    }, [eventId]);
    if (resolution && resolution.eventId === eventId)
        return <Navigate to={`/survey/${encodeURIComponent(resolution.surveyId)}`} replace/>;
    if (status === 'error')
        return <p>{uiText("App.ccca9796cc")}</p>;
    if (status === 'unavailable')
        return <p>{uiText("App.937a5efd07")}</p>;
    return <p>{uiText("App.2f8f15073b")}</p>;
}
export function App() {
    useLocale();
    return (<BrowserRouter>
      <Suspense fallback={<p role="status" className="p-8">{uiText("App.62efc07b34")}</p>}>
        <Routes>
        <Route path="/" element={<HomePage />}/>
        <Route path="/events" element={<EventsPage />}/>
        <Route path="/events/:eventId/survey" element={<LegacyEventSurveyResolver />}/>
        <Route path="/survey/:surveyId" element={<EventSurveyPage />}/>
        <Route path="/about" element={<AboutPage />}/>
        <Route path="/about/roadmap" element={<RoadmapPage />}/>
        <Route path="/faq" element={<FaqPage />}/>
        <Route path="/calendar" element={<CalendarPage />}/>
        <Route path="/board" element={<BoardHubPage />}/>
        <Route path="/board/:category" element={<BoardPage />}/>
        <Route path="/board/:category/write" element={<BoardWritePage />}/>
        <Route path="/board/:category/:id" element={<BoardPostPage />}/>
        <Route path="/chat" element={<ChatPage />}/>
        <Route path="/mypage" element={<MyPage />}/>
        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<AdminDashboardPage />}/>
          <Route path="payments" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'FEES_MANAGE' }}><AdminPaymentsPage /></AdminRouteGuard>}/>
          <Route path="surveys" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'SURVEY_MANAGE' }}><AdminSurveysPage /></AdminRouteGuard>}/>
          <Route path="surveys/:surveyId/edit" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'SURVEY_MANAGE' }}><AdminSurveyEditPage /></AdminRouteGuard>}/>
          <Route path="surveys/:surveyId/responses" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'SURVEY_MANAGE' }}><AdminSurveyOperationsPage /></AdminRouteGuard>}/>
          <Route path="emails" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'MAIL_SEND' }}><AdminEmailsPage /></AdminRouteGuard>}/>
          <Route path="contacts" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'CONTACTS_MANAGE' }}><AdminContactsPage /></AdminRouteGuard>}/>
          <Route path="users" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'USERS_MANAGE' }}><AdminUsersPage /></AdminRouteGuard>}/>
          <Route path="permissions" element={<AdminRouteGuard requirement={{ kind: 'WORKFLOW' }}><AdminPermissionsPage /></AdminRouteGuard>}/>
          <Route path="audit-logs" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'PERMISSION_AUDIT' }}><AdminAuditLogsPage /></AdminRouteGuard>}/>
          <Route path="boards" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'BOARD_MANAGE' }}><AdminBoardsPage /></AdminRouteGuard>}/>
          <Route path="faqs" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'FAQ_MANAGE' }}><AdminFaqsPage /></AdminRouteGuard>}/>
          <Route path="events" element={<AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'EVENT_MANAGE' }}><AdminEventsPage /></AdminRouteGuard>}/>
          <Route path="*" element={<NotFoundPage />}/>
        </Route>
        <Route path="/login" element={<TreeLogin />}/>
        <Route path="/login/consent" element={<LoginConsentPage />}/>
        <Route path="*" element={<NotFoundPage />}/>
        </Routes>
      </Suspense>
    </BrowserRouter>);
}
