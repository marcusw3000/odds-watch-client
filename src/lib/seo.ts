interface MetaTagsConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  siteName?: string;
}

const DEFAULT_SITE_NAME = 'Mercado de Previsões';
const DEFAULT_IMAGE = '/og-image.png';

/**
 * Updates document meta tags for SEO and social sharing
 */
export function updateMetaTags(config: MetaTagsConfig): void {
  const {
    title,
    description,
    image = DEFAULT_IMAGE,
    url = window.location.href,
    type = 'website',
    siteName = DEFAULT_SITE_NAME,
  } = config;

  // Update document title
  document.title = `${title} | ${siteName}`;

  // Helper to update or create meta tag
  const setMetaTag = (property: string, content: string, isName = false) => {
    const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`;
    let meta = document.querySelector(selector) as HTMLMetaElement;
    
    if (!meta) {
      meta = document.createElement('meta');
      if (isName) {
        meta.name = property;
      } else {
        meta.setAttribute('property', property);
      }
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  // Standard meta tags
  setMetaTag('description', description, true);

  // OpenGraph tags
  setMetaTag('og:title', title);
  setMetaTag('og:description', description);
  setMetaTag('og:image', image.startsWith('http') ? image : `${window.location.origin}${image}`);
  setMetaTag('og:url', url);
  setMetaTag('og:type', type);
  setMetaTag('og:site_name', siteName);

  // Twitter Card tags
  setMetaTag('twitter:card', 'summary_large_image', true);
  setMetaTag('twitter:title', title, true);
  setMetaTag('twitter:description', description, true);
  setMetaTag('twitter:image', image.startsWith('http') ? image : `${window.location.origin}${image}`, true);
}

/**
 * Resets meta tags to default values
 */
export function resetMetaTags(): void {
  updateMetaTags({
    title: 'Mercado de Previsões',
    description: 'Negocie contratos de previsão sobre eventos econômicos brasileiros. SELIC, IPCA, Dólar e mais.',
  });
}

/**
 * Generates a share URL for a market
 */
export function getMarketShareUrl(marketId: string): string {
  return `${window.location.origin}/market/${marketId}`;
}

/**
 * Generates share text for a market position
 */
export function generatePositionShareText(
  eventTitle: string,
  outcome: 'YES' | 'NO',
  quantity: number,
  profitPercent: number
): string {
  const emoji = outcome === 'YES' ? '✅' : '❌';
  const profitEmoji = profitPercent >= 0 ? '📈' : '📉';
  const sign = profitPercent >= 0 ? '+' : '';
  
  return `📊 ${eventTitle}\n\n${emoji} ${outcome} × ${quantity} contratos\n💰 ${sign}${profitPercent.toFixed(1)}% ${profitEmoji}`;
}

/**
 * Generates share text for a trade
 */
export function generateTradeShareText(
  eventTitle: string,
  outcome: 'YES' | 'NO',
  action: 'BUY' | 'SELL',
  quantity: number,
  price: number
): string {
  const actionEmoji = action === 'BUY' ? '🛒' : '💸';
  const outcomeEmoji = outcome === 'YES' ? '✅' : '❌';
  const actionText = action === 'BUY' ? 'Comprei' : 'Vendi';
  
  return `${actionEmoji} ${actionText} ${quantity}× ${outcomeEmoji}${outcome} em "${eventTitle}" @ R$${(price / 100).toFixed(2)}`;
}
