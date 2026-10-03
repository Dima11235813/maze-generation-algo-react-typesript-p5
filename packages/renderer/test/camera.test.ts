import {
  CAMERA_PRESET_ANGLES,
  DEFAULT_VIEW,
  MAX_ELEVATION,
  MIN_ELEVATION,
  normalizeView,
  pitchLimits,
  viewFromCamera,
  wrapAngle,
} from '../src/camera';

describe('camera view helpers', () => {
  it('keeps every preset elevation inside the allowed band', () => {
    for (const [preset, a] of Object.entries(CAMERA_PRESET_ANGLES)) {
      expect(a.elevation, preset).toBeGreaterThanOrEqual(MIN_ELEVATION);
      expect(a.elevation, preset).toBeLessThanOrEqual(MAX_ELEVATION);
    }
  });

  it('pitch limits keep preset elevation plus pitch within the band', () => {
    const { min, max } = pitchLimits('tilt');
    const e = CAMERA_PRESET_ANGLES.tilt.elevation;
    expect(e + min).toBeCloseTo(MIN_ELEVATION);
    expect(e + max).toBeCloseTo(MAX_ELEVATION);
  });

  it('wraps yaw into [-PI, PI)', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-Math.PI / 2 - Math.PI * 4)).toBeCloseTo(-Math.PI / 2);
  });

  it('normalises zoom, yaw and pitch for a preset', () => {
    const v = normalizeView('tilt', { zoom: 100, yaw: Math.PI * 2 + 0.5, pitch: 10 });
    expect(v.zoom).toBe(8);
    expect(v.yaw).toBeCloseTo(0.5);
    expect(v.pitch).toBeCloseTo(pitchLimits('tilt').max);
    expect(normalizeView('top', DEFAULT_VIEW)).toEqual(DEFAULT_VIEW);
  });

  it('reads the view out of a camera, defaulting missing orbit to zero', () => {
    expect(viewFromCamera({ preset: 'tilt', followPointer: false, zoom: 2 })).toEqual({
      zoom: 2,
      yaw: 0,
      pitch: 0,
    });
    expect(
      viewFromCamera({ preset: 'tilt', followPointer: false, zoom: 1, yaw: 0.3, pitch: -0.1 }),
    ).toEqual({ zoom: 1, yaw: 0.3, pitch: -0.1 });
  });
});
