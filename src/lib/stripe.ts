import type { Stripe } from '@stripe/stripe-js';

// Initialize Stripe with publishable key - DEFERRED to reduce unused JS
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.warn('Stripe publishable key not found. Payment features will not work.');
}

// Cached promise to avoid multiple loads
let stripePromiseCache: Promise<Stripe | null> | null = null;

// Lazy loader function - only loads Stripe SDK when actually needed
export const getStripePromise = (): Promise<Stripe | null> => {
  if (!stripePublishableKey) {
    return Promise.resolve(null);
  }
  
  if (!stripePromiseCache) {
    // Dynamically import loadStripe to defer SDK loading
    stripePromiseCache = import('@stripe/stripe-js').then(({ loadStripe }) => 
      loadStripe(stripePublishableKey)
    );
  }
  
  return stripePromiseCache;
};

// Legacy export for backwards compatibility - now fully lazy (only loads when getStripePromise() is called)
export const stripePromise = null;
