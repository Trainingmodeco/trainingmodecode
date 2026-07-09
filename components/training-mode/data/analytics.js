export function trackEvent(name, props) {
  if (typeof window === 'undefined') return;
  if (typeof window.plausible === 'function') {
    window.plausible(name, props ? { props } : undefined);
  }
}

export function trackPageView() {
  trackEvent('pageview');
}
