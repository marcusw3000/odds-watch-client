import { redirect } from "react-router";

/** Legacy local-market URL kept only to preserve old bookmarks. */
export function loader() {
  return redirect("/polymarket");
}
