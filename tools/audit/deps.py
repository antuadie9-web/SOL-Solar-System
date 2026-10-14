"""GA-DEP: module import graph of src/ (static), with fan-in/fan-out and line counts → docs/v3.8.1/audit/deps.json + .md table"""
import os, re, json
ROOT = os.path.join(os.path.dirname(__file__), '..', '..'); os.chdir(ROOT)
mods = {}
for dp, _, fs in os.walk('src'):
    for f in fs:
        if f.endswith('.ts'):
            p = os.path.join(dp, f); t = open(p, encoding='utf8').read()
            imps = set()
            for m in re.finditer(r"""from\s+['"](\.[^'"]+)['"]""", t):
                q = os.path.normpath(os.path.join(dp, m.group(1)))
                for cand in (q + '.ts', q + '/index.ts', q):
                    if os.path.exists(cand) and cand.endswith('.ts'): imps.add(cand); break
            mods[p] = {'lines': t.count('\n'), 'imports': sorted(imps), 'exports': len(re.findall(r'^export ', t, re.M)),
                       'numLiterals': len(re.findall(r'(?<![\w.])\d+\.\d+(?:e-?\d+)?', t)), 'todo': len(re.findall(r'TODO|FIXME|HACK', t))}
for p in mods: mods[p]['fanIn'] = sum(p in m['imports'] for m in mods.values())
json.dump(mods, open('docs/v3.8.1/audit/deps.json', 'w'), indent=1)
print('| Module | Lines | Fan-in | Fan-out | Float literals |\n|---|---:|---:|---:|---:|')
for p, m in sorted(mods.items(), key=lambda x: -x[1]['lines'])[:22]: print(f"| {p[4:]} | {m['lines']} | {m['fanIn']} | {len(m['imports'])} | {m['numLiterals']} |")
