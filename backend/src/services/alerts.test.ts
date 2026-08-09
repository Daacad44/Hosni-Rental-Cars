import { describe, it, expect } from 'vitest';
import { dayBucket } from './alerts.service.js';

describe('dayBucket', () => {
  it('truncates any moment to the start of its UTC day', () => {
    const b = dayBucket(new Date('2025-05-10T13:45:12.000Z'));
    expect(b.toISOString()).toBe('2025-05-10T00:00:00.000Z');
  });

  it('is stable across times on the same day — the alert dedup key', () => {
    const morning = dayBucket(new Date('2025-05-10T02:00:00.000Z'));
    const evening = dayBucket(new Date('2025-05-10T23:59:59.000Z'));
    expect(morning.getTime()).toBe(evening.getTime());
  });
});
