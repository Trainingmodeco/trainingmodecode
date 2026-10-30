// Brand tokens for every template. Colors come from the app (brand/brand.json,
// synced from the content kit); type is two faces only: Orbitron for titles,
// Rajdhani for everything else.
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
import brandJson from '../brand/brand.json';

export const brand = brandJson;

export const C = {
  bg: brand.colors.background,
  panel: brand.colors.panel,
  violet: brand.colors.violet,
  gold: brand.colors.gold,
  red: brand.colors.red,
  green: brand.colors.green,
  text: brand.colors.text,
  muted: brand.colors.muted,
};

export const FONT = {
  display: 'Orbitron, sans-serif',
  body: 'Rajdhani, sans-serif',
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

let fonts: Promise<unknown> | null = null;
export const loadBrandFonts = () =>
  (fonts ??= Promise.all([
    loadFont({ family: 'Orbitron', url: staticFile('fonts/Orbitron.ttf'), weight: '400 900' }),
    loadFont({ family: 'Rajdhani', url: staticFile('fonts/Rajdhani-Medium.ttf'), weight: '500' }),
    loadFont({ family: 'Rajdhani', url: staticFile('fonts/Rajdhani-SemiBold.ttf'), weight: '600' }),
    loadFont({ family: 'Rajdhani', url: staticFile('fonts/Rajdhani-Bold.ttf'), weight: '700' }),
  ]));
