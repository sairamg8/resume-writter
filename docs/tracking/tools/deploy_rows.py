#!/usr/bin/env python3
"""After a deploy: ⏸ → ✅ for every R2/R3 row whose listed commits are all ancestors of <master-sha>; reports the rest.
usage: python3 docs/tracking/tools/deploy_rows.py <master-sha> && python3 docs/tracking/tools/update_tracker.py --recount"""
import re, subprocess, sys, glob
sha = sys.argv[1]
SPLIT = re.compile(r'(?<!\\)\|')
def on_master(c):
    return subprocess.run(['git', 'merge-base', '--is-ancestor', c, sha]).returncode == 0
flipped, kept = [], []
for f in sorted(glob.glob('docs/tracking/bug-status-r2/0*.md')):
    lines = open(f, encoding='utf-8').read().split('\n')
    for i, line in enumerate(lines):
        m = re.match(r'^\| (R[23]-\d{3}) \|', line)
        if not m:
            continue
        cols = SPLIT.split(line)
        if not cols[5].strip().startswith('⏸'):
            continue
        commits = re.findall(r'`([0-9a-f]{7,40})`', cols[6])
        missing = [c for c in commits if not on_master(c)]
        if missing:
            kept.append((m.group(1), missing)); continue
        cols[5] = cols[5].replace('⏸', '✅', 1)
        lines[i] = '|'.join(cols)
        flipped.append(m.group(1))
    open(f, 'w', encoding='utf-8').write('\n'.join(lines))
print('flipped', len(flipped), ' '.join(flipped))
print('kept ⏸', kept)
