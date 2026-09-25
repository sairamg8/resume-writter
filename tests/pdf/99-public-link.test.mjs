// R2-148: Share a public link. A signed-in account publishes a read-only copy of one résumé at
// `#/r/<shareId>` (src/utils/publicLink.js, src/components/ShareLinkModal.jsx), sees exactly what is
// public before and after, updates it and unpublishes it; the page at that link
// (src/pages/PublicResume.jsx) prints the copy as the PDF preview does and offers the PDF. The copy
// holds what the PDF prints and nothing else — no hidden field's value, hidden section or entry,
// cover letter or dashboard name. Anyone reads a copy by its id; nobody lists them, and only the
// account that owns one writes it (firestore.rules, applied by tests/pdf/fake-firestore.mjs).
// Without Firebase configured nothing offers it, and the link's page says so.
// Fictional data only. Mounted with react-dom/client over tests/pdf/fake-dom.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MemoryStorage, settle } from './resume-tab.mjs';
import { setupPreview, teardownPreview } from './preview-stub.mjs';
import { resume, section, experience, render, read, allText, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { fakeFirestore } from './fake-firestore.mjs';

let link;
let ShareLinkModal;
let firebasePublicIo;
let PublicResume;
let ExportDropdown;
let PrivacyPage;
let setPdfjs;
before(async () => {
  await setupPreview();
  link = await loadModule('/src/utils/publicLink.js');
  ({ default: ShareLinkModal, firebasePublicIo } = await loadModule('/src/components/ShareLinkModal.jsx'));
  ({ PublicResume } = await loadModule('/src/pages/PublicResume.jsx'));
  ({ ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx'));
  PrivacyPage = (await loadModule('/src/pages/PrivacyPage.jsx')).default;
  setPdfjs = (await loadModule('/src/components/PdfPreview.jsx'))._setPdfjsForTest;
}, { timeout: 60_000 });
after(teardownPreview);

const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };
/** Waits, up to 30 s, for `done()`. */
const until = async (done) => { for (const end = Date.now() + 30_000; !done() && Date.now() < end;) await new Promise((r) => { setTimeout(r, 10); }); };
const buttonNamed = (view, name) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === name);
const click = (view, el) => view.act(() => reactProps(el).onClick({ preventDefault() {}, stopPropagation() {} }));

/** A fictional résumé with a hidden phone, a hidden job's location, a hidden entry, a hidden section and a letter. */
function sample() {
  const r = resume({
    personal: {
      name: 'Jordan Ellery', title: 'Product Designer', email: 'jordan.ellery@example.org', phone: '+1 555 0199',
      location: 'Halifax, NS', summary: '<p>Designer of calm, useful software.</p>', hiddenFields: ['phone'],
    },
    sections: [
      experience([
        { company: 'Fabrikam Studio', role: 'Lead Designer', location: 'Secret Town', startDate: 'Jan 2020', endDate: 'Mar 2024', hiddenFields: ['location'] },
        { company: 'Hidden Employer Ltd', role: 'Intern', startDate: 'Jun 2018', endDate: 'Aug 2018', visible: false },
      ]),
      section('education', [{ institution: 'Invisible College', degree: 'B.A.' }], {}, { visible: false }),
      section('skills', [{ category: 'Design', skills: 'Figma, Prototyping' }]),
    ],
    coverLetter: { body: '<p>Private letter to a hiring manager.</p>', recipientName: 'Casey Private' },
  });
  r.name = 'My private dashboard label';
  return r;
}

describe('the published copy holds what the PDF prints, and nothing else', () => {
  it('no hidden value, hidden section or entry, cover letter, dashboard name or id', () => {
    const copy = link.publicSnapshot(sample());
    const json = JSON.stringify(copy);
    for (const secret of ['+1 555 0199', 'Secret Town', 'Hidden Employer', 'Invisible College', 'Private letter', 'Casey Private', 'My private dashboard label']) {
      assert.ok(!json.includes(secret), `${secret} is not in the copy`);
    }
    assert.equal(copy.id, undefined);
    assert.equal(copy.coverLetter, undefined);
    assert.equal(copy.personal.name, 'Jordan Ellery');
    assert.deepEqual(copy.personal.hiddenFields, ['phone'], 'the field stays hidden, so it prints as before');
    assert.deepEqual(copy.sections.map((s) => s.type), ['experience', 'skills']);
    assert.deepEqual(copy.sections[0].items.map((i) => i.company), ['Fabrikam Studio']);
  });

  it('the summary lists exactly what is public', () => {
    assert.deepEqual(link.publicSummary(link.publicSnapshot(sample())), [
      'Name: Jordan Ellery', 'Job title: Product Designer', 'Email: jordan.ellery@example.org', 'Location: Halifax, NS',
      'Your summary', 'Professional Experience: 1 entry', 'Skills: 1 entry',
    ]);
  });

  it('a copy the server hands back with its keys in another order is still current; an edit is not', () => {
    const r = sample();
    const reorder = (v) => (Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorder(v[k])])) : v);
    assert.equal(link.publishedIsCurrent(reorder(link.publicSnapshot(r)), r), true);
    assert.equal(link.publishedIsCurrent(link.publicSnapshot(r), { ...r, personal: { ...r.personal, title: 'Art Director' } }), false);
  });

  it('the copy prints as the résumé does, without what was hidden', async () => {
    const r = sample();
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const printed = allText(await read(await render(r)));
    const published = allText(await read(await render(normalizeResume({ ...link.publicSnapshot(r), id: 'public_x', name: 'x' }))));
    assert.equal(published, printed);
    assert.doesNotMatch(published, /555 0199|Secret Town|Hidden Employer|Invisible College/);
  });
});

