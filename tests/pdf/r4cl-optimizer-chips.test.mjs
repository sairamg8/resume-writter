// The STAR Optimizer's chips wrote broken sentences.
// - R4-CL-07: a power verb always overwrote the first word, whatever it was: "Responsible for
//   migrating…" became "Spearheaded for migrating…", "In 2023, built…" "Spearheaded 2023, built…", and
//   the split/join made the statement's lines one. It now replaces a leading verb or weak phrase, and
//   otherwise goes before the first word.
// - R4-CL-08: a metric chip was added after the sentence's full stop ("…service. by 35%"), and to an
//   empty statement with a space in front. It now goes before the closing punctuation.
// The real modal is mounted (react-dom/client over tests/pdf/fake-dom.mjs) and its chips are clicked.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The optimizer open on `initialText`, `click(label)` a chip by its text, `text()` the statement. */
async function optimizer(initialText) {
  const { default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx');
  const view = mount(BulletOptimizerModal, { isOpen: true, onClose() {}, onApply() {}, initialText });
  const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  return {
    click(text, category) {
      if (category) {
        const tab = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && label(el) === category);
        view.act(() => reactProps(tab).onClick());
      }
      const chip = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && label(el) === text);
      assert.ok(chip, `a chip reads "${text}"`);
      view.act(() => reactProps(chip).onClick());
    },
    text: () => reactProps([...elements(view.container)].find((el) => el.tagName === 'TEXTAREA')).value,
    unmount: () => view.unmount(),
  };
}

/** The statement once `chips` ([label, category?]) are clicked in turn. */
async function after_(initialText, ...chips) {
  const o = await optimizer(initialText);
  try {
    for (const [chip, category] of chips) o.click(chip, category);
    return o.text();
  } finally {
    await o.unmount();
  }
}

describe('a power verb chip (R4-CL-07)', () => {
  it('replaces a leading weak phrase, not just its first word', async () => {
    assert.equal(await after_('Responsible for migrating 12 services to AWS', ['Spearheaded', 'Leadership']), 'Spearheaded migrating 12 services to AWS');
    assert.equal(await after_('Worked on the billing API', ['Architected']), 'Architected the billing API');
  });

  it('goes before a first word that is no verb, which is lowercased', async () => {
    assert.equal(await after_('In 2023, built a billing API', ['Spearheaded', 'Leadership']), 'Spearheaded in 2023, built a billing API');
    assert.equal(await after_('AWS migration of 12 services', ['Architected']), 'Architected AWS migration of 12 services');
  });

  it('replaces a leading action verb, keeping what follows it', async () => {
    assert.equal(await after_('Built the billing API, cutting costs 20%', ['Architected']), 'Architected the billing API, cutting costs 20%');
    assert.equal(await after_('Led, with two peers, the migration', ['Spearheaded', 'Leadership']), 'Spearheaded, with two peers, the migration');
  });

  it('replaces a whole verb phrase Auto-Fix writes, and keeps a leading bullet mark', async () => {
    assert.equal(await after_('Contributed to the hackathon', ['Spearheaded', 'Leadership']), 'Spearheaded the hackathon');
    assert.equal(await after_('Collaborated on the SDK', ['Architected']), 'Architected the SDK');
    assert.equal(await after_('- Led the migration', ['Spearheaded', 'Leadership']), '- Spearheaded the migration');
  });

  it('keeps the statement\'s line breaks', async () => {
    assert.equal(await after_('Built the API\nCut costs by 20%', ['Architected']), 'Architected the API\nCut costs by 20%');
  });
});

describe('a metric chip (R4-CL-08)', () => {
  it('goes before the sentence\'s closing full stop', async () => {
    assert.equal(await after_('Reduced API latency for the checkout service.', ['+ by 35%']), 'Reduced API latency for the checkout service by 35%.');
    assert.equal(await after_('Cut costs!', ['+ saving $25K annually']), 'Cut costs saving $25K annually!');
  });

  it('with no closing punctuation, goes at the end', async () => {
    assert.equal(await after_('Reduced API latency', ['+ by 35%']), 'Reduced API latency by 35%');
  });

  it('on an empty statement, is the phrase alone', async () => {
    assert.equal(await after_('', ['+ by 35%']), 'by 35%');
  });
});
