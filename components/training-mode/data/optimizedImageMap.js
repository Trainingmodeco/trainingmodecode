// Image source-of-truth for Training Mode.
//
// IMG  — NEW preferred map. Points at the Claude reference images under
//        /public/static (served at /static/*). Use this for any newly wired /
//        redesigned screens. NOTE: public assets live under /static, not
//        /assets — the /assets URL prefix is reserved by Metro's dev server.
// optimizedImageMap — LEGACY map kept for backwards compatibility. Existing
//        screens still import this; do not remove until every screen is
//        migrated over to IMG. Phase 1 does NOT rewire screens.

export const IMG = {
  brand: {
    bg: '/static/app-bg.png',
    logoMark: '/static/logo-mark.png',
    logoWordmark: '/static/logo-wordmark.png',
    logoTitleFull: '/static/logo-title-full.png',
    appIcon: '/static/app-icon.webp',
  },
  hub: {
    fit: '/static/hub/fit.png',
    fight: '/static/hub/fight.png',
    arcade: '/static/hub/arcade.png',
    combat: '/static/hub/combat.png',
    combatBanner: '/static/hub/combat-banner.webp',
  },
  fitMode: {
    workoutBuilder: '/static/fitmode/workout-builder.webp',
    quickMission: '/static/fitmode/quick-mission.webp',
    combatConditioning: '/static/fitmode/combat-conditioning.webp',
    cardioMode: '/static/fitmode/cardio-mode.webp',
    cardioFinisherSubBanner: '/static/fitmode/cardio-finisher-sub-banner.png',
    workoutCodex: '/static/fitmode/workout-codex.webp',
  },
  fightMode: {
    boxingMale: '/static/discipline/boxing.webp',
    boxingFemale: '/static/discipline/boxing_female.webp',
    kickboxingMale: '/static/discipline/kickboxing.webp',
    kickboxingFemale: '/static/discipline/kickboxing_female.webp',
    muayThaiMale: '/static/discipline/muay_thai.webp',
    muayThaiFemale: '/static/discipline/muay_thai_female.webp',
    mmaMale: '/static/discipline/mma.webp',
    mmaFemale: '/static/discipline/mma_female.webp',
  },
  arcade: {
    onePunch: '/static/series/one-punch.webp',
    darkKnight: '/static/series/dark-knight.webp',
    demonBack: '/static/series/demon-back.webp',
    ultraInstinct: '/static/series/ultra-instinct.webp',
    stage1: '/static/stages/s1.webp',
    stage2: '/static/stages/s2.webp',
    stage3: '/static/stages/s3.webp',
    stage4: '/static/stages/s4.webp',
    stage5: '/static/stages/s5.webp',
    stage6: '/static/stages/s6.webp',
    stage7: '/static/stages/s7.webp',
    stage8: '/static/stages/s8.webp',
    stage9: '/static/stages/s9.webp',
    stage10: '/static/stages/s10.webp',
  },
  trophies: {
    unlocked: '/static/trophies/trophy-unlocked.webp',
    champion: '/static/trophies/trophy-champion.webp',
    founders: '/static/trophies/trophy-founders.webp',
  },
};

// LEGACY — kept exactly as the current screens expect it. Do not change the
// shape or key names here without migrating the importing components first.
export const optimizedImageMap = {
  brand: {
    background: '/static/brand/background-w-logo.png',
    backgroundAlt: '/static/brand/background-w-logo-alt.png',
    logoGold: '/static/brand/tm-logo-gold.png',
    favicon: '/static/brand/favicon.png',
  },
  fitMode: {
    workoutBuilder: '/static/fitmode/workout-builder.webp',
    quickMission: '/static/fitmode/quick-mission.webp',
    combatConditioning: '/static/fitmode/combat-conditioning.webp',
    cardioMode: '/static/fitmode/cardio-mode-banner.webp',
    cardioFinisherSubBanner: '/static/fitmode/cardio-finisher-sub-banner.png',
    workoutCodex: '/static/fitmode/workout-codex.webp',
  },
  fightMode: {
    boxingMale: '/discipline-cards/boxing_male.webp',
    boxingFemale: '/discipline-cards/boxing_female.webp',
    kickboxingMale: '/discipline-cards/kickboxing_male.webp',
    kickboxingFemale: '/discipline-cards/kickboxing_female.webp',
    muayThaiMale: '/discipline-cards/muay_thai_male.webp',
    muayThaiFemale: '/discipline-cards/muay_thai_female.webp',
    mmaMale: '/discipline-cards/mma_male.webp',
    mmaFemale: '/discipline-cards/mma_female.webp',
  },
  arcade: {
    easy: '/banners/arcade/one-punch-regiment.webp',
    medium: '/banners/arcade/dark-knight-protocol.webp',
    hard: '/banners/arcade/demon-back-protocol.webp',
    ultra: '/banners/arcade/ultra-instinct-banner.webp',
    cardio10k: '/banners/arcade/ultra-ego-style.webp',
  },
  homeHub: {
    trainCard: '/static/hub/fit.png',
    fightCard: '/static/hub/fight.png',
    arcadeCard: '/static/hub/arcade.png',
    progressCard: '/static/hub/combat-banner.webp',
  },
};

export function getOptimizedImage(path, fallback = '') {
  return path || fallback;
}
