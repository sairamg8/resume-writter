// A skill group that holds nothing but the old `name` label — how the role starters saved every
// skill (1f08531) — reads as a group of skills: normalizeResume() runs withSkillNames() wherever
// résumés come in, so a résumé made from a starter before the fix prints its skills again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillGroup, withSkillNames } from '../../src/utils/skills.js';

const resumeWith = (items, type = 'skills') => ({ sections: [{ id: 's', type, items }] });

test('withSkillNames: a group holding only `name` holds it as its skills', () => {
  const r = withSkillNames(resumeWith([{ id: 'a', name: 'Python & R' }, { id: 'b', name: ' Docker & Kubernetes ' }]));
  assert.deepEqual(r.sections[0].items, [{ id: 'a', skills: 'Python & R' }, { id: 'b', skills: 'Docker & Kubernetes' }]);
  assert.deepEqual(r.sections[0].items.map((i) => skillGroup(i).skills), ['Python & R', 'Docker & Kubernetes']);
});

test('withSkillNames: real groups, other sections and blank names are left as they are — the same objects', () => {
  const real = resumeWith([{ id: 'a', category: 'Lang', skills: 'Go', name: 'old' }, { id: 'b', category: 'Tools', name: 'x' }, { id: 'c', name: '  ' }]);
  assert.equal(withSkillNames(real), real);
  const projects = resumeWith([{ id: 'p', name: 'Engine' }], 'projects');
  assert.equal(withSkillNames(projects), projects);
  for (const odd of [{}, { sections: null }, { sections: [null, { type: 'skills', items: null }] }]) assert.equal(withSkillNames(odd), odd);
});

test('withSkillNames: idempotent', () => {
  const once = withSkillNames(resumeWith([{ id: 'a', name: 'SQL' }]));
  assert.equal(withSkillNames(once), once);
});
