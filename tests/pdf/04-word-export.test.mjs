// The Word export: same content and hidden fields as the PDF, rich text parsed the same way.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const has = (doc, s) => doc.texts.some((t) => t.includes(s));

describe('Word export', () => {
  it('prints the summary as text, not as HTML markup', async () => {
    const doc = await renderDocx(resume({ personal: { summary: '<p>Hello <strong>world</strong></p><p>Second line</p>' } }));
    assert.ok(has(doc, 'Hello world'), doc.texts.join(' | '));
    assert.ok(has(doc, 'Second line'));
    assert.ok(!doc.texts.some((t) => t.includes('<p>')), 'no tags');
    const hidden = await renderDocx(resume({ personal: { summary: '<p>Secret summary</p>', hiddenFields: ['summary'] } }));
    assert.ok(!has(hidden, 'Secret summary'), 'a hidden summary stays out');
  });

  it('leaves out hidden sections, hidden entries and hidden fields', async () => {
    const doc = await renderDocx(resume({
      sections: [
        experience([
          { company: 'Shown Co', role: 'Hidden Role', hiddenFields: ['role'] },
          { company: 'Hidden Entry Co', visible: false },
        ]),
        { ...section('projects', [{ name: 'Hidden Section Project' }]), visible: false },
        section('skills', [{ category: 'Hidden Category', skills: 'Visible Skills', hiddenFields: ['category'] }]),
      ],
    }));
    assert.ok(has(doc, 'Shown Co'));
    assert.ok(has(doc, 'Visible Skills'));
    for (const s of ['Hidden Role', 'Hidden Entry Co', 'Hidden Section Project', 'Hidden Category']) assert.ok(!has(doc, s), s);
  });

  it('rich text: line breaks, <div> lines, numbered lists from start, links', async () => {
    const doc = await renderDocx(resume({
      sections: [experience([{ description: 'One<div>Two</div><p>a<br>b</p><ol start="3"><li>Third</li></ol><p><a href="https://example.com/x">site</a></p>' }])],
    }));
    assert.ok(doc.texts.includes('One') && doc.texts.includes('Two'), doc.texts.join(' | '));
    assert.ok(doc.texts.includes('a\nb'), 'a <br> is a line break');
    assert.ok(doc.texts.includes('3.\tThird'), 'numbering starts at 3');
    assert.ok(doc.links.includes('https://example.com/x'));
  });

  it('contact lines link to mailto:, tel: and the site', async () => {
    const doc = await renderDocx(resume({ personal: { email: 'me@example.com', phone: '+1 555 0100', linkedin: 'linkedin.com/in/me', linkedinLabel: 'My LinkedIn' } }));
    assert.deepEqual(doc.links, ['mailto:me@example.com', 'tel:+15550100', 'https://linkedin.com/in/me']);
    assert.ok(has(doc, 'My LinkedIn'), 'the display label prints');
  });

  it('education prints the field of study and location; languages without a level print no dash', async () => {
    const doc = await renderDocx(resume({
      sections: [
        section('education', [{ institution: 'Uni', degree: 'B.Tech', fieldOfStudy: 'Computer Science', location: 'Hyderabad', startDate: '2012', endDate: '2016' }]),
        section('languages', [{ language: 'Telugu', proficiency: '' }]),
      ],
    }));
    assert.ok(has(doc, 'Computer Science') && has(doc, 'Hyderabad'), doc.texts.join(' | '));
    assert.ok(doc.texts.includes('Telugu'), 'no " — " after a language without a level');
  });

  it('follows the section\'s title order and the template default (Executive: role first)', async () => {
    const entry = [{ company: 'Acme', role: 'Lead', location: '' }];
    const exec = await renderDocx(resume({ template: 'executive', sections: [experience(entry)] }));
    // Executive's Inline title joins the two with ", ", as its PDF prints them (R4-DOUT-02).
    assert.ok(exec.texts.some((t) => t.startsWith('Lead, Acme')), exec.texts.join(' | '));
    // Classic's Title is Stacked: the role on the line under the company (R2-070).
    const classic = await renderDocx(resume({ sections: [experience(entry)] }));
    assert.ok(classic.texts.some((t) => t.startsWith('Acme\t') && t.includes('\nLead')), classic.texts.join(' | '));
  });

  it('references print phone and relationship', async () => {
    const doc = await renderDocx(resume({ sections: [section('references', [{ name: 'Jane', jobTitle: 'CTO', company: 'Acme', relationship: 'Manager', email: 'jane@acme.com', phone: '+1 555 0101' }])] }));
    for (const s of ['Jane', 'CTO, Acme', 'Manager', 'jane@acme.com', '+1 555 0101']) assert.ok(has(doc, s), s);
  });
});
