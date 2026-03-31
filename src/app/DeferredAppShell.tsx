import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from 'web-vitals';

function createAnalyticsHandler() {
  return (metric: Metric) => {
    if (import.meta.env.DEV) {
      const formattedValue = metric.name === 'CLS'
        ? metric.value.toFixed(3)
        : `${Math.round(metric.value)}ms`;

      const rating = metric.rating || 'unknown';
      const ratingEmoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';

      console.log(`[Web Vital] ${ratingEmoji} ${metric.name}: ${formattedValue} (${rating})`);
      return;
    }

    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_category: 'Web Vitals',
        event_label: metric.id,
        non_interaction: true,
      });
    }
  };
}

export function DeferredAppShell() {
  useEffect(() => {
    const handler = createAnalyticsHandler();

    onCLS(handler);
    onLCP(handler);
    onINP(handler);
    onFCP(handler);
    onTTFB(handler);
  }, []);

  return (
    <>
      <Toaster />
      <Sonner />
      <ConnectionStatus />
    </>
  );
}
