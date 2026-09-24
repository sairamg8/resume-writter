// Unit tests for src/utils/uiFormat.js — the words and colours the workspace UI kit formats with:
// a DatePill's label and tone, "3d ago", initials, the avatar colour, a shortcut's key caps. Every
// clock read is a fixed local `now`, and day dates are local calendar days, so the results are the
// same in every timezone (checked under TZ=America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati).
// Run: node --test tests/unit/ui-format.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseISODay, daysFromToday, formatShortDay, formatLongDay, datePillInfo, relativeTime, relativeDay,
  formatDateTime, countLabel, initials, avatarTone, AVATAR_TONES, AVATAR_NEUTRAL, shortcutKeys,
} from '../../src/utils/uiFormat.js';

// Wed Sep 23 2026, 10:00 in the machine's own timezone.
const NOW = new Date(2026, 8, 23, 10, 0, 0);

test('parseISODay reads real calendar days only', () => {
  assert.deepEqual(parseISODay('2026-09-24'), { y: 2026, m: 9, d: 24 });
  assert.deepEqual(parseISODay(' 2026-09-24 '), { y: 2026, m: 9, d: 24 });
  for (const bad of ['', null, undefined, 20260924, '2026-02-31', '2026-13-01', '24/09/2026', '2026-9-24', 'Sep 24']) {
    assert.equal(parseISODay(bad), null, String(bad));
  }
});

test('daysFromToday counts local calendar days, whatever the hour', () => {
  assert.equal(daysFromToday('2026-09-23', NOW), 0);
  assert.equal(daysFromToday('2026-09-23', new Date(2026, 8, 23, 23, 59)), 0);
  assert.equal(daysFromToday('2026-09-23', new Date(2026, 8, 23, 0, 0)), 0);
  assert.equal(daysFromToday('2026-09-24', NOW), 1);
  assert.equal(daysFromToday('2026-09-20', NOW), -3);
  assert.equal(daysFromToday('2027-09-23', NOW), 365);
  assert.equal(daysFromToday('nope', NOW), null);
});

test('daysFromToday is whole across a daylight-saving change (23- and 25-hour days)', () => {
  // US DST starts 2026-03-08 and ends 2026-11-01; the EU's 2026-03-29 and 2026-10-25.
  assert.equal(daysFromToday('2026-03-09', new Date(2026, 2, 7, 12)), 2);
  assert.equal(daysFromToday('2026-03-30', new Date(2026, 2, 28, 12)), 2);
  assert.equal(daysFromToday('2026-11-02', new Date(2026, 9, 31, 12)), 2);
  assert.equal(daysFromToday('2026-10-24', new Date(2026, 9, 26, 12)), -2);
});

test('formatShortDay and formatLongDay', () => {
  assert.equal(formatShortDay('2026-09-24', NOW), 'Sep 24');
  assert.equal(formatShortDay('2027-01-05', NOW), 'Jan 5, 2027');
  assert.equal(formatShortDay('2025-12-31', NOW), 'Dec 31, 2025');
  assert.equal(formatShortDay('', NOW), '');
  assert.equal(formatLongDay('2026-09-24'), 'Thu, Sep 24, 2026');
  assert.equal(formatLongDay('2026-02-29'), '');
});

test('datePillInfo: labels', () => {
  const label = (iso, opts) => datePillInfo(iso, NOW, opts)?.label;
  assert.equal(label('2026-09-23'), 'Today');
  assert.equal(label('2026-09-24'), 'Tomorrow');
  assert.equal(label('2026-09-22'), 'Yesterday');
  assert.equal(label('2026-09-20'), '3d overdue');
  assert.equal(label('2026-10-02'), 'Oct 2');
  assert.equal(label('2027-02-01'), 'Feb 1, 2027');
  // Done, or a plain date: never "overdue".
  assert.equal(label('2026-09-20', { done: true }), 'Sep 20');
  assert.equal(label('2026-09-20', { kind: 'plain' }), 'Sep 20');
  assert.equal(label('2026-09-22', { kind: 'plain' }), 'Yesterday');
});

test('datePillInfo: tones follow dates.js deadlineState (past, 3 days "soon", else neutral)', () => {
  const tone = (iso, opts, now = NOW) => datePillInfo(iso, now, opts)?.tone;
  assert.equal(tone('2026-09-22'), 'danger');
  assert.equal(tone('2026-09-01'), 'danger');
  assert.equal(tone('2026-09-23'), 'warning');       // today is not over yet
  assert.equal(tone('2026-09-24'), 'warning');
  assert.equal(tone('2026-09-25'), 'warning');       // ends in 2 days 14 h: within 3 days
  assert.equal(tone('2026-09-26'), 'neutral');       // ends in 3 days 14 h
  assert.equal(tone('2026-09-26', {}, new Date(2026, 8, 24, 0, 0, 1)), 'warning'); // just under 3 days left
  assert.equal(tone('2026-09-22', { done: true }), 'neutral');
  assert.equal(tone('2026-09-22', { kind: 'plain' }), 'neutral');
  assert.equal(tone('2026-09-24', { kind: 'plain' }), 'neutral');
});

