import { Navigate } from "react-router";

export default function IndexRedirectRoute() {
  return <Navigate to="/markets" replace />;
}
