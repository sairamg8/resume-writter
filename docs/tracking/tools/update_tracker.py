#!/usr/bin/env python3
"""Apply wf-reports/<cluster>.json outcomes to the R2/R3 tracker rows, then re-total bug-status.md.

Outcomes → status: fixed ⏸ Fixed (on the work branch, not yet on master) · already-fixed ✅ Fixed ·
duplicate / not-a-bug / known-limit ✖ · partial / not-fixed stay 🔴 with a note. Rows not 🔴 are left alone.

usage: update_tracker.py <report.json> [<report.json> ...]
       update_tracker.py --recount                               (only re-total)
"""
import json, re, sys, glob, os, subprocess

# Run from anywhere inside the repo: the tracker paths below are relative to its root.
os.chdir(os.environ.get('REPO') or subprocess.run(['git', 'rev-parse', '--show-toplevel'],
                                                   capture_output=True, text=True).stdout.strip() or '.')
R2_FILES = sorted(glob.glob('docs/tracking/bug-status-r2/0*.md'))
SPLIT = re.compile(r'(?<!\\)\|')


def load_rows():
    rows = {}
    for f in R2_FILES:
        lines = open(f, encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            m = re.match(r'^\| (R[23]-\d{3}) \|', line)
            if m:
                rows[m.group(1)] = (f, i)
    return rows


def ticks(commits):
    return ', '.join(f'`{c}`' for c in commits) if commits else '—'


def apply(report):
    rows = load_rows()
    files = {}
    for r in report['rows']:
        rid = r['id'].strip()
        if rid not in rows:
            print(f'!! {rid}: no tracker row', file=sys.stderr)
            continue
        f, i = rows[rid]
        lines = files.setdefault(f, open(f, encoding='utf-8').read().split('\n'))
        cols = SPLIT.split(lines[i])
        # ['', ID, Area, Severity, Kind, Status, Commit, Tests, Defect, Verified, '']
        if len(cols) < 11:
            print(f'!! {rid}: unexpected column count {len(cols)}', file=sys.stderr)
            continue
        status = cols[5].strip()
        if not status.startswith('🔴'):
            print(f'-- {rid}: already "{status}", left as is')
            continue
        out = r['outcome']
        summary = r.get('summary', '').strip().replace('|', '\\|')
        remaining = (r.get('remaining') or '').strip().replace('|', '\\|')
        commits = [c.strip() for c in r.get('commits', []) if c.strip()]
        tests = ', '.join(t.strip() for t in r.get('tests', []) if t.strip()) or '—'
        defect = cols[8].rstrip()
        if out == 'fixed':
            cols[5] = ' ⏸ Fixed '
            cols[6] = f' {ticks(commits)} '
            cols[7] = f' {tests} '
            note = f' **Now:** {summary}'
            if remaining:
                note += f' **Left for later:** {remaining}'
            cols[8] = defect + note + ' '
        elif out == 'already-fixed':
            cols[5] = ' ✅ Fixed '
            cols[6] = f' {ticks(commits)} '
            cols[7] = f' {tests} '
            cols[8] = defect + f' **Now:** already fixed before the 2026-09-24 pass, by {ticks(commits)}: {summary} '
        elif out in ('duplicate', 'not-a-bug', 'known-limit'):
            dup = re.search(r'R[23]-\d{3}', summary)
            label = {'duplicate': 'Duplicate' + (f' of {dup.group(0)}' if dup else ''),
                     'not-a-bug': 'Not a bug', 'known-limit': 'Known limit'}[out]
            cols[5] = f' ✖ {label} '
            if commits:
                cols[6] = f' {ticks(commits)} '
            if tests != '—':
                cols[7] = f' {tests} '
            cols[8] = defect + f' **Closed 2026-09-24:** {summary} '
        elif out in ('partial', 'not-fixed'):
            if commits:
                cols[6] = f' {ticks(commits)} '
                cols[7] = f' {tests} '
            tag = 'Partly fixed' if out == 'partial' else 'Not fixed yet'
            note = f' **{tag} (2026-09-24):** {summary}'
            if remaining:
                note += f' **Left:** {remaining}'
            cols[8] = defect + note + ' '
        else:
            print(f'!! {rid}: unknown outcome {out}', file=sys.stderr)
            continue
        lines[i] = '|'.join(cols)
        print(f'ok {rid}: {out}')
    for f, lines in files.items():
        open(f, 'w', encoding='utf-8').write('\n'.join(lines))


def recount():
    groups = {'def': [0, 0, 0, 0, 0], 'feat': [0, 0, 0, 0, 0], 'r3': [0, 0, 0, 0, 0]}
    for f in R2_FILES:
        for line in open(f, encoding='utf-8'):
            m = re.match(r'^\| (R([23])-(\d{3})) \|', line)
            if not m:
                continue
            n = int(m.group(3))
            g = 'r3' if m.group(2) == '3' else ('def' if n <= 134 else 'feat')
            status = SPLIT.split(line)[5].strip()
            c = groups[g]
            c[0] += 1
            if status.startswith('✅'):
                c[1] += 1
            elif status.startswith('⏸'):
                c[2] += 1
            elif status.startswith('✖'):
                c[3] += 1
            elif status.startswith('🔴'):
                c[4] += 1
            else:
                print(f'!! {m.group(1)}: status "{status}" not counted', file=sys.stderr)
    p = 'docs/tracking/bug-status.md'
    s = open(p, encoding='utf-8').read()
    labels = {
        'def': '| Full audit, 2026-09-23 — defects (`R2-001`…`R2-134`, [bug-status-r2/](bug-status-r2/README.md)) |',
        'feat': '| Full audit, 2026-09-23 — features and test gaps (`R2-135`…`R2-171`) |',
        'r3': '| Found by the build lanes, 2026-09-24 (`R3-`, in [bug-status-r2/](bug-status-r2/README.md)) |',
    }
    lines = s.split('\n')
    total = [0, 0, 0, 0, 0]
    for i, line in enumerate(lines):
        for g, lab in labels.items():
            if line.startswith(lab):
                c = groups[g]
                lines[i] = f'{lab} {c[0]} | {c[1]} | {c[2]} | {c[3]} | **{c[4]}** |'
    # the other lists keep their numbers: add every row but Total
    in_table = False
    for line in lines:
        if line.startswith('| List |'):
            in_table = True
            continue
        if in_table:
            if not line.startswith('|'):
                break
            if line.startswith('|---') or line.startswith('| **Total**'):
                continue
            nums = [int((re.search(r'\d+', x) or [0])[0]) for x in SPLIT.split(line)[2:7]]
            for k in range(5):
                total[k] += nums[k]
    for i, line in enumerate(lines):
        if line.startswith('| **Total** |'):
            lines[i] = f'| **Total** | **{total[0]}** | **{total[1]}** | **{total[2]}** | **{total[3]}** | **{total[4]}** |'
        if line.startswith('> **Open: '):
            lines[i] = (f'> **Open: {total[4]}** (0 here + {total[4]} in [bug-status-r2/](bug-status-r2/README.md)) | '
                        f'Fixed, not pushed: {total[2]} | **Closed: {total[1] + total[3]}** '
                        f'({total[1]} fixed + {total[3]} ✖ without a code fix)')
    open(p, 'w', encoding='utf-8').write('\n'.join(lines))
    print('totals', total, groups)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args != ['--recount']:
        for a in args:
            apply(json.load(open(a, encoding='utf-8')))
    recount()
