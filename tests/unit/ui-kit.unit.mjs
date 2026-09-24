// The workspace kit's components (src/components/ui) and the shell's header and sidebar, rendered
// on the server (react-dom/server) and read as markup: every control is named, says its state in
// ARIA and not only in colour, and a keyboard can reach it. Overlays render in a portal, which the
// server never draws — their behaviour is tests/unit/ui-overlays.unit.mjs.
// Run: node --test tests/unit/ui-kit.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// JSX and the `@/` alias through Vite's SSR loader, as tests/unit/ui-shell.unit.mjs does.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let vite;
let ui;
let shell;
let menuList;
let multiSelect;
before(async () => {
  vite = await createServer({
    root: ROOT, configFile: `${ROOT}vite.config.js`, appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  ui = await vite.ssrLoadModule('/src/components/ui/index.js');
  shell = await vite.ssrLoadModule('/src/components/shell/index.js');
  menuList = await vite.ssrLoadModule('/src/components/ui/MenuList.jsx');
  multiSelect = await vite.ssrLoadModule('/src/components/ui/MultiSelectPopover.jsx');
});
after(() => vite?.close());

/** `element` rendered at `path` inside a router (Link, NavLink and useLocation need one). */
const html = (element, path = '/jobs') => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, element));
/** Every opening tag of `tag` in `markup` that holds `needle`. */
const tags = (markup, tag) => markup.match(new RegExp(`<${tag}\\b[^>]*>`, 'g')) ?? [];
const Icon = (props) => h('svg', { 'data-icon': 'x', ...props });

describe('Button and IconButton', () => {
  it('a Button is type="button" by default, so it never submits a form by accident', () => {
    assert.match(html(h(ui.Button, null, 'Save')), /<button type="button"[^>]*>.*Save/);
    assert.match(html(h(ui.Button, { type: 'submit', variant: 'primary' }, 'Save')), /type="submit"/);
  });

  it('loading disables it and says so (aria-busy), with a spinner instead of the icon', () => {
    const out = html(h(ui.Button, { loading: true, leftIcon: Icon }, 'Saving'));
    assert.match(out, /disabled=""/);
    assert.match(out, /aria-busy="true"/);
    assert.match(out, /animate-spin/);
    assert.doesNotMatch(out, /data-icon/);
  });

  it('`to` renders a link that looks the same; a disabled one leaves the Tab order', () => {
    const link = html(h(ui.Button, { to: '/jobs/new', variant: 'primary' }, 'Add job'));
    assert.match(link, /<a [^>]*href="\/jobs\/new"/);
    const off = tags(html(h(ui.Button, { to: '/jobs/new', disabled: true }, 'Add job')), 'a')[0];
    assert.match(off, /aria-disabled="true"/);
    assert.match(off, /tabindex="-1"/);
  });

  it('every interactive kit control wears the focus ring', () => {
    for (const out of [html(h(ui.Button, null, 'A')), html(h(ui.IconButton, { icon: Icon, label: 'More' }))]) {
      assert.match(out, /focus-visible:ring-2/);
      assert.match(out, /focus-visible:ring-indigo-500\/60/);
    }
  });

  it('an IconButton is named by its label; `pressed` makes it a toggle', () => {
    const out = html(h(ui.IconButton, { icon: Icon, label: 'Collapse sidebar' }));
    assert.match(out, /aria-label="Collapse sidebar"/);
    assert.match(out, /aria-hidden="true"/, 'the icon itself is hidden from screen readers');
    assert.match(html(h(ui.IconButton, { icon: Icon, label: 'Star', pressed: true })), /aria-pressed="true"/);
    assert.match(html(h(ui.IconButton, { icon: Icon, label: 'Star', pressed: false })), /aria-pressed="false"/);
  });
});

