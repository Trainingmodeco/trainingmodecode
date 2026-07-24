// Spec 22 — voice packs: persona FLAVOR over the shared voice-guidance
// contract. A pack changes the coach's tone (TTS rate/pitch) and its
// greeting / hype / rest / done phrasing — NEVER the movement name, the
// count, or a safety cue (those stay literal). `coach` is the neutral
// default; the user can override any campaign back to it (or mute voice
// entirely via the existing audio settings).
import packsJson from '../protocol/data/voice-packs.json';
import { getAudioSettings, saveAudioSettings } from './audioEngine';

const PACKS = Object.fromEntries((packsJson.packs || []).map((p) => [p.id, p]));
const ASSIGNMENTS = packsJson.campaign_assignments || {};
const DEFAULT_ID = ASSIGNMENTS._default || 'coach';

// Advisory tts_hints → browser SpeechSynthesis params. Conservative ranges —
// intelligibility beats flavor (spec rule), so nothing drifts far from 1.0.
const RATE = { slow: 0.85, measured: 0.93, normal: 1.0, brisk: 1.08, fast: 1.18 };
const PITCH = { low: 0.9, mid: 1.05, high: 1.18 };

export function getPack(id) {
  return PACKS[id] || PACKS[DEFAULT_ID] || null;
}

// The user's override: 'auto' follows the campaign assignment; a pack id
// forces that pack everywhere; stored with the rest of the audio settings.
export function getVoicePackOverride() {
  return getAudioSettings().voicePack || 'auto';
}
export function setVoicePackOverride(id) {
  saveAudioSettings({ voicePack: id || 'auto' });
}

// Resolve the pack for a campaign (or null campaign → neutral coach),
// honoring the user override and falling back to `coach` when unknown.
export function packForCampaign(campaignId) {
  const override = getVoicePackOverride();
  if (override && override !== 'auto' && PACKS[override]) return PACKS[override];
  const assigned = (campaignId && ASSIGNMENTS[campaignId]) || DEFAULT_ID;
  return getPack(assigned);
}

export function packIdForCampaign(campaignId) {
  return packForCampaign(campaignId)?.id || DEFAULT_ID;
}

// speakAsync opts for a pack id (rate/pitch from its tts_hints).
export function packOpts(packId) {
  const p = getPack(packId);
  const h = p?.tts_hints || {};
  return { rate: RATE[h.rate] || 1.0, pitch: PITCH[h.pitch] || 1.05 };
}

// A pack's flavor line: kind = 'start' | 'hype' | 'rest' | 'done'.
export function packLine(packId, kind) {
  const p = getPack(packId);
  return (p?.sample_lines && p.sample_lines[kind]) || null;
}

export function listPacks() {
  return (packsJson.packs || []).map((p) => ({ id: p.id, name: p.name, persona: p.persona }));
}
