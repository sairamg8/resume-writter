// The role starters (1f08531) stored every skill as { id, name }; the PDF reads a group's `category`
// and `skills`, so a résumé made from a starter printed a Skills heading with nothing under it (bug
// audit 2026-09-22). The starters now store skill groups, and a résumé saved from an old starter
// prints its skills again as it loads (normalizeResume → withSkillNames).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, allText, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const flat = (s) => s.replace(/\s+/g, ' ');

describe('starter résumés print their skills', () => {
  it('a résumé made from each starter prints every skill it lists', async () => {
    const { STARTER_TEMPLATES, buildResumeFromStarter } = await loadModule('/src/utils/starterTemplates.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { skillGroup } = await loadModule('/src/utils/skills.js');
    for (const t of STARTER_TEMPLATES) {
      const r = normalizeResume(buildResumeFromStarter(t.id, `r_${t.id}`));
      const skills = r.sections.find((s) => s.type === 'skills').items.flatMap((i) => skillGroup(i).list);
      const text = flat(allText(await read(await render(r))));
      for (const sk of skills) assert.ok(text.includes(sk), `${t.id} (${t.template}): "${sk}" not printed`);
    }
  });

  it('a résumé saved from an old starter ({ id, name } skills) prints them after loading, in every template', async () => {
    const { buildResumeFromStarter } = await loadModule('/src/utils/starterTemplates.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const names = ['Python & R', 'SQL & Snowflake', 'Docker & Kubernetes'];
    for (const template of TEMPLATES) {
      const old = buildResumeFromStarter('data-scientist', `old_${template}`);
      old.template = template;
      old.sections.find((s) => s.type === 'skills').items = names.map((name, i) => ({ id: `sk-${i + 1}`, name }));
      const r = normalizeResume(JSON.parse(JSON.stringify(old)));
      const text = flat(allText(await read(await render(r))));
      for (const sk of names) assert.ok(text.toLowerCase().includes(sk.toLowerCase()), `${template}: "${sk}" not printed`);
    }
  });
});

describe('a starter résumé loads as it was made', () => {
  it('no migration changes it on the next load — the Modern starter keeps its photo text Center', async () => {
    const { STARTER_TEMPLATES, buildResumeFromStarter } = await loadModule('/src/utils/starterTemplates.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const t of STARTER_TEMPLATES) {
      const made = buildResumeFromStarter(t.id, `r_${t.id}`);
      const reloaded = normalizeResume(JSON.parse(JSON.stringify(made))); // what the next page load does
      assert.deepEqual(reloaded.settings, made.settings, `${t.id} (${t.template})`);
    }
    const modern = STARTER_TEMPLATES.find((t) => t.template === 'modern');
    const r = normalizeResume(JSON.parse(JSON.stringify(buildResumeFromStarter(modern.id, 'm'))));
    assert.equal(r.settings.photoTextAlign, 'center');
  });
});