describe('fields', () => {
  it('TextField: the label names the input; an error turns it invalid and is read with it', () => {
    const out = html(h(ui.TextField, { id: 'company', label: 'Company', hint: 'As on the posting', required: true }));
    assert.match(out, /<label for="company"/);
    assert.match(out, /<input[^>]*id="company"[^>]*aria-describedby="company-hint"/);
    assert.match(out, /id="company-hint"[^>]*>As on the posting/);
    const bad = html(h(ui.TextField, { id: 'company', label: 'Company', error: 'Required' }));
    assert.match(bad, /aria-invalid="true"/);
    assert.match(bad, /aria-describedby="company-error"/);
    assert.match(bad, /<p id="company-error" role="alert"/);
  });

  it('TextArea and Select take the same label, hint and error', () => {
    const area = html(h(ui.TextArea, { id: 'notes', label: 'Notes', error: 'Too long' }));
    assert.match(area, /<label for="notes"/);
    assert.match(area, /<textarea[^>]*aria-invalid="true"/);
    const select = html(h(ui.Select, {
      id: 'stage', label: 'Stage', placeholder: 'Choose…', value: '', onChange: () => {},
      options: [{ value: 'applied', label: 'Applied' }, { label: 'Closed', options: [{ value: 'rejected', label: 'Rejected' }] }],
    }));
    assert.match(select, /<label for="stage"/);
    assert.match(select, /<option value="" disabled="" selected="">Choose…<\/option>/);
    assert.match(select, /<optgroup label="Closed"><option value="rejected">Rejected<\/option><\/optgroup>/);
  });

  it('SearchInput is a named search box; its hotkey shows as a key cap while empty', () => {
    const out = html(h(ui.SearchInput, { value: '', onChange: () => {}, placeholder: 'Search jobs', hotkey: '/' }));
    assert.match(out, /type="search"/);
    assert.match(out, /aria-label="Search jobs"/);
    assert.match(out, /<kbd[^>]*>\/<\/kbd>/);
    const filled = html(h(ui.SearchInput, { value: 'goo', onChange: () => {} }));
    assert.match(filled, /aria-label="Clear search"/);
  });

  it('InlineEdit shows its value as a button that says what it edits', () => {
    const out = html(h(ui.InlineEdit, { value: 'Life admin', label: 'Project name', onCommit: () => {} }));
    assert.match(out, /<button type="button"[^>]*>Life admin<span class="sr-only">, edit Project name<\/span><\/button>/);
    assert.match(html(h(ui.InlineEdit, { value: '  ', placeholder: 'Add a title', onCommit: () => {} })), /text-slate-400[^>]*>Add a title/);
  });
});

describe('Tabs, SegmentedControl, NavTabs: roving tabindex', () => {
  const items = [{ value: 'board', label: 'Board' }, { value: 'table', label: 'Table' }, { value: 'x', label: 'Off', disabled: true }];

  it('Tabs: tablist / tab / tabpanel tied by ids; only the selected tab is in the Tab order', () => {
    const out = html(h('div', null,
      h(ui.Tabs, { id: 'jt', items, value: 'table', onChange: () => {}, 'aria-label': 'View' }),
      h(ui.TabPanel, { tabsId: 'jt', value: 'table', current: 'table' }, 'TABLE')));
    assert.match(out, /role="tablist" aria-label="View"/);
    const tabs = tags(out, 'button');
    assert.equal(tabs.length, 3);
    assert.match(tabs[0], /aria-selected="false"[^>]*tabindex="-1"/);
    assert.match(tabs[1], /id="jt-tab-table"[^>]*role="tab" aria-selected="true" aria-controls="jt-panel-table" tabindex="0"/);
    assert.match(tabs[2], /disabled=""/);
    assert.match(out, /role="tabpanel" id="jt-panel-table" aria-labelledby="jt-tab-table"/);
  });

  it('Tabs: a value that matches no tab still leaves the first enabled tab reachable', () => {
    const tabs = tags(html(h(ui.Tabs, { id: 't', items, value: 'gone', onChange: () => {} })), 'button');
    assert.match(tabs[0], /tabindex="0"/);
    assert.match(tabs[1], /tabindex="-1"/);
  });

  it('SegmentedControl: a radio group, checked by aria-checked, one Tab stop', () => {
    const out = html(h(ui.SegmentedControl, { value: 'table', onChange: () => {}, options: items.slice(0, 2), 'aria-label': 'View' }));
    assert.match(out, /role="radiogroup" aria-label="View"/);
    const radios = tags(out, 'button');
    assert.match(radios[0], /role="radio" aria-checked="false"[^>]*tabindex="-1"/);
    assert.match(radios[1], /role="radio" aria-checked="true"[^>]*tabindex="0"/);
    const none = tags(html(h(ui.SegmentedControl, { value: null, onChange: () => {}, options: items.slice(0, 2) })), 'button');
    assert.match(none[0], /tabindex="0"/);
  });

  it('SegmentedControl iconOnly: each option is named by its label', () => {
    const out = html(h(ui.SegmentedControl, { value: 'board', onChange: () => {}, iconOnly: true, options: [{ value: 'board', label: 'Board view', icon: Icon }] }));
    assert.match(out, /aria-label="Board view"/);
  });

  it('NavTabs: links, the current one aria-current="page"; `end` keeps Board unselected on Settings', () => {
    const navItems = [{ to: '/boards/b1', label: 'Board', end: true }, { to: '/boards/b1/settings', label: 'Settings' }];
    const out = html(h(ui.NavTabs, { items: navItems, 'aria-label': 'Project views' }), '/boards/b1/settings');
    const links = tags(out, 'a');
    assert.doesNotMatch(links[0], /aria-current/);
    assert.match(links[1], /aria-current="page"/);
  });
});

