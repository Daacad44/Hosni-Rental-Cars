import { describe, it, expect } from 'vitest';
import { rangesOverlap } from './availability.service.js';

const d = (iso: string) => new Date(iso);

describe('rangesOverlap', () => {
  const aStart = d('2025-01-10T00:00:00Z');
  const aEnd = d('2025-01-15T00:00:00Z');

  it('detects a clear overlap', () => {
    expect(rangesOverlap(aStart, aEnd, d('2025-01-12T00:00:00Z'), d('2025-01-20T00:00:00Z'))).toBe(true);
  });

  it('treats touching endpoints as non-overlapping (half-open)', () => {
    // b starts exactly when a ends.
    expect(rangesOverlap(aStart, aEnd, d('2025-01-15T00:00:00Z'), d('2025-01-20T00:00:00Z'))).toBe(false);
    // b ends exactly when a starts.
    expect(rangesOverlap(aStart, aEnd, d('2025-01-05T00:00:00Z'), d('2025-01-10T00:00:00Z'))).toBe(false);
  });

  it('detects full containment either way', () => {
    expect(rangesOverlap(aStart, aEnd, d('2025-01-11T00:00:00Z'), d('2025-01-12T00:00:00Z'))).toBe(true);
    expect(rangesOverlap(aStart, aEnd, d('2025-01-01T00:00:00Z'), d('2025-02-01T00:00:00Z'))).toBe(true);
  });

  it('returns false for clearly separate ranges', () => {
    expect(rangesOverlap(aStart, aEnd, d('2025-02-01T00:00:00Z'), d('2025-02-05T00:00:00Z'))).toBe(false);
  });
});
