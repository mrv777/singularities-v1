export interface CliOptions {
  runs: number;
  days: number;
  seed: number;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const opts: CliOptions = {
    runs: 400,
    days: 7,
    seed: 1337,
  };
  for (const arg of argv) {
    if (arg.startsWith("--runs=")) opts.runs = Number(arg.slice("--runs=".length)) || opts.runs;
    if (arg.startsWith("--days=")) opts.days = Number(arg.slice("--days=".length)) || opts.days;
    if (arg.startsWith("--seed=")) opts.seed = Number(arg.slice("--seed=".length)) || opts.seed;
  }
  return opts;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
