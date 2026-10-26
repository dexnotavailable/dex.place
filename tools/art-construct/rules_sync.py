"""Check that docs/character/ART-RULES.md and docs/character/art-rules/checklist.json agree.

Every rule ID (AREA-Pnn / AREA-Nnn) in the markdown must have exactly one checklist entry and
vice versa, and the severity in the markdown table row must match the JSON. It also checks the
JSON's enums. Run it after editing either file:

  python tools/art-construct/rules_sync.py

Exit code 0 = in sync, 1 = problems (listed).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MD = ROOT / 'docs/character/ART-RULES.md'
JS = ROOT / 'docs/character/art-rules/checklist.json'
ID = re.compile(r'\b(?:WF|FG|HD|GR|CL|FC|HR|PX|PS)-[PN]\d{2}\b')
SEV = ('block', 'major', 'minor')


def main():
    md = MD.read_text(encoding='utf-8')
    doc = json.loads(JS.read_text(encoding='utf-8'))
    rules = doc['rules']
    problems = []
    ids = [r['id'] for r in rules]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        problems.append(f'duplicate ids in json: {dup}')
    js = {r['id']: r for r in rules}
    in_md = set(ID.findall(md))
    for i in sorted(in_md - set(js)):
        problems.append(f'{i}: in ART-RULES.md, missing from checklist.json')
    for i in sorted(set(js) - in_md):
        problems.append(f'{i}: in checklist.json, missing from ART-RULES.md')
    defined = set()
    for line in md.splitlines():
        m = re.match(r'\|\s*((?:WF|FG|HD|GR|CL|FC|HR|PX|PS)-[PN]\d{2})\s*\|', line)
        if not m:
            continue
        rid = m.group(1)
        if rid in defined:
            problems.append(f'{rid}: defined in more than one table row')
        defined.add(rid)
        sev = [c.strip() for c in line.strip().strip('|').split('|') if c.strip() in SEV]
        if rid in js and (not sev or sev[-1] != js[rid]['severity']):
            problems.append(f'{rid}: severity md={sev[-1] if sev else None} json={js[rid]["severity"]}')
    for i in sorted(set(js) - defined):
        problems.append(f'{i}: referenced but never defined in a table row of ART-RULES.md')
    for r in rules:
        c = r['check']
        if r['severity'] not in SEV:
            problems.append(f'{r["id"]}: bad severity {r["severity"]}')
        if c['method'] not in ('auto', 'semi', 'critic'):
            problems.append(f'{r["id"]}: bad method {c["method"]}')
        if c['tool_status'] not in ('exists', 'exists_partial', 'to_build', 'n/a'):
            problems.append(f'{r["id"]}: bad tool_status {c["tool_status"]}')
        if not r.get('basis'):
            problems.append(f'{r["id"]}: no basis')
    for p in problems:
        print(p)
    n = len(rules)
    print(f'{n} rules; {len(problems)} problem(s)')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