test('datePillInfo: the title carries what the colour says; null for no day', () => {
  assert.equal(datePillInfo('2026-09-20', NOW).title, 'Sun, Sep 20, 2026 · overdue by 3 days');
  assert.equal(datePillInfo('2026-09-22', NOW).title, 'Tue, Sep 22, 2026 · overdue by 1 day');
  assert.equal(datePillInfo('2026-09-24', NOW).title, 'Thu, Sep 24, 2026 · due soon');
  assert.equal(datePillInfo('2026-10-24', NOW).title, 'Sat, Oct 24, 2026');
  assert.equal(datePillInfo('2026-09-20', NOW, { done: true }).title, 'Sun, Sep 20, 2026');
  assert.equal(datePillInfo('2026-09-20', NOW).days, -3);
  for (const blank of ['', null, undefined, '2026-02-30', 'soon']) assert.equal(datePillInfo(blank, NOW), null);
});

test('relativeTime: moments', () => {
  const at = (ms) => relativeTime(NOW.getTime() - ms, NOW);
  assert.equal(at(0), 'just now');
  assert.equal(at(59 * 1000), 'just now');
  assert.equal(at(-30 * 1000), 'just now');
  assert.equal(at(60 * 1000), '1m ago');
  assert.equal(at(59 * 60 * 1000), '59m ago');
  assert.equal(at(3 * 3600 * 1000), '3h ago');
  assert.equal(at(3 * 86400 * 1000 + 23 * 3600 * 1000), '3d ago');
  assert.equal(at(14 * 86400 * 1000), '2w ago');
  assert.equal(at(95 * 86400 * 1000), '3mo ago');
  assert.equal(at(800 * 86400 * 1000), '2y ago');
  assert.equal(at(-3 * 86400 * 1000), 'in 3d');
  assert.equal(relativeTime(new Date(NOW.getTime() - 5 * 60 * 1000), NOW), '5m ago');
  for (const bad of [undefined, null, 'yesterday', NaN, {}]) assert.equal(relativeTime(bad, NOW), '');
});

test('relativeDay: calendar days', () => {
  assert.equal(relativeDay('2026-09-23', NOW), 'today');
  assert.equal(relativeDay('2026-09-22', NOW), 'yesterday');
  assert.equal(relativeDay('2026-09-24', NOW), 'tomorrow');
  assert.equal(relativeDay('2026-09-18', NOW), '5d ago');
  assert.equal(relativeDay('2026-09-02', NOW), '3w ago');
  assert.equal(relativeDay('2026-06-01', NOW), '3mo ago');
  assert.equal(relativeDay('2026-09-28', NOW), 'in 5d');
  assert.equal(relativeDay('', NOW), '');
});

test('formatDateTime: local, 12-hour clock', () => {
  assert.equal(formatDateTime(new Date(2026, 8, 24, 15, 45).getTime()), 'Sep 24, 2026, 3:45 PM');
  assert.equal(formatDateTime(new Date(2026, 0, 2, 0, 5)), 'Jan 2, 2026, 12:05 AM');
  assert.equal(formatDateTime(new Date(2026, 0, 2, 12, 0)), 'Jan 2, 2026, 12:00 PM');
  assert.equal(formatDateTime(undefined), '');
});

test('countLabel', () => {
  assert.equal(countLabel(1, 'issue'), '1 issue');
  assert.equal(countLabel(0, 'issue'), '0 issues');
  assert.equal(countLabel(2, 'activity', 'activities'), '2 activities');
});

test('initials', () => {
  assert.equal(initials('Sarah Kim'), 'SK');
  assert.equal(initials('Google'), 'G');
  assert.equal(initials('goldman sachs group'), 'GS');
  assert.equal(initials('  — Acme  '), 'A');
  assert.equal(initials('ámbar labs'), 'ÁL');
  assert.equal(initials('3M Company'), '3C');
  assert.equal(initials('AT&T'), 'AT');
  assert.equal(initials('Sarah Kim', 1), 'S');
  for (const blank of ['', '   ', null, undefined, '—']) assert.equal(initials(blank), '?');
});

test('avatarTone: deterministic, case- and space-blind, spread over the palette', () => {
  assert.equal(avatarTone('Google'), avatarTone('Google'));
  assert.equal(avatarTone('Google'), avatarTone('  google '));
  assert.ok(AVATAR_TONES.includes(avatarTone('Google')));
  assert.equal(avatarTone(''), AVATAR_NEUTRAL);
  assert.equal(avatarTone(null), AVATAR_NEUTRAL);
  const names = ['Google', 'Stripe', 'Linear', 'Atlassian', 'Vercel', 'Figma', 'Notion', 'Airbnb', 'Netflix', 'Shopify', 'Canva', 'Zoho'];
  assert.ok(new Set(names.map(avatarTone)).size >= 5, 'twelve names land on at least five colours');
  for (const t of AVATAR_TONES) assert.match(`${t.bg} ${t.text}`, /^bg-[a-z]+-100 text-[a-z]+-[78]00$/);
});

test('shortcutKeys: Mac glyphs vs words elsewhere', () => {
  assert.deepEqual(shortcutKeys('mod+k', true), ['⌘', 'K']);
  assert.deepEqual(shortcutKeys('mod+k', false), ['Ctrl', 'K']);
  assert.deepEqual(shortcutKeys('mod+Enter', true), ['⌘', '↵']);
  assert.deepEqual(shortcutKeys('shift+?', false), ['Shift', '?']);
  assert.deepEqual(shortcutKeys('/'), ['/']);
  assert.deepEqual(shortcutKeys('c'), ['C']);
  assert.deepEqual(shortcutKeys('Escape'), ['Esc']);
  assert.deepEqual(shortcutKeys('mod++', true), ['⌘', '+']);
});
