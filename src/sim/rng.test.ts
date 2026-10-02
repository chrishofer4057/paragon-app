import { describe, expect, it } from 'vitest';
import { createRng, hashFloat, nextFloat, nextInt, pickWeighted } from './rng';

describe('rng', () => {
  it('liefert bei gleichem Seed dieselbe Folge', () => {
    const a = createRng(99);
    const b = createRng(99);
    const seqA = Array.from({ length: 20 }, () => nextFloat(a));
    const seqB = Array.from({ length: 20 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('bleibt im Bereich [0, 1) und ganzzahlige Werte in den Grenzen', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(rng, 3, 5);
      expect([3, 4, 5]).toContain(n);
    }
  });

  it('ist über JSON serialisierbar und setzt danach exakt fort', () => {
    const rng = createRng(5);
    nextFloat(rng);
    const restored = JSON.parse(JSON.stringify(rng)) as typeof rng;
    expect(nextFloat(restored)).toBe(nextFloat(rng));
  });

  it('wählt gewichtet und ignoriert Nullgewichte', () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      expect(pickWeighted(rng, ['a', 'b'], (x) => (x === 'a' ? 0 : 1))).toBe('b');
    }
  });

  it('hashFloat ist zustandslos und deterministisch', () => {
    expect(hashFloat(1, 2, 3)).toBe(hashFloat(1, 2, 3));
    expect(hashFloat(1, 2, 3)).not.toBe(hashFloat(1, 2, 4));
  });
});
