// The old sanitizer wrote a link's address around every run of the link; the sanitizer writes it once around each
// run of runs that share it (tf-redos-richtext-links). The old output with adjacent anchors to one address joined
// into one is what the sanitizer writes now; the reference comparisons in the tf-redos tests go through this.
export function joinAnchors(html) {
  let out = '';
  let open = null;
  let closed = null;
  for (const part of html.split(/(<a href="[^"]*">|<\/a>)/)) {
    if (!part) continue;
    const tag = /^<a href="([^"]*)">$/.exec(part);
    if (tag) {
      if (closed === tag[1] && out.endsWith('</a>')) { out = out.slice(0, -4); open = tag[1]; closed = null; continue; }
      open = tag[1]; closed = null; out += part;
    } else if (part === '</a>') { out += part; closed = open; open = null; }
    else { out += part; closed = null; }
  }
  return out;
}
