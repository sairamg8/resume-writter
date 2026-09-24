import { setup, teardown, resume, experience, render, read, allItems, MM, TEMPLATES } from '../harness.mjs';
await setup();
const s = Array.from({ length: +process.argv[2] }, (_, i) => `Sentence mark${i + 1}z tells a reader about this person here now.`).join(' ');
for (const template of TEMPLATES) {
  for (const extra of [{}, { sidebarSingleColumn: true }]) {
    if (extra.sidebarSingleColumn && template !== 'sidebar') continue;
    const r = resume({ template, settings: { fontSizeBase: 12, lineHeightValue: 1.8, ...extra }, personal: { summary: `<p>${s}</p>` }, sections: [experience([{ description: '<p>Body text</p>' }])] });
    const pages = await read(await render(r));
    const items = allItems(pages);
    const seen = new Set();
    for (const t of items) for (const m of t.str.matchAll(/mark(\d+)z/g)) seen.add(+m[1]);
    const m = (r.settings.marginV ?? 14) * MM;
    const low = items.filter((t) => t.y < m - 3).map((t) => `${t.page}:${t.str.slice(0, 20)}@${t.y.toFixed(0)}`);
    console.log(template, JSON.stringify(extra), 'pages', pages.length, 'seen', seen.size, 'low', low.slice(0, 3));
  }
}
await teardown();