describe('small pieces', () => {
  it('Badge and Chip: colour is never the only signal — the text is there; a removable chip names what it removes', () => {
    assert.match(html(h(ui.Badge, { tone: 'success', dot: '#22c55e' }, 'Offer')), /Offer/);
    assert.match(html(h(ui.Chip, { onRemove: () => {} }, 'Design')), /aria-label="Remove Design"/);
    assert.match(html(h(ui.Chip, { onClick: () => {}, pressed: true }, 'Overdue')), /<button type="button" aria-pressed="true"/);
  });

  it('Avatar: an image named by the person, initials drawn, never under 11 px text', () => {
    const out = html(h(ui.Avatar, { name: 'Sarah Kim', size: 'xs' }));
    assert.match(out, /role="img" aria-label="Sarah Kim"/);
    assert.match(out, />SK</);
    assert.doesNotMatch(out, /text-\[(9|10)px\]/);
    assert.match(html(h(ui.Avatar, { name: 'Google', decorative: true })), /aria-hidden="true"/);
  });

  it('Kbd: glyph caps for the eye, words for the screen reader', () => {
    const out = html(h(ui.Kbd, { combo: 'mod+k' }));
    assert.match(out, /<kbd aria-hidden="true"/);
    assert.match(out, /<span class="sr-only">Ctrl K<\/span>/);
    assert.match(html(h(ui.Kbd, null, 'Esc')), /<kbd[^>]*>Esc<\/kbd>/);
  });

  it('ProgressBar: a named progressbar with its numbers', () => {
    const out = html(h(ui.ProgressBar, { value: 2, max: 5, label: 'Checklist', valueText: '2 of 5 done' }));
    assert.match(out, /role="progressbar" aria-label="Checklist" aria-valuemin="0" aria-valuemax="5" aria-valuenow="2" aria-valuetext="2 of 5 done"/);
    assert.match(out, /width:40%/);
    assert.match(html(h(ui.ProgressBar, { value: 9, max: 5 })), /aria-valuenow="5"/, 'clamped to max');
  });

  it('DatePill: words, tone and the full day read aloud; nothing for no day', () => {
    const now = new Date(2026, 8, 24, 10);
    const late = html(h(ui.DatePill, { value: '2026-09-20', now }));
    assert.match(late, /4d overdue/);
    assert.match(late, /bg-red-50/);
    assert.match(late, /<span class="sr-only">Sun, Sep 20, 2026 · overdue by 4 days<\/span>/);
    assert.match(html(h(ui.DatePill, { value: '2026-09-24', now, prefix: 'Due' })), /Due today/);
    assert.equal(html(h(ui.DatePill, { value: '', now })), '');
    const editable = html(h(ui.DatePill, { value: '', now, onChange: () => {}, label: 'Due date' }));
    assert.match(editable, /aria-label="Due date: not set. Change"/);
    assert.match(editable, /Set date/);
  });

  it('EmptyState and Skeleton: a heading and actions; skeletons hidden from screen readers', () => {
    const out = html(h(ui.EmptyState, { icon: Icon, title: 'No jobs yet', description: 'Add one.', action: h(ui.Button, null, 'Add job') }));
    assert.match(out, /<h3[^>]*>No jobs yet<\/h3>/);
    assert.match(out, /Add job/);
    assert.match(html(h(ui.Skeleton, { lines: 3 })), /^<div aria-hidden="true"/);
  });

  it('Menu and Popover triggers announce what they open, closed at first', () => {
    const menu = html(h(ui.Menu, { trigger: h(ui.IconButton, { icon: Icon, label: 'More' }), items: [{ label: 'Delete', danger: true }] }));
    assert.match(menu, /aria-haspopup="menu"/);
    assert.match(menu, /aria-expanded="false"/);
    const pop = html(h(ui.Popover, { trigger: h(ui.Button, null, 'Labels') }, 'panel'));
    assert.match(pop, /aria-haspopup="dialog"/);
    assert.match(pop, /aria-expanded="false"/);
  });
});

