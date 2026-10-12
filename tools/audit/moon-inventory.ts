// v3.7.1 moon/small-body visual-identity inventory (spec §14): one row per catalogue moon/dwarf/small body with what SOL
// actually renders (map, shape model, procedural family) and its evidence tier. Output: docs/inventory/moons-v371.json/.md
import { CATALOG } from '../../src/data/catalog';
import { visualProfile } from '../../src/render/identity';
import fs from 'node:fs';
const rows: any[] = [];
for (const d of CATALOG as any[]) {
  if (!['moon', 'dwarf', 'asteroid', 'comet', 'tno', 'centaur'].includes(d.kind)) continue;
  const p: any = visualProfile(d);
  rows.push({ id: d.id, name: d.name, kind: d.kind, parent: d.parent ?? '', radiusKm: d.radius, radii: d.radii ?? null, albedo: d.albedo,
    map: d.tex ?? null, mapHi: !!d.texHi, model: d.model ?? null, procedural: d.procedural ? { seed: d.procedural.seed, craters: d.procedural.craters, rough: d.procedural.rough, tint: d.procedural.tint ?? null } : null,
    tier: p.tier, shapeFamily: p.shape, surfaceFamily: p.surface, seed: p.seed, truth: p.truth ?? p.label ?? null, rot: d.rot ?? null, texProv: d.texProv ?? null });
}
fs.mkdirSync('docs/inventory', { recursive: true });
fs.writeFileSync('docs/inventory/moons-v371.json', JSON.stringify(rows, null, 1));
console.log(rows.length);
for (const r of rows) console.log([r.id, r.kind, r.parent, r.radiusKm, r.map ?? '-', r.model ?? '-', r.procedural ? `proc s${r.procedural.seed}` : '-', r.tier, r.shapeFamily, r.surfaceFamily].join(' | '));