// Review of R2-148: what the PDF leaves out is not only what an eye hides. A hidden LinkedIn's
// "Link URL" and "Display label", a key of `personal` no template reads, a section's dates with its
// Show dates off, its locations with Show location off, and whether a job whose end date is hidden
// is current — none prints, so none may be in the copy.
describe('the copy leaves out what the PDF does not print beyond the eyes', () => {
  function more() {
    const r = resume({
      personal: {
        name: 'Jordan Ellery', title: 'Product Designer', email: 'jordan.ellery@example.org',
        linkedin: 'linkedin.com/in/jordan-hidden', linkedinUrl: 'https://www.linkedin.com/in/jordan-hidden-url/',
        linkedinLabel: 'Jordan on LinkedIn (hidden)', website: 'jordan.example.org', websiteLabel: 'Portfolio',
        websiteUrl: 'https://jordan.example.org/work', hiddenFields: ['linkedin'],
        birthday: '1990-02-14', homeAddress: '12 Private Lane',
      },
      sections: [
        experience([
          { company: 'Fabrikam Studio', role: 'Lead Designer', location: 'Quietville', startDate: 'Jan 2020', endDate: 'Mar 2024' },
        ], { showLocation: false }),
        experience([
          { company: 'Northwind', role: 'Designer', location: 'Shown City', startDate: 'Undisclosed 2012', endDate: 'Undisclosed 2015' },
        ], { showDates: false }),
        section('certifications', [{ name: 'Figma Pro', issuer: 'Figma', date: 'Secret May 2019', expiry: 'Secret May 2029' }], { showDates: false }),
        experience([{ company: 'Contoso', role: 'Intern', startDate: 'Jun 2010', endDate: '', current: true, hiddenFields: ['endDate'] }]),
        section('custom', [{ title: 'Talk', location: 'Custom Place', date: 'Oct 2021' }], { showLocation: false }),
      ],
    });
    return r;
  }

  it('no hidden link or label, unprinted personal key, date or location a section hides, or current flag behind a hidden end date', () => {
    const copy = link.publicSnapshot(more());
    const json = JSON.stringify(copy);
    for (const secret of ['jordan-hidden', 'Jordan on LinkedIn', '1990-02-14', '12 Private Lane', 'birthday', 'homeAddress',
      'Quietville', 'Undisclosed', 'Secret May']) {
      assert.ok(!json.includes(secret), `${secret} is not in the copy`);
    }
    assert.equal(copy.personal.websiteLabel, 'Portfolio', 'a shown link keeps its label');
    assert.equal(copy.personal.websiteUrl, 'https://jordan.example.org/work', 'and its link');
    assert.equal(copy.sections[1].items[0].location, 'Shown City', 'Show dates off hides only the dates');
    assert.equal(copy.sections[3].items[0].current, false, 'a hidden end date hides that the job is current');
    assert.equal(copy.sections[4].items[0].location, 'Custom Place', 'a custom section prints its location always');
  });

  it('and it still prints exactly as the résumé does', async () => {
    const r = more();
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const printed = allText(await read(await render(r)));
    const published = allText(await read(await render(normalizeResume({ ...link.publicSnapshot(r), id: 'public_x', name: 'x' }))));
    assert.equal(published, printed);
    assert.match(published, /Portfolio/);
    assert.match(published, /Custom Place/);
  });
});

