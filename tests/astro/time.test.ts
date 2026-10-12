// Time-scale tests (values from IERS Leap_Second.dat / NAIF time required reading; tolerances are exact or physical bounds).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ttMinusUtc, utcToTT, ttToUtc, tdbMinusTT, taiMinusUtc, jdFromCalendar, calendar, timeScaleStatus } from '../../src/astro/time';
test('TAI−UTC across leap seconds', () => {
  assert.equal(taiMinusUtc(jdFromCalendar(1972, 1, 1, 0, 0, 1)), 10);
  assert.equal(taiMinusUtc(jdFromCalendar(2016, 12, 31, 23, 59, 0)), 36);
  assert.equal(taiMinusUtc(jdFromCalendar(2017, 1, 1, 0, 0, 1)), 37);
  assert.equal(taiMinusUtc(jdFromCalendar(2026, 10, 8)), 37);
  assert.equal(taiMinusUtc(jdFromCalendar(1960, 1, 1)), null);
});
test('TT−UTC = 69.184 s in 2026 (TAI−UTC 37 s + 32.184 s)', () => assert.ok(Math.abs(ttMinusUtc(jdFromCalendar(2026, 10, 8)) - 69.184) < 1e-9));
test('TT−UTC = 64.184 s in 2000 (TAI−UTC 32 s)', () => assert.ok(Math.abs(ttMinusUtc(jdFromCalendar(2000, 1, 1, 12)) - 64.184) < 1e-9));
test('UTC→TT→UTC round trip < 1 µs across the 2016/2017 leap second', () => {
  for (const h of [0, 6, 23.9]) { const u = jdFromCalendar(2016, 12, 31, h); assert.ok(Math.abs(ttToUtc(utcToTT(u)) - u) * 86400 < 1e-6); }
  for (const y of [1950, 1985, 2026, 2100]) { const u = jdFromCalendar(y, 3, 1); assert.ok(Math.abs(ttToUtc(utcToTT(u)) - u) * 86400 < 1e-5, String(y)); }
});
test('|TDB−TT| ≤ 1.7 ms', () => { for (let d = 0; d < 400; d += 7) assert.ok(Math.abs(tdbMinusTT(2461000 + d)) <= 0.00168); });
test('pre-1972 ΔT is plausible (1950: ≈29 s, Espenak & Meeus)', () => { const v = ttMinusUtc(jdFromCalendar(1950, 1, 1)); assert.ok(v > 28 && v < 30.5, String(v)); });
test('leap-second horizon flagged as predicted after 2027-06-30', () => {
  assert.equal(timeScaleStatus(jdFromCalendar(2026, 10, 8)).predicted, false);
  assert.equal(timeScaleStatus(jdFromCalendar(2030, 1, 1)).predicted, true);
});
test('calendar round trip incl. Gregorian reform and BCE', () => {
  for (const [y, m, d] of [[2026, 10, 8], [1582, 10, 15], [1582, 10, 4], [-500, 3, 1], [2000, 2, 29]]) { const c = calendar(jdFromCalendar(y, m, d, 12)); assert.deepEqual([c.year, c.month, c.day, c.h], [y, m, d, 12]); }
});
