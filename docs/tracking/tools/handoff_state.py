#!/usr/bin/env python3
"""handoff_state.py <cluster>=<state> ... : set the State column of HANDOFF.md's cluster table."""
import sys, re
import os
import subprocess
root = os.environ.get('REPO') or subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
p = os.path.join(root, 'docs/tracking/HANDOFF.md')
lines = open(p, encoding='utf-8').read().split('\n')
for arg in sys.argv[1:]:
    name, state = arg.split('=', 1)
    for i, l in enumerate(lines):
        if l.startswith(f'| {name} |'):
            cols = l.split('|')
            cols[-2] = f' {state} '
            lines[i] = '|'.join(cols)
            break
    else:
        print('no row', name)
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
