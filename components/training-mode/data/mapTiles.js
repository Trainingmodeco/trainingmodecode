// Street tiles under the run map — one environment variable, and OFF until it
// is set.
//
// WHY GEOAPIFY IS THE RECOMMENDED PROVIDER
//
// Training Mode is a commercial product: it has a paywall and takes payment.
// That single fact rules out most of the "free" map tiers, and it is the kind
// of thing you find out from a licence email rather than a 404:
//
//   OpenStreetMap's own tile servers  — the usage policy demands a unique
//     User-Agent naming the app, which a browser cannot send, and forbids
//     prefetching or offline caching, which is what a PWA is. Also states
//     outright that access can be withdrawn and "you may no longer be able to
//     serve your paying customers".
//   Stadia Maps free plan             — no commercial use.
//   MapTiler free plan                — non-commercial.
//   Mapbox Static Tiles               — 200k requests/month free and a good
//     product, but production business use points at a separate Commercial
//     Application Licence, so it needs a conversation before it is safe.
//   Geoapify free plan                — commercial use explicitly allowed
//     inside the quota (3,000 credits/day), raster {z}/{x}/{y} tiles, and a
//     dark-purple style that happens to match this app exactly.
//
// So Geoapify is the default recommendation, and the style below is the one to
// ask for. Nothing here is hard-coded to it: any provider that serves raster
// {z}/{x}/{y} tiles works by changing the one variable, and the attribution
// table keeps the required credit correct when you do.
//
// The key is NOT a secret in the sense the other keys in this project are. It
// is a client key that ships in the URL of every tile request, so it belongs in
// a public env var and should be locked to the domain in the provider's
// dashboard. It is still set in Netlify rather than committed, because it is an
// account identifier and rotating it should not need a code change.

export const RECOMMENDED_PROVIDER = {
  name: 'Geoapify',
  signup: 'https://myprojects.geoapify.com',
  style: 'dark-matter-dark-purple',
  template: 'https://maps.geoapify.com/v1/tile/dark-matter-dark-purple/{z}/{x}/{y}@2x.png?apiKey=YOUR_KEY',
};

export const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILES_URL || null;

// Every one of these basemaps is built from OpenStreetMap data, so the OSM
// credit is required no matter which is chosen; most add their own on a free
// plan. Getting this wrong is a licence breach, not a cosmetic slip, so the
// credit is derived from the host rather than left to whoever sets the variable
// — and an unrecognised host still gets the OSM line.
const ATTRIBUTION_BY_HOST = [
  [/geoapify\.com/i, 'Powered by Geoapify · © OpenStreetMap contributors · © OpenMapTiles'],
  [/mapbox\.com/i, '© Mapbox · © OpenStreetMap contributors'],
  [/stadiamaps\.com/i, '© Stadia Maps · © OpenMapTiles · © OpenStreetMap contributors'],
  [/maptiler\.com/i, '© MapTiler · © OpenStreetMap contributors'],
  [/cartocdn\.com/i, '© CARTO · © OpenStreetMap contributors'],
  [/thunderforest\.com/i, 'Maps © Thunderforest · Data © OpenStreetMap contributors'],
  [/openstreetmap\.org/i, '© OpenStreetMap contributors'],
];

function defaultAttribution(url) {
  if (!url) return '';
  const hit = ATTRIBUTION_BY_HOST.find(([re]) => re.test(url));
  return hit ? hit[1] : '© OpenStreetMap contributors';
}

// An override exists for a provider not in the table, or for one whose terms
// change. It can only replace the credit, never remove it.
export const TILE_ATTRIBUTION =
  process.env.EXPO_PUBLIC_MAP_TILES_ATTRIBUTION || defaultAttribution(TILE_URL);

export const tilesConfigured = () => !!TILE_URL;

// {z}/{x}/{y} is universal; {s} (a subdomain letter) is used by a few older
// providers and is harmless to support.
export function tileUrl(tile) {
  if (!TILE_URL) return '';
  return TILE_URL
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y))
    .replace('{s}', ['a', 'b', 'c'][(tile.x + tile.y) % 3]);
}