describe('deleting a résumé takes its public copy down', () => {
  it('publicIo.unpublishResume removes the copy and the record; with none it does nothing', async () => {
    const cloud = fakeFirestore();
    cloud.auth = 'uid_owner';
    const io = link.publicIo(cloud.fs, cloud.db);
    const r = sample();
    const { shareId } = await io.publish('uid_owner', r);
    assert.equal(await io.unpublishResume('uid_owner', r.id), true);
    assert.equal(cloud.doc(`public/${shareId}`), undefined);
    assert.equal(cloud.doc(`users/uid_owner/shares/${r.id}`), undefined);
    assert.equal(await io.unpublishResume('uid_owner', r.id), false, 'nothing published: nothing to do');
  });

  it("the Dashboard's Delete, signed in, unpublishes it: the link no longer opens", async () => {
    const cloud = fakeFirestore();
    cloud.auth = 'uid_owner';
    const io = link.publicIo(cloud.fs, cloud.db);
    const r = Object.assign(sample(), { name: 'Shared CV' });
    const other = Object.assign(resume({ personal: { name: 'Riley Other' } }), { name: 'Other CV' });
    const { shareId } = await io.publish('uid_owner', r);

    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
    globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r, other], activeId: r.id })]]);
    const savedConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    const auth = { user: { uid: 'uid_owner', email: 'owner@example.com' }, authLoading: false, cloudAvailable: true, signInWithGoogle: () => {}, signOut: () => {} };
    const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
    function Page() {
      const store = useAppStore();
      return createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Dashboard, { store, auth, sync, publicLinks: io }));
    }
    const view = mount(Page, {});
    try {
      await settle();
      const card = [...elements(view.container)].find((el) => el.tagName === 'DIV' && el.className.startsWith('group bg-white rounded-2xl')
        && el.textContent.includes('Shared CV'));
      assert.ok(card, 'the card of the shared résumé');
      const del = [...elements(card)].find((el) => el.tagName === 'BUTTON'
        && [el.textContent.trim(), el.getAttribute('title'), el.getAttribute('aria-label')].includes('Delete'));
      click(view, del);
      await until(() => cloud.doc(`public/${shareId}`) === undefined);
      assert.equal(cloud.doc(`public/${shareId}`), undefined, 'the copy is gone');
      assert.equal(cloud.doc(`users/uid_owner/shares/${r.id}`), undefined);
      cloud.auth = null;
      assert.equal(await io.readPublic(shareId), null, 'the link finds nothing');
    } finally {
      await view.unmount();
      delete globalThis.localStorage;
      if (savedConfirm === undefined) delete globalThis.confirm; else globalThis.confirm = savedConfirm;
    }
  });
});

