// v3.5 AUD-05 — honest colour labels for every surface map, read from the asset manifest (tools/validate/assets.mjs
// writes mapTruth.json from docs/assets/provenance-rules.json). The UI shows the class next to the target and in the
// inspector, so inferred or representative colour is never presented as observed true colour.
import MAP_TRUTH from './mapTruth.json';
export type ColourClass = 'observed' | 'inferred' | 'representative' | 'non-visible' | 'reconstructed' | 'unknown';
export interface ColourTruth { cls: ColourClass; label: string; detail: string }
const T = MAP_TRUTH as Record<string, { truth: string; content: string; source: string; commercial: string }>;
export function colourTruth(tex: string | undefined, procedural = false): ColourTruth {
  if (!tex) return procedural ? { cls: 'reconstructed', label: 'Reconstructed surface', detail: 'No global map: deterministic family reconstruction, not imagery.' } : { cls: 'unknown', label: 'No surface map', detail: '' };
  const e = T[tex]; if (!e) return { cls: 'unknown', label: 'Unlabelled map', detail: '' };
  const t = e.truth.toLowerCase(), c = e.content.toLowerCase();
  if (/near-ir|not visible colour/.test(t + ' ' + c)) return { cls: 'non-visible', label: 'Near-infrared map (not visible colour)', detail: e.content };
  if (/inferred colour|colour inferred/.test(t + ' ' + c)) return { cls: 'inferred', label: 'Colour inferred (greyscale mosaic × documented tint)', detail: e.content };
  if (/artistically|representative/.test(t + ' ' + c)) return { cls: 'representative', label: 'Processed / representative colour', detail: e.content };
  if (/partial/.test(t)) return { cls: 'observed', label: 'Observed where imaged; gaps reconstructed', detail: e.content };
  return { cls: 'observed', label: 'Observed colour', detail: e.content };
}
