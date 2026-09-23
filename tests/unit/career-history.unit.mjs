// Unit tests for src/utils/careerHistory.js, the Career History panel's numbers (AUD-29). `now` is
// passed, so a current job measures to a fixed month. Run: node --test tests/unit/career-history.unit.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  careerItems, monthIndex, entrySpan, careerMonths, companyCount, entryLabel, totalLabel, companiesLabel,
} from '../../src/utils/careerHistory.js';

const NOW = new Date(2026, 8, 23); // 23 Sep 2026
const job = (startDate, endDate, extra = {}) => ({ company: 'A', startDate, endDate, ...extra });

describe('careerItems: the experience the résumé prints', () => {
  it('every visible experience section, its visible items, in order', () => {
    const resume = {
      sections: [
        { type: 'experience', items: [{ id: 1 }, { id: 2, visible: false }, null] },
        { type: 'education', items: [{ id: 3 }] },
        { type: 'experience', visible: false, items: [{ id: 4 }] },
        { type: 'experience', items: [{ id: 5 }] },
        { type: 'experience' },
        null,
      ],
    };
    assert.deepEqual(careerItems(resume).map((i) => i.id), [1, 5]);
  });

  it('no résumé, no sections: none', () => {
    assert.deepEqual(careerItems(undefined), []);
    assert.deepEqual(careerItems({ sections: 'x' }), []);
  });
});

describe('entrySpan', () => {
  it('end exclusive: Jan 2020 – Mar 2023 is 38 months', () => {
    const [s, e] = entrySpan(job('Jan 2020', 'Mar 2023'), NOW);
    assert.equal(e - s, 38);
  });

  it('a year alone is its January; a number reads as the year', () => {
    assert.deepEqual(entrySpan(job('2019', 2021), NOW), [monthIndex('Jan 2019'), monthIndex('Jan 2021')]);
  });

  it('a current job runs to this month, whatever its end field holds', () => {
    const [s, e] = entrySpan(job('Jan 2025', 'Present', { current: true }), NOW);
    assert.equal(e - s, 20); // Jan 2025 → Sep 2026
  });

  it('no end and not current, an end that is not a date, a same-month or reversed span: none', () => {
    for (const item of [
      job('Jan 2020', ''), job('Jan 2020', undefined), job('Jan 2020', 'Present'), job('Jan 2020', 'Summer 2021'),
      job('Mar 2020', 'Mar 2020'), job('Mar 2021', 'Jan 2020'), job('', 'Jan 2020'), job('Jan 2030', '', { current: true }),
    ]) assert.equal(entrySpan(item, NOW), null, JSON.stringify(item));
  });
});

describe('careerMonths: spans merged', () => {
  it('a gap is not counted', () => {
    assert.equal(careerMonths([job('Jan 2010', 'Jan 2012'), job('Jan 2020', 'Jan 2022')], NOW), 48);
  });

  it('two jobs at once count once, in any order', () => {
    assert.equal(careerMonths([job('Jan 2020', 'Jan 2021'), job('Jan 2018', 'Jan 2022')], NOW), 48);
  });

  it('back-to-back jobs join without a month lost or doubled', () => {
    assert.equal(careerMonths([job('Jan 2018', 'Jan 2020'), job('Jan 2020', 'Jan 2022')], NOW), 48);
  });

  it('a current job overlapping a past one: Jan 2018 – Jan 2022 plus Jan 2021 – now is 104 months', () => {
    assert.equal(careerMonths([job('Jan 2018', 'Jan 2022'), job('Jan 2021', '', { current: true })], NOW), 104);
  });

  it('an entry with no known length adds nothing; none at all is 0', () => {
    assert.equal(careerMonths([job('Jan 2000', ''), job('Jan 2020', 'Jan 2021')], NOW), 12);
    assert.equal(careerMonths([], NOW), 0);
  });
});

describe('companyCount', () => {
  it('distinct names: trimmed, inner spaces collapsed, any case; a blank name is none', () => {
    const items = ['Initech', ' initech ', 'Globex  Corp', 'globex corp', '', '  ', undefined, 'Umbrella'].map((company) => ({ company }));
    assert.equal(companyCount(items), 3);
  });
});

describe('labels', () => {
  it('an entry: "3yr 2mo", "2yr", "5mo", none for 0', () => {
    assert.deepEqual([38, 24, 5, 13, 0, -3].map(entryLabel), ['3yr 2mo', '2yr', '5mo', '1yr 1mo', '', '']);
  });

  it('the total, singular for one', () => {
    assert.deepEqual(
      [48, 12, 5, 1, 38, 13, 25, 0].map(totalLabel),
      ['4 years', '1 year', '5 months', '1 month', '3 yrs 2 mos', '1 yr 1 mo', '2 yrs 1 mo', ''],
    );
  });

  it('companies, singular for one', () => {
    assert.deepEqual([1, 3, 0].map(companiesLabel), ['1 company', '3 companies', '']);
  });
});
