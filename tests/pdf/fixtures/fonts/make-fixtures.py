#!/usr/bin/env python3
"""
Regenerates the real font files tests/pdf/fake-fontsource.mjs serves for the script fonts (the stand-in's
text fonts are made from the bundled Noto Sans; a script it does not have needs a real font, for its shaping).

Each file is Fontsource's own 400 / normal face of the package, fetched from jsDelivr (the files are OFL-1.1,
Google Fonts): whole for Hebrew, Thai and Arabic (small), and cut with fonttools to the characters the tests
print for the big ones (the CJK faces, Noto Emoji), with the layout tables kept. Run it only to add a character
a test prints, then commit the files:  python3 make-fixtures.py   (needs: pip install fonttools)
"""
import io, pathlib, re, sys, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

HERE = pathlib.Path(__file__).resolve().parent
TESTS = HERE.parent.parent
CDN = 'https://cdn.jsdelivr.net/npm/@fontsource'

# (package, subset, cut to the tests' characters?)
FACES = [
    ('noto-sans-hebrew', 'hebrew', False),
    ('noto-sans-thai', 'thai', False),
    ('noto-sans-arabic', 'arabic', False),
    ('ibm-plex-sans-arabic', 'arabic', False),
    ('noto-sans-sc', 'chinese-simplified', True),
    ('noto-sans-tc', 'chinese-traditional', True),
    ('noto-sans-jp', 'japanese', True),
    ('noto-sans-kr', 'korean', True),
    ('noto-emoji', 'emoji', True),
]
TEST_FILES = ['05-fonts-scripts.test.mjs', '164-sidebar-token-break.test.mjs', '05-fonts.test.mjs']


def printed_characters():
    chars = set()
    for name in TEST_FILES:
        for ch in (TESTS / name).read_text(encoding='utf-8'):
            if ord(ch) > 0x7F:
                chars.add(ord(ch))
    # a variation selector and the joiners go with the text they follow
    chars |= {0x200D, 0xFE0F, 0x20, 0xA0}
    return sorted(chars)


def main():
    chars = printed_characters()
    for pkg, sub, cut in FACES:
        url = f'{CDN}/{pkg}@5/files/{pkg}-{sub}-400-normal.woff'
        data = urllib.request.urlopen(url).read()
        out = HERE / f'{pkg}-{sub}-400-normal.woff'
        if cut:
            options = subset.Options()
            options.flavor = 'woff'
            options.layout_features = ['*']
            options.glyph_names = False
            options.notdef_outline = True
            options.name_IDs = ['*']
            options.hinting = False
            font = TTFont(io.BytesIO(data))
            sub_ = subset.Subsetter(options)
            sub_.populate(unicodes=chars)
            sub_.subset(font)
            font.flavor = 'woff'
            font.save(out)
        else:
            out.write_bytes(data)
        print(f'{out.name}: {out.stat().st_size} bytes')


if __name__ == '__main__':
    sys.exit(main())
