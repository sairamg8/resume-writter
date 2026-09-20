// Unit tests for color normalization (ONB-7).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHexColor, withNormalizedColors } from '../../src/utils/colors.js';

describe('normalizeHexColor', () => {
  it('converts CSS named colors to #rrggbb', () => {
    assert.equal(normalizeHexColor('red'), '#ff0000');
    assert.equal(normalizeHexColor('Red'), '#ff0000');
    assert.equal(normalizeHexColor('blue'), '#0000ff');
    assert.equal(normalizeHexColor('darkslategray'), '#2f4f4f');
    assert.equal(normalizeHexColor('white'), '#ffffff');
    assert.equal(normalizeHexColor('black'), '#000000');
  });

  it('converts #rgb and #rgba to 6-digit #rrggbb', () => {
    assert.equal(normalizeHexColor('#abc'), '#aabbcc');
    assert.equal(normalizeHexColor('#AbC'), '#aabbcc');
    assert.equal(normalizeHexColor('#abcd'), '#aabbcc');
  });

  it('preserves valid 6-digit #rrggbb and strips alpha from 8-digit #rrggbbaa', () => {
    assert.equal(normalizeHexColor('#123456'), '#123456');
    assert.equal(normalizeHexColor('#ABCDEF'), '#abcdef');
    assert.equal(normalizeHexColor('#12345678'), '#123456');
  });

  it('converts rgb() and rgba() to #rrggbb', () => {
    assert.equal(normalizeHexColor('rgb(255, 0, 128)'), '#ff0080');
    assert.equal(normalizeHexColor('rgba(255, 0, 128, 0.5)'), '#ff0080');
    assert.equal(normalizeHexColor('rgb(100%, 0%, 50%)'), '#ff0080');
  });

  it('converts hsl() and hsla() to #rrggbb', () => {
    assert.equal(normalizeHexColor('hsl(220,60%,30%)'), '#1f3d7a');
    assert.equal(normalizeHexColor('hsl(220, 60%, 30%)'), '#1f3d7a');
    assert.equal(normalizeHexColor('hsla(220, 60%, 30%, 0.8)'), '#1f3d7a');
    assert.equal(normalizeHexColor('hsl(0, 100%, 50%)'), '#ff0000');
    assert.equal(normalizeHexColor('hsl(120, 100%, 25%)'), '#008000');
  });

  it('returns null for junk or invalid colors', () => {
    assert.equal(normalizeHexColor('banana'), null);
    assert.equal(normalizeHexColor('#12345'), null);
    assert.equal(normalizeHexColor('#1234567'), null);
    assert.equal(normalizeHexColor(''), null);
    assert.equal(normalizeHexColor(null), null);
    assert.equal(normalizeHexColor(undefined), null);
    assert.equal(normalizeHexColor(123), null);
  });
});

describe('withNormalizedColors in normalizeResume', () => {
  it('normalizes colors and drops unreadable values from resume.settings', () => {
    const resume = {
      template: 'classic',
      settings: {
        textColor: 'red',
        accentColor: 'hsl(220,60%,30%)',
        sidebarBg: 'banana',
        headerTextColor: '#12345',
        nameColor: '',
      },
    };
    const normalized = withNormalizedColors(resume);
    assert.equal(normalized.settings.textColor, '#ff0000');
    assert.equal(normalized.settings.accentColor, '#1f3d7a');
    assert.equal('sidebarBg' in normalized.settings, false);
    assert.equal('headerTextColor' in normalized.settings, false);
    assert.equal(normalized.settings.nameColor, '');
  });

  it('preserves object identity when settings colors are already standard', () => {
    const resume = {
      template: 'classic',
      settings: {
        textColor: '#111111',
        accentColor: '#2563eb',
        nameColor: '',
      },
    };
    const normalized = withNormalizedColors(resume);
    assert.equal(normalized, resume);
  });
});