describe('the Firestore rules: anyone reads a copy by its id, only its owner writes it', () => {
  it('publish, read signed out, refused to another account, unpublish', async () => {
    const cloud = fakeFirestore();
    const io = link.publicIo(cloud.fs, cloud.db);
    cloud.auth = 'uid_owner';
    const r = sample();
    const { shareId } = await io.publish('uid_owner', r, { now: 1_700_000_000_000 });
    assert.match(shareId, /^[0-9a-f-]{20,}$/i, 'a link nobody can guess');
    assert.equal(cloud.doc(`public/${shareId}`).owner, 'uid_owner');
    assert.deepEqual(cloud.doc(`users/uid_owner/shares/${r.id}`), { shareId, publishedAt: 1_700_000_000_000 });

    cloud.auth = null;
    assert.equal((await io.readPublic(shareId)).personal.name, 'Jordan Ellery', 'signed out, the link opens');
    await assert.rejects(cloud.fs.getDocsFromServer(cloud.fs.collection(cloud.db, 'public')), /permission/i, 'nobody lists the copies');
    await assert.rejects(io.publish(null, r, { shareId }), /permission/i);

    cloud.auth = 'uid_other';
    await assert.rejects(io.publish('uid_other', { ...r, personal: { name: 'Mallory' } }, { shareId }), /permission/i, 'another account cannot overwrite it');
    await assert.rejects(io.unpublish('uid_other', r.id, shareId), /permission/i, 'nor take it down');
    await assert.rejects(io.readShare('uid_owner', r.id), /permission/i, "nor read the owner's list");
    assert.equal(cloud.doc(`public/${shareId}`).resume.personal.name, 'Jordan Ellery');

    cloud.auth = 'uid_owner';
    await io.unpublish('uid_owner', r.id, shareId);
    assert.equal(await io.readPublic(shareId), null);
    assert.equal(await io.readShare('uid_owner', r.id), null);
  });
});

