// Deterministic seeded RNG (mulberry32) so a given seed always reproduces the same colony.
export function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rand {
  private rng: () => number;
  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }
  float(min = 0, max = 1) {
    return min + this.rng() * (max - min);
  }
  int(min: number, max: number) {
    return Math.floor(this.float(min, max + 1));
  }
  bool(p = 0.5) {
    return this.rng() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }
  weighted<T>(entries: [T, number][]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r <= 0) return v;
    }
    return entries[entries.length - 1][0];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  next() {
    return this.rng();
  }
}
