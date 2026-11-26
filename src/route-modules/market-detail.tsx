import { redirect } from "react-router";

/** Legacy local-market URL kept only to preserve old shared links. */
export function loader() {
  return redirect("/polymarket");
}
