import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';

import { AdminPage } from '@/pages/admin-page';
import { AdminPaymentsPage } from '@/pages/admin-payments-page';
import { AdminSurveysPage } from '@/pages/admin-surveys-page';
import { AdminSurveyEditPage } from '@/pages/admin-survey-edit-page';
import { AdminContactsPage } from '@/pages/admin-contacts-page';
import { AdminEmailsPage } from '@/pages/admin-emails-page';
import { AboutPage } from '@/pages/about-page';
import { HomePage } from '@/pages/home-page';
import { BoardPage } from '@/pages/board-page';
import { BoardPostPage } from '@/pages/board-post-page';
import { BoardWritePage } from '@/pages/board-write-page';
import { CalendarPage } from '@/pages/calendar-page';
import { EventsPage } from '@/pages/events-page';
import { EventSurveyPage } from '@/pages/event-survey-page';
import { FaqPage } from '@/pages/faq-page';
import { RoadmapPage } from '@/pages/roadmap-page';
import { TreeLogin } from '@/pages/login-page';
import { LoginConsentPage } from '@/pages/login-consent-page';
import { getEvent } from '@/lib/event-api';

export function LegacyEventSurveyResolver() {
  const { eventId } = useParams<{ eventId: string }>();
  const [resolution, setResolution] = useState<{ eventId: string; surveyId: string } | null>(null);
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
        if (!active) return;
        if (typeof event.surveyId === 'string' && event.surveyId.length > 0) {
          setResolution({ eventId, surveyId: event.surveyId });
        } else setStatus('unavailable');
      })
      .catch((cause: unknown) => {
        if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [eventId]);

  if (resolution && resolution.eventId === eventId) return <Navigate to={`/survey/${encodeURIComponent(resolution.surveyId)}`} replace />;
  if (status === 'error') return <p>설문 정보를 불러오지 못했습니다.</p>;
  if (status === 'unavailable') return <p>연결된 설문을 찾을 수 없습니다.</p>;
  return <p>설문 정보를 불러오는 중입니다.</p>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId/survey" element={<LegacyEventSurveyResolver />} />
        <Route path="/survey/:surveyId" element={<EventSurveyPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/about/roadmap" element={<RoadmapPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/board/:category" element={<BoardPage />} />
        <Route path="/board/:category/write" element={<BoardWritePage />} />
        <Route path="/board/:category/:id" element={<BoardPostPage />} />
        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<Navigate to="payments" replace />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="surveys" element={<AdminSurveysPage />} />
          <Route path="surveys/:surveyId/edit" element={<AdminSurveyEditPage />} />
          <Route path="emails" element={<AdminEmailsPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<TreeLogin />} />
        <Route path="/login/consent" element={<LoginConsentPage />} />
      </Routes>
    </BrowserRouter>
  );
}
