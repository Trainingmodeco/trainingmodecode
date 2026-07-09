const KEYS = {
  LAST_MISSION: 'codec_last_mission',
  LAST_BLOCKS: 'codec_last_blocks',
  LAST_SUMMARY: 'codec_last_summary',
};

function safeParse(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMission(mission) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEYS.LAST_MISSION, JSON.stringify(mission));
  } catch {}
}

export function loadMission() {
  return safeParse(KEYS.LAST_MISSION);
}

export function saveBlocks(blocks) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEYS.LAST_BLOCKS, JSON.stringify(blocks));
  } catch {}
}

export function loadBlocks() {
  return safeParse(KEYS.LAST_BLOCKS);
}

export function saveSummary(summary) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEYS.LAST_SUMMARY, JSON.stringify(summary));
  } catch {}
}

export function loadSummary() {
  return safeParse(KEYS.LAST_SUMMARY);
}
