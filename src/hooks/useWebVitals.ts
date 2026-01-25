import { useEffect } from 'react';
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from 'web-vitals';

type AnalyticsHandler = (metric: Metric) => void;

function createAnalyticsHandler(): AnalyticsHandler {
  return (metric: Metric) => {
    // Em desenvolvimento, apenas logar no console
    if (import.meta.env.DEV) {
      const formattedValue = metric.name === 'CLS' 
        ? metric.value.toFixed(3) 
        : `${Math.round(metric.value)}ms`;
      
      const rating = metric.rating || 'unknown';
      const ratingEmoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      
      console.log(`[Web Vital] ${ratingEmoji} ${metric.name}: ${formattedValue} (${rating})`);
      return;
    }

    // Em produção, enviar para serviço de analytics
    // Exemplo com Google Analytics 4:
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_category: 'Web Vitals',
        event_label: metric.id,
        non_interaction: true,
      });
    }

    // Também pode enviar para Sentry Performance
    // Se Sentry estiver configurado, as métricas são capturadas automaticamente
  };
}

/**
 * Hook para monitorar Core Web Vitals
 * 
 * Métricas monitoradas:
 * - CLS (Cumulative Layout Shift): Estabilidade visual
 * - FID (First Input Delay): Interatividade (legacy)
 * - INP (Interaction to Next Paint): Interatividade (novo padrão)
 * - LCP (Largest Contentful Paint): Performance de carregamento
 * - FCP (First Contentful Paint): Primeira renderização
 * - TTFB (Time to First Byte): Resposta do servidor
 */
export function useWebVitals() {
  useEffect(() => {
    const handler = createAnalyticsHandler();
    
    // Core Web Vitals
    onCLS(handler);
    onLCP(handler);
    onINP(handler); // Substitui FID como métrica principal de interatividade
    
    // Métricas adicionais
    onFCP(handler);
    onTTFB(handler);
  }, []);
}

/**
 * Função utilitária para enviar métricas customizadas
 * Pode ser usada para medir tempo de ações específicas
 */
export function reportCustomMetric(name: string, value: number, unit: 'ms' | 'score' = 'ms') {
  if (import.meta.env.DEV) {
    console.log(`[Custom Metric] ${name}: ${value}${unit === 'ms' ? 'ms' : ''}`);
    return;
  }

  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', name, {
      value: Math.round(value),
      event_category: 'Custom Metrics',
      non_interaction: true,
    });
  }
}
