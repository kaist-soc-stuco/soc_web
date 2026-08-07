import { uiText } from "@/lib/i18n/surface-catalog";
import { refetchAdminGrants, useAdminGrants } from '@/lib/admin-grants';
import { useLocale } from '@/lib/locale-store';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useParams } from 'react-router-dom';
import { AdminRouteGuard, NotFoundPage } from '@/components/organisms/admin-route-guard';
import { hasGlobalGrant } from '@/lib/admin-access';
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
const VotesPage = lazy(() => import('@/pages/votes-page').then((module) => ({ default: module.VotesPage })));
const VoteDetailPage = lazy(() => import('@/pages/vote-detail-page').then((module) => ({ default: module.VoteDetailPage })));
const PledgesPage = lazy(() => import('@/pages/pledges-page').then((module) => ({ default: module.PledgesPage })));
const AdminVotesPage = lazy(() => import('@/pages/admin-votes-page').then((module) => ({ default: module.AdminVotesPage })));
const AdminPledgesPage = lazy(() => import('@/pages/admin-pledges-page').then((module) => ({ default: module.AdminPledgesPage })));
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
function SurveyListRoute({ children }: { children: ReactNode }) {
    const grants = useAdminGrants();
    if (grants.status === 'idle' || grants.status === 'loading')
        return <p role="status" className="p-8">{uiText('admin.grants.loading')}</p>;
    if (grants.status === 'error')
        return <section aria-labelledby="survey-access-error-title" className="p-8"><h1 id="survey-access-error-title">{uiText('admin.grants.errorTitle')}</h1><p role="alert">{uiText('admin.grants.error')}</p><button type="button" className="mt-3 min-h-11 px-3" onClick={() => void refetchAdminGrants().catch(() => undefined)}>{uiText('admin.retry')}</button></section>;
    if (!(hasGlobalGrant(grants.grants, 'SURVEY_MANAGE') || hasGlobalGrant(grants.grants, 'SURVEY_REVIEW')))
        return <section aria-labelledby="forbidden-title" className="p-8"><h1 id="forbidden-title">403</h1><p>{uiText('admin.grants.denied')}</p></section>;
    return children;
}
export function App() {
    useLocale();
    return <Suspense fallback={<p role="status" className="p-8">{uiText("App.62efc07b34")}</p>}><Outlet /></Suspense>;
}

export const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
        children: [
            { index: true, element: <HomePage /> },
            { path: 'events', element: <EventsPage /> },
            { path: 'events/:eventId/survey', element: <LegacyEventSurveyResolver /> },
            { path: 'survey/:surveyId', element: <EventSurveyPage /> },
            { path: 'votes', element: <VotesPage /> },
            { path: 'votes/:voteId', element: <VoteDetailPage /> },
            { path: 'pledges', element: <PledgesPage /> },
            { path: 'about', element: <AboutPage /> },
            { path: 'about/roadmap', element: <RoadmapPage /> },
            { path: 'faq', element: <FaqPage /> },
            { path: 'calendar', element: <CalendarPage /> },
            { path: 'board', element: <BoardHubPage /> },
            { path: 'board/:category', element: <BoardPage /> },
            { path: 'board/:category/write', element: <BoardWritePage /> },
            { path: 'board/:category/:id', element: <BoardPostPage /> },
            { path: 'chat', element: <ChatPage /> },
            { path: 'mypage', element: <MyPage /> },
            {
                path: 'admin',
                element: <AdminPage />,
                children: [
                    { index: true, element: <AdminDashboardPage /> },
                    { path: 'payments', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'FEES_MANAGE' }}><AdminPaymentsPage /></AdminRouteGuard> },
                    { path: 'surveys', element: <SurveyListRoute><AdminSurveysPage /></SurveyListRoute> },
                    { path: 'surveys/:surveyId/edit', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'SURVEY_MANAGE' }}><AdminSurveyEditPage /></AdminRouteGuard> },
                    { path: 'surveys/:surveyId/responses', element: <SurveyListRoute><AdminSurveyOperationsPage /></SurveyListRoute> },
                    { path: 'emails', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'MAIL_SEND' }}><AdminEmailsPage /></AdminRouteGuard> },
                    { path: 'contacts', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'CONTACTS_MANAGE' }}><AdminContactsPage /></AdminRouteGuard> },
                    { path: 'users', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'USERS_MANAGE' }}><AdminUsersPage /></AdminRouteGuard> },
                    { path: 'permissions', element: <AdminRouteGuard requirement={{ kind: 'WORKFLOW' }}><AdminPermissionsPage /></AdminRouteGuard> },
                    { path: 'audit-logs', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'PERMISSION_AUDIT' }}><AdminAuditLogsPage /></AdminRouteGuard> },
                    { path: 'boards', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'BOARD_MANAGE' }}><AdminBoardsPage /></AdminRouteGuard> },
                    { path: 'faqs', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'FAQ_MANAGE' }}><AdminFaqsPage /></AdminRouteGuard> },
                    { path: 'events', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'EVENT_MANAGE' }}><AdminEventsPage /></AdminRouteGuard> },
                    { path: 'votes', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'VOTE_MANAGE' }}><AdminVotesPage /></AdminRouteGuard> },
                    { path: 'pledges', element: <AdminRouteGuard requirement={{ kind: 'GLOBAL', permission: 'PLEDGE_MANAGE' }}><AdminPledgesPage /></AdminRouteGuard> },
                    { path: '*', element: <NotFoundPage /> },
                ],
            },
            { path: 'login', element: <TreeLogin /> },
            { path: 'login/consent', element: <LoginConsentPage /> },
            { path: '*', element: <NotFoundPage /> },
        ],
    },
]);
