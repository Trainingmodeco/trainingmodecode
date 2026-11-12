// The cached Pro entitlement: an answer we could not get is "unknown", not
// "free". A member who opens Profile with no signal keeps Pro; only a real
// answer or a sign-out changes it. Run with `npm run test:entitlements`.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const { refreshEntitlement, getCachedEntitlement, hasProEntitlement, clearEntitlementCache } = await import('../components/training-mode/data/entitlements.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

await refreshEntitlement(async () => ({ plan: 'annual', is_pro: true, status: 'active', current_period_end: '2027-01-01T00:00:00Z' }));
check('a real Pro answer is cached', hasProEntitlement() && getCachedEntitlement()?.plan === 'annual');

await refreshEntitlement(async () => null);
check('offline or a server error keeps the last good answer', hasProEntitlement() && getCachedEntitlement()?.plan === 'annual');

await refreshEntitlement(async () => ({ plan: 'free', is_pro: false }));
check('a real "not a member" answer removes Pro', !hasProEntitlement() && getCachedEntitlement()?.plan === 'free');

await refreshEntitlement(async () => ({ plan: 'monthly', is_pro: true }));
clearEntitlementCache();
check('sign-out clears the cache', !hasProEntitlement() && getCachedEntitlement() === null);

await refreshEntitlement(async () => null);
check('unknown with nothing cached stays not Pro', !hasProEntitlement() && getCachedEntitlement() === null);

// The Fight Focus timer hands its summary five things; the router between
// them must pass all five on (the fifth is the strike tally and verdict XP).
const fs = await import('node:fs');
const router = fs.readFileSync(new URL('../components/training-mode/ScreenRouter.jsx', import.meta.url), 'utf8');
const card = fs.readFileSync(new URL('../components/training-mode/AccountCard.jsx', import.meta.url), 'utf8');
check('Fight Focus hands every argument to the summary', /<FightFocusTimer[^>]*onEnd=\{goSummary\}/.test(router));
check('Profile clears Pro only on a real sign-out', /event === 'SIGNED_OUT'\) clearEntitlementCache\(\)/.test(card) && !/else clearEntitlementCache\(\);/.test(card));

console.log(`\nentitlements: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
