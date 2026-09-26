import { useEffect, useRef, useState } from 'react';
import { pictureFor, requestPicture } from '@/utils/pageImageStore';

/**
 * A page picture (utils/pageImage.js) for the element `ref` is put on: `url` is the picture once it is
 * painted — null until then, and always where there is no browser to paint in. It is asked for only once
 * the element is on screen (or near it), and through the one queue (requestPicture), so a gallery of
 * cards paints the ones a person can see, one at a time. `key` names what is painted: a new key, a new
 * picture. `make()` paints it (a promise of a data URL). `saved()`: a picture kept from an earlier visit,
 * shown at once; `onPainted(url)`: keep a new one (the dashboard's, C1). `enabled` false asks for none.
 */
export function usePicture(key, make, { enabled = true, saved = null, onPainted = null } = {}) {
  const ref = useRef(null);
  const [painted, setPainted] = useState(null); // { key, url }
  const makeRef = useRef(make);
  makeRef.current = make;
  const paintedRef = useRef(onPainted);
  paintedRef.current = onPainted;
  const url = (painted?.key === key ? painted.url : null) || pictureFor(key) || (enabled && saved ? saved() : null);

  useEffect(() => {
    if (!enabled || url) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    let cancel = () => {};
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      cancel = requestPicture(key, () => makeRef.current(), (u) => {
        if (!u) return;
        paintedRef.current?.(u);
        setPainted({ key, url: u });
      });
    }, { rootMargin: '200px' });
    seen.observe(el);
    return () => { seen.disconnect(); cancel(); };
  }, [key, enabled, url]);

  return [ref, url];
}