describe('Share a public link', () => {
  it('shows what would be public, publishes, says when the résumé changed, updates, unpublishes', async () => {
    const cloud = fakeFirestore();
    cloud.auth = 'uid_owner';
    const io = link.publicIo(cloud.fs, cloud.db);
    const r = sample();
    const props = { isOpen: true, resume: r, uid: 'uid_owner', io, onClose: () => {} };
    const view = mount(ShareLinkModal, props);
    try {
      await until(() => buttonNamed(view, 'Publish'));
      const text = () => view.container.textContent;
      assert.match(text(), /What would be public:.*Name: Jordan Ellery.*Email: jordan\.ellery@example\.org/);
      assert.doesNotMatch(text(), /555 0199/);
      assert.match(text(), /Fields and sections you hid, the cover letter and this résumé's name in your list stay private/);

      click(view, buttonNamed(view, 'Publish'));
      await until(() => buttonNamed(view, 'Unpublish'));
      const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT');
      const url = reactProps(input).value;
      const shareId = decodeURIComponent(url.split('#/r/')[1]);
      assert.match(url, /#\/r\/[0-9a-f-]{20,}$/i);
      assert.match(text(), /This résumé is published.*What is public:.*Name: Jordan Ellery/);
      assert.equal(cloud.doc(`public/${shareId}`).resume.personal.email, 'jordan.ellery@example.org');
      assert.equal(buttonNamed(view, 'Update the public copy'), undefined, 'nothing to update yet');

      // Opened again later: the link it has, as the account holds it.
      view.update({ ...props, isOpen: false });
      view.update({ ...props });
      await until(() => buttonNamed(view, 'Unpublish'));
      assert.equal(reactProps([...elements(view.container)].find((el) => el.tagName === 'INPUT')).value, url);

      const edited = { ...r, personal: { ...r.personal, title: 'Principal Designer' } };
      view.update({ ...props, resume: edited });
      await flush();
      assert.match(text(), /You have changed the résumé since: the link still shows it as it was until you update it/);
      click(view, buttonNamed(view, 'Update the public copy'));
      await until(() => !buttonNamed(view, 'Update the public copy'));
      assert.equal(cloud.doc(`public/${shareId}`).resume.personal.title, 'Principal Designer', 'the same link, the new copy');

      click(view, buttonNamed(view, 'Unpublish'));
      await until(() => buttonNamed(view, 'Publish'));
      assert.equal(cloud.doc(`public/${shareId}`), undefined);
      assert.equal(cloud.doc(`users/uid_owner/shares/${r.id}`), undefined);
    } finally {
      await view.unmount();
    }
  });

  it('without Firebase configured nothing offers it', async () => {
    assert.equal(firebasePublicIo, null, 'this test build has no VITE_FIREBASE_* values');
    const labels = async (props) => {
      const view = mount(ExportDropdown, { onExportPDF() {}, onExportWord() {}, onExportJSON() {}, ...props });
      try {
        click(view, [...elements(view.container)].find((el) => el.tagName === 'BUTTON'));
        return [...elements(view.container)].filter((el) => el.tagName === 'BUTTON').map((el) => el.textContent.trim());
      } finally { await view.unmount(); }
    };
    assert.ok(!(await labels({})).some((l) => /public link/i.test(l)));
    let shared = 0;
    const view = mount(ExportDropdown, { onExportPDF() {}, onExportWord() {}, onExportJSON() {}, onShare: () => { shared += 1; } });
    try {
      click(view, [...elements(view.container)].find((el) => el.tagName === 'BUTTON'));
      click(view, buttonNamed(view, 'Share a public link…'));
      assert.equal(shared, 1);
    } finally { await view.unmount(); }
  });
});

describe('the page at the link', () => {
  /** PublicResume at `#/r/<shareId>`. */
  const at = (shareId, props) => mount(() => createElement(MemoryRouter, { initialEntries: [`/r/${shareId}`] },
    createElement(Routes, null, createElement(Route, { path: '/r/:shareId', element: createElement(PublicResume, props) }))));

  it('prints the published copy as the PDF preview does, with its PDF to download', async () => {
    // pdf.js reads the real PDF the page builds; only the painting is skipped (fake-dom has no canvas).
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    setPdfjs({
      worker: undefined,
      lib: {
        getDocument: ({ data }) => {
          const task = pdfjs.getDocument({ data, isEvalSupported: false, verbosity: 0 });
          return {
            promise: task.promise.then((doc) => ({
              numPages: doc.numPages,
              loadingTask: task,
              getPage: async (i) => {
                const page = await doc.getPage(i);
                return { view: page.view, getViewport: (o) => page.getViewport(o), getTextContent: () => page.getTextContent(), render: () => ({ promise: Promise.resolve() }) };
              },
            })),
          };
        },
      },
    });
    const cloud = fakeFirestore();
    cloud.auth = 'uid_owner';
    const io = link.publicIo(cloud.fs, cloud.db);
    const { shareId } = await io.publish('uid_owner', sample());
    cloud.auth = null;
    const view = at(shareId, { io });
    try {
      const printed = () => view.document.getElementById?.('resume-preview')?.textContent
        ?? [...elements(view.container)].find((el) => el.getAttribute?.('id') === 'resume-preview')?.textContent ?? '';
      await until(() => /Jordan Ellery/.test(printed()));
      assert.match(printed(), /Jordan Ellery.*Product Designer/);
      assert.match(printed(), /Fabrikam Studio/);
      assert.doesNotMatch(printed(), /555 0199|Hidden Employer|Invisible College/);
      assert.ok(buttonNamed(view, 'Download PDF'), 'the PDF to download');
    } finally {
      await view.unmount();
      setPdfjs(null);
    }
  });

  it('a link taken down says it is not published; a site without a cloud says it has no public links', async () => {
    const cloud = fakeFirestore();
    cloud.auth = null;
    const gone = at('no-such-id', { io: link.publicIo(cloud.fs, cloud.db) });
    try {
      await until(() => /not published/.test(gone.container.textContent));
      assert.match(gone.container.textContent, /This résumé is not published: its owner took it down, or the link is wrong\./);
    } finally { await gone.unmount(); }
    const off = at('any', { io: null });
    try {
      assert.match(off.container.textContent, /Public links are not available on this site\./);
    } finally { await off.unmount(); }
  });
});

it('the Privacy page says what a public link makes public, and that the rules let anyone read only that', () => {
  const markup = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/privacy'] }, createElement(PrivacyPage)));
  const page = markup.replace(/<\/?(strong|em|a|span)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  assert.match(page, /Public links: only when you choose Share a public link on a résumé, a read-only copy of that résumé — what its PDF prints[^.]*— is stored in Firestore under a random link, and anyone with the link can read it\./);
  assert.match(page, /Fields and sections you hid, the cover letter and the résumé's name in your list are not in it\. It stays public until you unpublish it\./);
  assert.match(page, /The one exception is a résumé you publish with a public link: anyone with that link can read its copy, and only you can change or unpublish it\./);
});
