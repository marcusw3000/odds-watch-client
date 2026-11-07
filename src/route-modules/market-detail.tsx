import { Navigate } from "react-router";

/** Legacy local-market URL kept only to preserve old shared links. */
export default function MarketDetailRoute() {
  return <Navigate to="/polymarket" replace />;
}
