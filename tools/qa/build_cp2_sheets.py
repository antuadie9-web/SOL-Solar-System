#!/usr/bin/env python3
"""Checkpoint-2 before/after sheets from work/qa/cp2-{base,new} (+ cp2b-*). Each sheet: v3.8.0 left, v3.8.1 right,
960×540 software-WebGPU captures, labelled. Output: work/qa/sheets/*.jpg (and the originals stay untouched)."""
import os, subprocess, sys
Q = '/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa'
def sheet(out, title, rows, d='cp2'):
    args = ['python3', '/tmp/sheet.py', f'{Q}/sheets/{out}', title] + [f'{lab}::{Q}/{d}-base/{v}.png::{Q}/{d}-new/{v}.png' for lab, v in rows]
    subprocess.run(args, check=True)
sheet('E1-sun-distance-50.png', 'Sun at Mercury, Earth, Mars distance — Exploration, FOV 50° (software WebGPU)', [('0.39 AU (Mercury)', 'sun-ladder-0p39AU-f50'), ('1 AU (Earth)', 'sun-ladder-1AU-f50'), ('1.52 AU (Mars)', 'sun-ladder-1p52AU-f50')])
sheet('E2-sun-distance-20.png', 'Sun at Mercury, Earth, Mars distance — Exploration, FOV 20° (software WebGPU)', [('0.39 AU, 20°', 'sun-ladder-0p39AU-f20'), ('1 AU, 20°', 'sun-ladder-1AU-f20'), ('1.52 AU, 20°', 'sun-ladder-1p52AU-f20')])
sheet('E3-sun-scientific.png', 'Sun — Scientific mode (physical; no presentation compression)', [('0.39 AU', 'sun-ladder-0p39AU-f50-sci'), ('1 AU', 'sun-ladder-1AU-f50-sci'), ('1.52 AU', 'sun-ladder-1p52AU-f50-sci')])
sheet('E4-sun-cinematic.png', 'Sun — Cinematic mode (labelled art-directed warmth and glare)', [('0.39 AU', 'sun-ladder-0p39AU-f50-cin'), ('1 AU', 'sun-ladder-1AU-f50-cin'), ('1.52 AU', 'sun-ladder-1p52AU-f50-cin')])
sheet('E5-sun-far.png', 'Far-distance transition — Sun from 100 AU, 3,000 AU and 1 pc', [('100 AU, 50°', 'sun-ladder-100AU-f50'), ('3,000 AU, 50°', 'sun-ladder-3000AU-f50'), ('3,000 AU, 20°', 'sun-ladder-3000AU-f20'), ('1 pc, 50°', 'sunfar-1pc')])
sheet('G1-moons-shapes-a.png', 'Saturnian small moons — v3.8.0 ellipsoid+procedural vs v3.8.1 observed Cassini shape (phase ≈25°)', [('Pan', 'moon381-pan'), ('Atlas', 'moon381-atlas'), ('Prometheus', 'moon381-prometheus'), ('Pandora', 'moon381-pandora')])
sheet('G2-moons-shapes-b.png', 'Saturnian small moons (phase ≈25°)', [('Janus', 'moon381-janus'), ('Epimetheus', 'moon381-epimetheus'), ('Helene', 'moon381-helene'), ('Telesto', 'moon381-telesto')])
sheet('G3-moons-shapes-c.png', 'Saturnian small moons (phase ≈25°)', [('Calypso', 'moon381-calypso'), ('Daphnis', 'moon381-daphnis'), ('Hyperion', 'moon381-hyperion')])
sheet('B1-proxima-close.png', 'Proxima Centauri at close range — v3.8.0 point/estimated radius vs v3.8.1 resolved disc (measured 0.1542 R☉)', [('40 radii, Exploration', 'xstar-proxima-40R'), ('8 radii, Exploration', 'xstar-proxima-8R'), ('8 radii, Scientific', 'xstar-proxima-8R-sci')])
if os.path.exists(f'{Q}/cp2b-new'):
    sheet('G4-moons-phase70.png', 'Observed shapes at Cassini-like phase ≈70°', [('Janus', 'moon381-janus-ph70'), ('Epimetheus', 'moon381-epimetheus-ph70'), ('Prometheus', 'moon381-prometheus-ph70')], 'cp2b')
    sheet('G5-moons-phase70b.png', 'Observed shapes at phase ≈70°', [('Pan', 'moon381-pan-ph70'), ('Atlas', 'moon381-atlas-ph70'), ('Hyperion', 'moon381-hyperion-ph70')], 'cp2b')
    sheet('N2-uranian-1986.png', 'Ariel, Titania, Oberon at the Voyager 2 epoch (1986-01-24) — Albers (non-commercial) vs USGS/JPL (rights-cleared)', [('Ariel', 'moon381-ariel-1986'), ('Titania', 'moon381-titania-1986'), ('Oberon', 'moon381-oberon-1986')], 'cp2b')
