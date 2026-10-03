import { describe, expect, it } from 'vitest';
import { effectiveSpeed, GameClock, MAX_HOURS_PER_STEP, MS_PER_HOUR } from './clock';

describe('GameClock', () => {
  it('läuft in Pause nicht', () => {
    expect(new GameClock().advance(100_000, 0)).toBe(0);
  });

  it('sammelt Bruchteile über mehrere Aufrufe', () => {
    const clock = new GameClock();
    expect(clock.advance(MS_PER_HOUR[1] / 2, 1)).toBe(0);
    expect(clock.advance(MS_PER_HOUR[1] / 2, 1)).toBe(1);
  });

  it('begrenzt große Sprünge', () => {
    expect(new GameClock().advance(1e9, 3)).toBe(MAX_HOURS_PER_STEP);
  });

  it('spult bei Beschäftigung und Reisen vor', () => {
    expect(effectiveSpeed(0, true, false)).toBe(2);
    expect(effectiveSpeed(1, false, true)).toBe(3);
    expect(effectiveSpeed(1, false, false)).toBe(1);
  });
});
