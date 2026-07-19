// Stripe checkout via hosted Payment Links. We don't take card details in the
// app — tapping a plan opens Stripe's hosted page. We tag the checkout with the
// signed-in Supabase user (client_reference_id) so the webhook can grant Pro to
// the right account, and prefill their email.
//
// The three links are PUBLIC URLs (safe to ship). Confirmed pricing:
//   monthly  $5.99/mo · annual $34.99/yr · founder $59 one-time (beta lifetime)
export const PLANS = {
  monthly: { id: 'monthly', label: 'MONTHLY', price: '$5.99', cadence: '/mo', sub: 'Cancel anytime', url: 'https://buy.stripe.com/00w7sLceQdpK4Hpe3z0kE03' },
  annual: { id: 'annual', label: 'ANNUAL', price: '$34.99', cadence: '/yr', sub: '$2.92/mo · billed yearly', badge: 'BEST VALUE · SAVE 51%', url: 'https://buy.stripe.com/5kQ6oHceQ2L62zhcZv0kE04' },
  founder: { id: 'founder', label: 'FOUNDER', price: '$59', cadence: 'once', sub: 'Lifetime · beta founders only', badge: 'LIFETIME', url: 'https://buy.stripe.com/cNiaEXdiUdpK0r92kR0kE05' },
};

export const PLAN_ORDER = ['annual', 'monthly', 'founder'];

// Build the checkout URL for a plan, tagged with the account so the webhook
// can match the payment back to this user.
export function checkoutUrl(planId, user) {
  const plan = PLANS[planId] || PLANS.annual;
  const params = new URLSearchParams();
  if (user?.id) params.set('client_reference_id', user.id);
  if (user?.email) params.set('prefilled_email', user.email);
  const qs = params.toString();
  return qs ? `${plan.url}?${qs}` : plan.url;
}

// Open Stripe checkout for the chosen plan. Requires a signed-in user so the
// payment can be tied to the account. Returns false if no user (caller should
// prompt sign-in first).
export function startCheckout(planId, user) {
  if (!user?.id) return false;
  const url = checkoutUrl(planId, user);
  if (typeof window !== 'undefined') window.location.assign(url);
  return true;
}
