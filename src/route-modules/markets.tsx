import { Navigate } from "react-router";

/** Legacy local-market URL kept only to preserve old bookmarks. */
export default function MarketsRoute() {
  return <Navigate to="/polymarket" replace />;
}
