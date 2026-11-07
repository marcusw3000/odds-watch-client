import type { LinksFunction, MetaFunction } from "react-router";
import {
  data,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "react-router";
import { AppProviders } from "./app/AppProviders";
import { getServerAuthState } from "./integrations/supabase/server";
import { getUsdBrlFxQuote } from "./services/UsdBrlFxProvider.server";
import stylesheet from "./index.css?url";
import type { Route } from "./+types/root";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  { rel: "preconnect", href: import.meta.env.VITE_SUPABASE_URL },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
];

export const meta: MetaFunction = () => [
  { title: "Mercado de Previs\u00f5es" },
  {
    name: "description",
    content:
      "Negocie contratos de previs\u00e3o sobre eventos econ\u00f4micos brasileiros. SELIC, IPCA, D\u00f3lar e mais.",
  },
  { name: "author", content: "Mercado de Previs\u00f5es" },
  {
    name: "keywords",
    content:
      "mercado de previs\u00f5es, trading, SELIC, IPCA, d\u00f3lar, economia brasileira, contratos",
  },
  { property: "og:title", content: "Mercado de Previs\u00f5es" },
  {
    property: "og:description",
    content:
      "Negocie contratos de previs\u00e3o sobre eventos econ\u00f4micos brasileiros. SELIC, IPCA, D\u00f3lar e mais.",
  },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://mercadoprevisoes.com.br" },
  { property: "og:image", content: "/og-image.png" },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:site_name", content: "Mercado de Previs\u00f5es" },
  { property: "og:locale", content: "pt_BR" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Mercado de Previs\u00f5es" },
  {
    name: "twitter:description",
    content: "Negocie contratos de previs\u00e3o sobre eventos econ\u00f4micos brasileiros.",
  },
  { name: "twitter:image", content: "/og-image.png" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const [auth, fx] = await Promise.all([
    getServerAuthState(request),
    getUsdBrlFxQuote().catch(() => null),
  ]);

  return data(
    {
      auth: {
        isAdmin: auth.isAdmin,
        user: auth.user,
      },
      usdBrlRate: fx ? Number(fx.rate) : null,
    },
    {
      headers: auth.headers,
    },
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" translate="no" className="notranslate">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="notranslate" translate="no">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  const { auth, usdBrlRate } = useLoaderData<typeof loader>();

  return (
    <AppProviders initialAuth={auth} usdBrlRate={usdBrlRate}>
      <Outlet />
    </AppProviders>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Erro desconhecido ao carregar esta página.";

  console.error("[RouteErrorBoundary]", {
    path: typeof window === "undefined" ? "server" : window.location.pathname,
    error,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 notranslate" translate="no">
      <section className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold">Não foi possível abrir esta página</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-center gap-3">
          <button type="button" className="rounded-md border px-4 py-2 text-sm font-medium" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
          <a href="/polymarket" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Ir para Polymarket
          </a>
        </div>
      </section>
    </main>
  );
}
