import { useEffect, useState, lazy, Suspense, Component, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';

const GlobalChat = lazy(() =>
  import('@/components/chat/GlobalChat').then((module) => ({
    default: module.GlobalChat,
  }))
);

class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[GlobalChat] Caught error, will retry:', error.message);
    this.retryTimer = setTimeout(() => {
      this.setState({ hasError: false });
    }, 3000);
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export function Layout() {
  const location = useLocation();
  const [shouldRenderChat, setShouldRenderChat] = useState(false);

  useEffect(() => {
    const scheduleRender =
      'requestIdleCallback' in window
        ? window.requestIdleCallback(() => setShouldRenderChat(true), { timeout: 1500 })
        : window.setTimeout(() => setShouldRenderChat(true), 250);

    return () => {
      if (typeof scheduleRender === 'number') {
        window.clearTimeout(scheduleRender);
        return;
      }

      window.cancelIdleCallback(scheduleRender);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
      >
        Pular para conteúdo principal
      </a>

      <Header />
      <div className="mx-auto flex w-full max-w-[1680px] flex-1 px-4 py-8 pb-24 md:px-6 md:pb-8 2xl:px-8">
        <div className="flex min-h-[calc(100vh-200px)] w-full items-start gap-6 xl:gap-8 2xl:gap-10">
          <main id="main-content" className="min-w-0 flex-1" style={{ contain: 'layout' }}>
            <div key={location.pathname} className="animate-fade-in">
              <Outlet />
            </div>
          </main>
          {shouldRenderChat && (
            <ChatErrorBoundary>
              <Suspense fallback={null}>
                <GlobalChat />
              </Suspense>
            </ChatErrorBoundary>
          )}
        </div>
      </div>
      <Footer />
      <BottomNav />
    </div>
  );
}
