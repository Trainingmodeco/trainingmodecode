export const arcadeResultAssets = {
  missionFailureRed: "/training-arcade/results/mission-validation-failed-red.png",
  missionValidationFailYellow: "/training-arcade/results/mission-validation-failed-yellow.png",
  partialCompletion: "/training-arcade/results/partial-completion.png",
  stageClearBadge: "/training-arcade/rewards/stage-clear-badge-sc.png",
  stageClearBurst: "/training-arcade/rewards/stage-clear-burst-tt.png",
};

export const arcadeStageBanners = {
  1: "/training-arcade/stage-banners/stage-1.png",
  2: "/training-arcade/stage-banners/stage-2.png",
  3: "/training-arcade/stage-banners/stage-3.png",
  4: "/training-arcade/stage-banners/stage-4.png",
  5: "/training-arcade/stage-banners/stage-5.png",
  6: "/training-arcade/stage-banners/stage-6.png",
  7: "/training-arcade/stage-banners/stage-7.png",
  8: "/training-arcade/stage-banners/stage-8.png",
  9: "/training-arcade/stage-banners/stage-9.png",
  10: "/training-arcade/stage-banners/stage-10.png",
};

export function getStageBanner(stageNumber) {
  return arcadeStageBanners[stageNumber] || null;
}

