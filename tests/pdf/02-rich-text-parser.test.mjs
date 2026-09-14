// The shared rich-text parser, on the HTML each browser and each paste source really produces.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichText, hasRichText, sanitizeRichText, safeHref, decodeEntities } from '../../src/utils/richText.js';

const NBSP = '\u00a0';
const text = (block) => block.runs.map((r) => r.text).join('');
const texts = (html) => parseRichText(html).map(text);

describe('lines and paragraphs', () => {
  it('Chrome: a new line is a <div> — every line is its own block (FIDA-27)', () => {
    assert.deepEqual(texts('First line<div>Second line</div><div>Third line</div>'), ['First line', 'Second line', 'Third line']);
  });
  it('Firefox: <br> breaks the line inside one block; a trailing <br> adds nothing', () => {
    assert.deepEqual(texts('a<br>b<br>'), ['a\nb']);
    assert.deepEqual(texts('<p>text<br></p>'), ['text']);
  });
  it('an empty line keeps its height: <div><br></div>, <p><br></p>, <p>&nbsp;</p> (FIDB-78)', () => {
    assert.deepEqual(texts('<p>one</p><p><br></p><p>three</p>'), ['one', NBSP, 'three']);
    assert.deepEqual(texts('one<div><br></div><div>three</div>'), ['one', NBSP, 'three']);
    assert.deepEqual(texts('<p>one</p><p>&nbsp;</p><p>three</p>'), ['one', NBSP, 'three']);
    assert.deepEqual(texts('a<br><br>b'), [`a\n${NBSP}\nb`]);
  });
  it('an empty element prints nothing', () => {
    assert.deepEqual(texts('<p></p><div></div><p>x</p>'), ['x']);
  });
  it('collapses whitespace like a browser, but keeps &nbsp;', () => {
    assert.deepEqual(texts('<p>  a \n\t b  </p>'), ['a b']);
    assert.deepEqual(texts('<p>a&nbsp;&nbsp;b</p>'), [`a${NBSP}${NBSP}b`]);
    assert.deepEqual(texts('<p><b>a</b> <i>b</i></p>'), ['a b']);
  });
});

describe('pasted content', () => {
  const googleDocs = '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1">'
    + '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">'
    + '<span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-weight:400;font-style:normal;">Plain </span>'
    + '<span style="font-size:11pt;color:#000000;background-color:transparent;font-weight:700;">Bold</span></p></b>';
  it('Google Docs: the <b style="font-weight:normal"> wrapper is not bold; font-weight:700 is', () => {
    const [block] = parseRichText(googleDocs);
    assert.deepEqual(block.runs.map((r) => [r.text, r.bold]), [['Plain ', false], ['Bold', true]]);
  });
  it('colours and backgrounds are dropped — pasted text can never turn invisible (FIDA-30)', () => {
    for (const run of parseRichText(googleDocs)[0].runs) assert.equal(run.color, undefined);
    const [white] = parseRichText('<span style="color:#fff;background-color:#000">White on black</span>');
    assert.deepEqual(Object.keys(white.runs[0]).sort(), ['bold', 'href', 'italic', 'strike', 'text', 'underline']);
  });
  it('Word: <o:p>, conditional comments, <style> and <xml> are ignored', () => {
    const word = '<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]--><style>p.MsoNormal{margin:0}</style>'
      + '<p class=MsoNormal>Text<o:p></o:p></p><p class=MsoNormal><o:p>&nbsp;</o:p></p>';
    assert.deepEqual(texts(word), ['Text', NBSP]);
  });
  it('script, style and comments never print', () => {
    assert.deepEqual(texts('<style>p{}</style><!-- note --><p>ok</p><script>alert(1)</script>'), ['ok']);
  });
});

describe('inline formatting', () => {
  it('nested marks combine (FIDA-29 / FIDB-77)', () => {
    const [b] = parseRichText('<p><strong><em>both</em></strong> <em>it <strong>bold-in-it</strong></em> <u><b>ub</b></u></p>');
    const run = (t) => b.runs.find((r) => r.text === t);
    assert.ok(run('both').bold && run('both').italic);
    assert.ok(run('bold-in-it').bold && run('bold-in-it').italic);
    assert.ok(run('ub').bold && run('ub').underline);
  });
  it('style-based formatting: font-weight, font-style, text-decoration', () => {
    const [b] = parseRichText('<span style="font-weight: bold">B</span><span style="font-style: italic">I</span><span style="text-decoration: line-through">S</span>');
    assert.deepEqual(b.runs.map((r) => [r.text, r.bold, r.italic, r.strike]), [['B', true, false, false], ['I', false, true, false], ['S', false, false, true]]);
  });
  it('links keep their target', () => {
    const [b] = parseRichText('<p>See <a href="https://example.com/x">my project</a>.</p>');
    assert.deepEqual(b.runs.map((r) => [r.text, r.href]), [['See ', null], ['my project', 'https://example.com/x'], ['.', null]]);
  });
  it('entities: named, decimal, hex', () => {
    assert.equal(decodeEntities('&amp;&lt;&gt;&quot;&#39;&#8377;&#x20B9;&rarr;&copy;'), '&<>"\'₹₹→©');
    assert.equal(decodeEntities('&unknown; &#0;'), '&unknown; \ufffd');
  });
});

