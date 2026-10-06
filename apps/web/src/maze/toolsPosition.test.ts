import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DOCKED, TOOLS_MARGIN, moveBy, toFraction, toPixels } from './toolsPosition';

const container = { width: 800, height: 600 };
const widget = { width: 200, height: 100 };

describe('maze tools placement', () => {
  it('docks in the bottom-right corner inside the margin', () => {
    expect(toPixels(DOCKED, container, widget)).toEqual({
      left: 800 - 200 - TOOLS_MARGIN,
      top: 600 - 100 - TOOLS_MARGIN,
    });
    expect(toPixels({ x: 0, y: 0 }, container, widget)).toEqual({
      left: TOOLS_MARGIN,
      top: TOOLS_MARGIN,
    });
  });

  it('never leaves the container, whatever the drag', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: -5000, max: 5000 }),
        fc.integer({ min: -5000, max: 5000 }),
        (x, y, dx, dy) => {
          const next = moveBy({ x, y }, dx, dy, container, widget);
          const { left, top } = toPixels(next, container, widget);
          expect(left).toBeGreaterThanOrEqual(TOOLS_MARGIN - 1e-9);
          expect(top).toBeGreaterThanOrEqual(TOOLS_MARGIN - 1e-9);
          expect(left + widget.width).toBeLessThanOrEqual(container.width - TOOLS_MARGIN + 1e-9);
          expect(top + widget.height).toBeLessThanOrEqual(container.height - TOOLS_MARGIN + 1e-9);
        },
      ),
    );
  });

  it('round-trips pixels and fractions, and survives a container smaller than the widget', () => {
    const f = toFraction(300, 200, container, widget);
    expect(toPixels(f, container, widget)).toEqual({ left: 300, top: 200 });
    expect(toFraction(50, 50, { width: 100, height: 100 }, widget)).toEqual({ x: 1, y: 1 });
  });
});
