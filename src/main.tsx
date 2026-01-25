import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry in production
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% das transações
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% das sessões
    replaysOnErrorSampleRate: 1.0, // 100% das sessões com erro
    // Environment
    environment: import.meta.env.MODE,
    // Ignore common non-critical errors
    ignoreErrors: [
      'ResizeObserver loop',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      /Loading chunk \d+ failed/,
    ],
  });
}

// Application entry point
createRoot(document.getElementById("root")!).render(<App />);
