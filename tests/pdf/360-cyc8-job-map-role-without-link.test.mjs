// A Job Map role whose posting address is unusable (roleHref gives null: a blank or non-web address) drew an <a> with no href that still
// had the card's hover border and the external-link icon, so it looked clickable and did nothing. RoleRow now draws a plain card for it
// (a div: no link, no hover border, no icon) and keeps the link card, with the icon, for a row that has an address.
// Run: node --test tests/pdf/360-cyc8-job-map-role-without-link.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { createElement as h } from 'react';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
const tags = (view) => [...elements(view.container)].map((el) => el.tagName);

it('a role with no usable address is a plain card: no <a>, no hover border, no external-link icon', async () => {
  const { RoleRow } = await loadModule('/src/pages/JobMap.jsx');
  const view = mount(RoleRow, { href: null, children: h('span', null, 'Platform Engineer') });
  try {
    const all = tags(view);
    assert.ok(!all.includes('A'), 'nothing that links');
    assert.ok(!all.includes('svg'), 'no external-link icon');
    const card = view.container.firstChild;
    assert.equal(card.tagName, 'DIV');
    assert.ok(tokens(card).has('cv-card'), 'still the same card');
    assert.ok(!tokens(card).has('hover:border-cv-brand'), 'no hover border');
    assert.equal(card.textContent, 'Platform Engineer');
  } finally {
    await view.unmount();
  }
});

it('a role with an address is a link to it, in a new tab, with the icon and the hover border', async () => {
  const { RoleRow } = await loadModule('/src/pages/JobMap.jsx');
  const view = mount(RoleRow, { href: 'https://jobs.example.com/roles/1', children: h('span', null, 'Platform Engineer') });
  try {
    const link = view.container.firstChild;
    assert.equal(link.tagName, 'A');
    assert.equal(link.getAttribute('href'), 'https://jobs.example.com/roles/1');
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.ok(tokens(link).has('hover:border-cv-brand'));
    assert.ok(tags(view).includes('svg'), 'the external-link icon');
  } finally {
    await view.unmount();
  }
});
