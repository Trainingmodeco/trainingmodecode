#!/usr/bin/env node
/**
 * validate-campaigns.mjs — dependency-free validator for all Training Arcade
 * campaigns. Checks JSON validity + cross-references so a bad edit can't ship
 * silently. Run: `node protocol-src/scripts/validate-campaigns.mjs`
 * Exit code 0 = all good, 1 = at least one error.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const CAMPAIGNS = join(DATA, "campaigns");
// 5 canonical phases (shared with the camp engine) + 3 thematic hard-tier
// aliases used by specific campaigns (peak=Baki, eclipse=Berserk,
// integration=Dark Knight). Kept in sync with schemas/stage.schema.json.
const VALID_PHASES = new Set([
  "foundation", "development", "hard_camp", "peak", "eclipse", "integration", "taper", "final_boss",
]);

let errors = 0;
let warnings = 0;
const err = (c, m) => { console.error(`  ✗ [${c}] ${m}`); errors++; };
const warn = (c, m) => { console.warn(`  ! [${c}] ${m}`); warnings++; };

function loadJSON(path, campaign) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { err(campaign, `cannot parse ${path.split("/").pop()}: ${e.message}`); return null; }
}

// Shared references
const equipment = loadJSON(join(DATA, "equipment.json"), "equipment");
const equipIds = new Set((equipment?.items ?? []).map((i) => i.id));

const dirs = readdirSync(CAMPAIGNS).filter((d) => d.startsWith("ARC_")).sort();
console.log(`Validating ${dirs.length} campaigns…\n`);

for (const d of dirs) {
  const base = join(CAMPAIGNS, d);
  const campaign = loadJSON(join(base, "campaign.json"), d);
  const stages = loadJSON(join(base, "stages.json"), d);
  const modRaw = loadJSON(join(base, "modules.json"), d);
  if (!campaign || !stages || !modRaw) continue;

  const mods = Array.isArray(modRaw) ? modRaw : modRaw.modules;
  const modIds = new Set(mods.map((m) => m.module_id));
  const achIds = new Set((campaign.achievements ?? []).map((a) => a.id));
  const dupModule = mods.length !== modIds.size;
  if (dupModule) err(d, "duplicate module_id in modules.json");

  // campaign-level
  if (campaign.campaign_id !== d) err(d, `campaign_id "${campaign.campaign_id}" != folder ${d}`);
  if (typeof campaign.stage_count === "number" && campaign.stage_count !== stages.length)
    err(d, `stage_count ${campaign.stage_count} != ${stages.length} stages`);
  const vg = campaign.voice_guidance;
  if (!vg || vg.enabled !== true || vg.no_read_required !== true || !vg.announce?.exercise_name)
    err(d, "voice_guidance missing or incomplete");

  // stages
  const seenStageIds = new Set();
  for (const st of stages) {
    const sid = st.stage_id ?? "(no id)";
    if (seenStageIds.has(sid)) err(d, `duplicate stage_id ${sid}`);
    seenStageIds.add(sid);
    if (!VALID_PHASES.has(st.phase)) err(d, `${sid}: bad/missing phase "${st.phase}"`);
    if (st.campaign_id && st.campaign_id !== d) err(d, `${sid}: campaign_id mismatch`);

    // paths → module refs
    const paths = st.paths ?? {};
    if (Object.keys(paths).length === 0) err(d, `${sid}: no paths`);
    for (const pk of Object.keys(paths)) {
      const p = paths[pk];
      const ids = p.module_ids ?? [];
      if (ids.length === 0 && !p.protocol_family)
        warn(d, `${sid}.${pk}: no module_ids and no protocol_family reference`);
      for (const id of ids) if (!modIds.has(id)) err(d, `${sid}.${pk}: module "${id}" not found`);
    }
    // availability flags vs paths present
    if (st.fit_available && !paths.fit) err(d, `${sid}: fit_available but no fit path`);
    if (st.fight_available && !paths.fight) err(d, `${sid}: fight_available but no fight path`);

    // achievements
    for (const a of st.achievement_rule_ids ?? [])
      if (!achIds.has(a)) err(d, `${sid}: achievement "${a}" not in campaign.achievements`);

    // equipment
    const e = st.equipment ?? {};
    for (const k of [...(e.required ?? []), ...(e.recommended ?? [])])
      if (!equipIds.has(k)) err(d, `${sid}: unknown equipment id "${k}"`);
  }

  // stage_number sequence 1..N (if present)
  const nums = stages.map((s) => s.stage_number).filter((n) => typeof n === "number");
  if (nums.length === stages.length) {
    const sorted = [...nums].sort((a, b) => a - b);
    const expected = Array.from({ length: stages.length }, (_, i) => i + 1);
    if (JSON.stringify(sorted) !== JSON.stringify(expected))
      warn(d, `stage_number sequence is not 1..${stages.length} (${sorted.join(",")})`);
  }

  const campErrors = errors; // snapshot not needed; print status
  console.log(`  ${d}: ${stages.length} stages, ${mods.length} modules`);
}

console.log("");
if (errors === 0) {
  console.log(`✓ All ${dirs.length} campaigns valid${warnings ? ` (${warnings} warning${warnings > 1 ? "s" : ""})` : ""}.`);
  process.exit(0);
} else {
  console.error(`✗ ${errors} error${errors > 1 ? "s" : ""}${warnings ? `, ${warnings} warning${warnings > 1 ? "s" : ""}` : ""} across ${dirs.length} campaigns.`);
  process.exit(1);
}
