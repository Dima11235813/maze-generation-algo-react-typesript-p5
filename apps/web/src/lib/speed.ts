import { SPEED_PRESETS } from '@maze/player';

/** Index into SPEED_PRESETS closest (in log space) to the given steps-per-second value. */
export function speedToIndex(speed: number): number {
  let best = 0;
  let bestDist = Infinity;
  const target = Math.log(Math.max(1, speed));
  SPEED_PRESETS.forEach((p, i) => {
    const d = Math.abs(Math.log(p) - target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export function indexToSpeed(index: number): number {
  const clamped = Math.min(SPEED_PRESETS.length - 1, Math.max(0, Math.round(index)));
  return SPEED_PRESETS[clamped] ?? 60;
}

export function formatSpeed(speed: number): string {
  return speed >= 1000
    ? `${(speed / 1000).toFixed(speed % 1000 === 0 ? 0 : 1)}k steps/s`
    : `${speed} steps/s`;
}
