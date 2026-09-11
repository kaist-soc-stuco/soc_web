import { Navigate, useParams, useSearchParams } from "react-router-dom";
export function SurveyResponseListPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("tab", "responses");
  next.set("view", params.has("response") ? "individual" : "summary");
  return <Navigate replace to={`/admin/surveys/${id}/edit?${next}`} />;
}
