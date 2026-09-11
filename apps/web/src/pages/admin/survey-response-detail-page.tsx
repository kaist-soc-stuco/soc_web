import { Navigate, useParams } from "react-router-dom";
export function SurveyResponseDetailPage() {
  const { id, responseId } = useParams();
  const params = new URLSearchParams({ tab: "responses", view: "individual", response: responseId ?? "" });
  return <Navigate replace to={`/admin/surveys/${id}/edit?${params}`} />;
}