describe('menu and picker logic', () => {
  const items = [
    { label: 'Edit' }, { type: 'separator' }, { label: 'Duplicate', disabled: true },
    { type: 'label', label: 'Move' }, { label: 'Done' }, { label: 'Delete', danger: true },
  ];

  it('nextEnabled skips separators, labels and disabled items, and wraps', () => {
    const { nextEnabled } = menuList;
    assert.equal(nextEnabled(items, 0, 1), 4);
    assert.equal(nextEnabled(items, 5, 1), 0);
    assert.equal(nextEnabled(items, 0, -1), 5);
    assert.equal(nextEnabled(items, -1, 1), 0, 'Home');
    assert.equal(nextEnabled(items, items.length, -1), 5, 'End');
    assert.equal(nextEnabled([{ label: 'x', disabled: true }], 0, 1), 0, 'nothing enabled: stays');
  });

  it('typeaheadMatch finds the next enabled item starting with the typed letters', () => {
    const { typeaheadMatch } = menuList;
    assert.equal(typeaheadMatch(items, 0, 'd'), 4, 'Duplicate is disabled');
    assert.equal(typeaheadMatch(items, 4, 'd'), 5);
    assert.equal(typeaheadMatch(items, 5, 'de'), 5);
    assert.equal(typeaheadMatch(items, 0, 'zz'), -1);
  });

  it('filterOptions and canCreate: case-blind search; "Create" only for a new name', () => {
    const { filterOptions, canCreate } = multiSelect;
    const options = [{ value: 'a', label: 'Frontend' }, { value: 'b', label: 'Backend' }, { value: 'c', label: 'Design' }];
    assert.deepEqual(filterOptions(options, 'END').map((o) => o.value), ['a', 'b']);
    assert.equal(filterOptions(options, '  ').length, 3);
    assert.ok(canCreate(options, 'Research'));
    assert.ok(!canCreate(options, ' design '));
    assert.ok(!canCreate(options, '   '));
  });
});

describe('shell: PageHeader and the sidebar', () => {
  it('PageHeader: an h1, breadcrumbs whose last crumb is the page, actions and tabs', () => {
    const out = html(h(shell.PageHeader, {
      title: 'Life admin', subtitle: 'LIFE · Kanban',
      breadcrumbs: [{ label: 'Projects', to: '/boards' }, { label: 'Life admin' }],
      actions: h(ui.Button, { variant: 'primary' }, 'Create'),
      tabs: h('div', { 'data-tabs': '' }),
    }));
    assert.match(out, /<h1[^>]*>Life admin<\/h1>/);
    assert.match(out, /<nav aria-label="Breadcrumb"/);
    assert.match(out, /<a [^>]*href="\/boards"[^>]*>Projects<\/a>/);
    assert.match(out, /aria-current="page">Life admin<\/span>/);
    assert.match(out, /Create/);
    assert.match(out, /data-tabs/);
    assert.doesNotMatch(out, /Open navigation/, 'outside the shell there is no drawer to open');
  });

  it('PageHeader with onTitleChange: the title is an InlineEdit', () => {
    const out = html(h(shell.PageHeader, { title: 'Life admin', onTitleChange: () => {}, titleLabel: 'Project name' }));
    assert.match(out, /<h1[^>]*><button type="button"[^>]*>Life admin<span class="sr-only">, edit Project name/);
  });

  it('the sidebar marks the current section aria-current="page" and lists starred projects first', () => {
    const projects = [
      { id: 'p1', name: 'Website', key: 'WEB', color: '#0ea5e9', starred: false, updatedAt: 9 },
      { id: 'p2', name: 'Life admin', key: 'LIFE', color: '#10b981', starred: true, updatedAt: 1 },
    ];
    const out = html(h(shell.SidebarContent, { projects }), '/jobs/j1');
    const current = tags(out, 'a').filter((a) => /aria-current="page"/.test(a));
    assert.equal(current.length, 1);
    assert.match(current[0], /href="\/jobs"/);
    assert.ok(out.indexOf('Life admin') < out.indexOf('Website'), 'starred first');
    assert.match(out, /<nav aria-label="Workspace"/);
    for (const label of ['Résumés', 'Job Tracker', 'Boards', 'Your work', 'New project']) assert.match(out, new RegExp(label));
    assert.match(out, /href="\/boards\?create=1"/);
  });

  it('on a project page the project, not "Boards", is the current item', () => {
    const projects = [{ id: 'p2', name: 'Life admin', key: 'LIFE', color: null, starred: false, updatedAt: 0 }];
    const out = html(h(shell.SidebarContent, { projects }), '/boards/p2/settings');
    const current = tags(out, 'a').filter((a) => /aria-current="page"/.test(a));
    assert.equal(current.length, 1);
    assert.match(current[0], /href="\/boards\/p2"/);
  });

  it('the collapsed rail names each icon (aria-label), and the toggle says what it does', () => {
    const out = html(h(shell.SidebarContent, { projects: [{ id: 'p', name: 'Life', key: 'LIFE', color: null, starred: false, updatedAt: 0 }], collapsed: true, onToggleCollapsed: () => {} }));
    for (const label of ['Résumés', 'Job Tracker', 'Boards', 'Your work', 'Life · LIFE', 'New project']) {
      assert.match(out, new RegExp(`aria-label="${label}"`));
    }
    assert.match(out, /aria-label="Expand sidebar"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*aria-label="Expand sidebar"/);
  });
});
