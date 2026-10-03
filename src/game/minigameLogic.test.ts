import { describe, expect, it } from 'vitest';
import { markerPosition, reactionQuality, timingQuality } from './minigameLogic';

describe('Minispiele', () => {
  it('Treffer in der Mitte ist perfekt, daneben schlechter', () => {
    expect(timingQuality(0.5, 0.5, 0.1)).toBe(1);
    expect(timingQuality(0.58, 0.5, 0.1)).toBeGreaterThan(0.7);
    expect(timingQuality(0.9, 0.5, 0.1)).toBe(0);
  });

  it('schnelle Reaktion beim Angeln zählt', () => {
    expect(reactionQuality(200)).toBe(1);
    expect(reactionQuality(700)).toBeLessThan(1);
    expect(reactionQuality(2000)).toBe(0);
    expect(reactionQuality(-10)).toBe(0);
  });

  it('Markierung pendelt zwischen 0 und 1', () => {
    expect(markerPosition(0, 1000)).toBe(0);
    expect(markerPosition(500, 1000)).toBe(1);
    expect(markerPosition(250, 1000)).toBeCloseTo(0.5);
  });
});