describe('lists (FIDA-31)', () => {
  it('lists with attributes still list', () => {
    const blocks = parseRichText('<ul class="list" style="margin:0"><li class="x">Alpha</li><li>Beta</li></ul>');
    assert.deepEqual(blocks.map((b) => [b.marker, text(b), b.indent]), [['•', 'Alpha', 1], ['•', 'Beta', 1]]);
  });
  it('ordered lists count from start, honour value and type', () => {
    assert.deepEqual(parseRichText('<ol start="3"><li>c</li><li>d</li></ol>').map((b) => b.marker), ['3.', '4.']);
    assert.deepEqual(parseRichText('<ol><li>a</li><li value="7">g</li><li>h</li></ol>').map((b) => b.marker), ['1.', '7.', '8.']);
    assert.deepEqual(parseRichText('<ol type="a"><li>x</li><li>y</li></ol>').map((b) => b.marker), ['a.', 'b.']);
    assert.deepEqual(parseRichText('<ol type="I"><li>x</li><li>y</li><li>z</li><li>w</li></ol>').map((b) => b.marker), ['I.', 'II.', 'III.', 'IV.']);
  });
  it('nested lists nest; the parent keeps its text and the sibling keeps its bullet', () => {
    const blocks = parseRichText('<ul><li>Parent<ul><li>Child</li></ul></li><li>Sibling</li></ul>');
    assert.deepEqual(blocks.map((b) => [b.marker, text(b), b.indent]), [['•', 'Parent', 1], ['–', 'Child', 2], ['•', 'Sibling', 1]]);
  });
  it('Google Docs list items wrap their text in <p>; the marker goes on the first paragraph', () => {
    const blocks = parseRichText('<ul><li dir="ltr"><p dir="ltr"><span>One</span></p></li><li><p>Two</p><p>more</p></li></ul>');
    assert.deepEqual(blocks.map((b) => [b.marker, text(b), b.indent]), [['•', 'One', 1], ['•', 'Two', 1], [null, 'more', 1]]);
  });
  it('unclosed <li> and <p> close themselves', () => {
    assert.deepEqual(texts('<ul><li>a<li>b</ul><p>c<p>d'), ['a', 'b', 'c', 'd']);
  });
});

describe('alignment (FIDA-28)', () => {
  it('reads text-align and align, inherited by nested blocks', () => {
    const blocks = parseRichText('<p>left</p><div style="text-align: center;">centered</div><p style="text-align:right">right</p><div align="justify"><p>inherited</p></div><center>old</center>');
    assert.deepEqual(blocks.map((b) => [text(b), b.align]), [['left', null], ['centered', 'center'], ['right', 'right'], ['inherited', 'justify'], ['old', 'center']]);
  });
});

describe('hasRichText', () => {
  it('is false for markup that prints nothing', () => {
    for (const html of ['', null, '<p></p>', '<p><br></p>', '<p>&nbsp;</p>', '<div> </div>']) assert.equal(hasRichText(html), false, String(html));
    assert.equal(hasRichText('<p>x</p>'), true);
  });
});

describe('safeHref', () => {
  it('allows http(s), mailto and tel; completes bare domains and e-mail addresses', () => {
    assert.equal(safeHref('https://example.com'), 'https://example.com');
    assert.equal(safeHref('github.com/me'), 'https://github.com/me');
    assert.equal(safeHref('www.linkedin.com/in/me'), 'https://www.linkedin.com/in/me');
    assert.equal(safeHref('me@example.com'), 'mailto:me@example.com');
    assert.equal(safeHref('mailto:me@example.com'), 'mailto:me@example.com');
    assert.equal(safeHref('tel:+15550100'), 'tel:+15550100');
  });
  it('refuses script and data URLs and non-links', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'just words', '', null]) {
      assert.equal(safeHref(bad), null, String(bad));
    }
  });
});

describe('sanitizeRichText', () => {
  it('strips scripts, handlers, styles and unsafe links', () => {
    const dirty = '<img src=x onerror="alert(1)"><p onclick="steal()" style="color:red">Hi <a href="javascript:alert(1)">there</a></p><script>alert(2)</script>';
    assert.equal(sanitizeRichText(dirty), '<p>Hi there</p>');
  });
  it('keeps the formatting the editor offers', () => {
    const html = '<p style="text-align: center;"><strong>B</strong> <em>I</em> <u>U</u> <a href="https://x.dev">L</a></p>'
      + '<ul><li>one<ol start="2"><li>two</li></ol></li><li>three</li></ul><p><br></p><p>a<br>b</p>';
    const clean = sanitizeRichText(html);
    assert.equal(clean, '<p style="text-align: center;"><strong>B</strong> <em>I</em> <u>U</u> <a href="https://x.dev">L</a></p>'
      + '<ul><li>one<ol start="2"><li>two</li></ol></li><li>three</li></ul><p><br></p><p>a<br>b</p>');
  });
  it('is idempotent', () => {
    for (const html of ['First<div>Second</div>', '<ul><li><p>a</p><p>b</p></li></ul>', '<ol type="a"><li>x</li></ol><p>&nbsp;</p>']) {
      const once = sanitizeRichText(html);
      assert.equal(sanitizeRichText(once), once, html);
    }
  });
});
