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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/board/:category" element={<BoardPage />} />
        <Route path="/survey/:id" element={<SurveyPage />} />
        <Route path="/login" element={<TreeLogin />} />
        <Route path="/login/consent" element={<LoginConsentPage />} />
        <Route path="/admin/surveys" element={<SurveyListPage />} />
        <Route path="/admin/surveys/new" element={<SurveyEditorPage />} />
        <Route path="/admin/surveys/:id/edit" element={<SurveyEditorPage />} />
        <Route path="/admin/surveys/:id/responses" element={<SurveyResponseListPage />} />
        <Route path="/admin/surveys/:id/responses/:responseId" element={<SurveyResponseDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}
