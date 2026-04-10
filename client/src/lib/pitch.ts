/** Chromatic pitch helpers: strided autocorrelation + equal-temperament note from Hz. */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const MIN_HZ = 70;
const MAX_HZ = 1500;

/** Reject only true silence / noise floor; float samples are often modest even when audible. */
const RMS_FLOOR = 0.003;
const PEAK_FLOOR = 0.006;

function correlationAtCentered(
  timeDomain: ArrayLike<number>,
  lag: number,
  n: number,
  mean: number,
): number {
  let sum = 0;
  for (let i = 0; i < n - lag; i += 2) {
    const a = timeDomain[i] - mean;
    const b = timeDomain[i + lag] - mean;
    sum += a * b;
  }
  return sum;
}

function zeroLagEnergyCentered(timeDomain: ArrayLike<number>, n: number, mean: number): number {
  let sum = 0;
  for (let i = 0; i < n; i += 2) {
    const a = timeDomain[i] - mean;
    sum += a * a;
  }
  return sum;
}

/**
 * Fundamental frequency (Hz) from a time-domain slice, or -1 if no clear pitch / too quiet.
 */
export function detectPitch(timeDomain: ArrayLike<number>, sampleRate: number): number {
  const n = timeDomain.length;
  const minPeriod = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxPeriod = Math.min(Math.floor(n / 2) - 1, Math.ceil(sampleRate / MIN_HZ));

  let sum = 0;
  for (let i = 0; i < n; i++) sum += timeDomain[i];
  const mean = sum / n;

  let rmsAcc = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = timeDomain[i] - mean;
    rmsAcc += v * v;
    const av = Math.abs(v);
    if (av > peak) peak = av;
  }
  const rms = Math.sqrt(rmsAcc / n);
  if (rms < RMS_FLOOR && peak < PEAK_FLOOR) return -1;

  const energy0 = zeroLagEnergyCentered(timeDomain, n, mean);
  if (energy0 < 1e-12) return -1;

  let bestLag = minPeriod;
  let bestCorr = -Infinity;
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    const c = correlationAtCentered(timeDomain, lag, n, mean);
    if (c > bestCorr) {
      bestCorr = c;
      bestLag = lag;
    }
  }
  if (bestCorr <= 0) return -1;

  // Quiet broadband noise can produce weak random peaks; require a periodic-looking bump vs total energy.
  if (bestCorr < energy0 * 0.03) return -1;

  if (bestLag > minPeriod && bestLag < maxPeriod) {
    const c0 = correlationAtCentered(timeDomain, bestLag - 1, n, mean);
    const c1 = correlationAtCentered(timeDomain, bestLag, n, mean);
    const c2 = correlationAtCentered(timeDomain, bestLag + 1, n, mean);
    const denom = c0 - 2 * c1 + c2;
    if (Math.abs(denom) > 1e-10) {
      const delta = (c0 - c2) / (2 * denom);
      const refinedLag = bestLag + delta;
      const f = sampleRate / refinedLag;
      if (f >= MIN_HZ && f <= MAX_HZ && isFinite(f)) return f;
    }
  }

  const f = sampleRate / bestLag;
  if (f < MIN_HZ || f > MAX_HZ || !isFinite(f)) return -1;
  return f;
}

export type NoteReading = {
  name: (typeof NOTE_NAMES)[number];
  octave: number;
  frequency: number;
  /** Cents from the nearest equal-tempered semitone; negative = flat. */
  cents: number;
};

export function hzToNote(hz: number, referenceHz = 440): NoteReading {
  const midiFloat = 12 * Math.log2(hz / referenceHz) + 69;
  const rounded = Math.round(midiFloat);
  const cents = (midiFloat - rounded) * 100;
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return {
    name: NOTE_NAMES[noteIndex],
    octave,
    frequency: hz,
    cents,
  };
}
