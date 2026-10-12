// @ts-nocheck — TSL node graphs are dynamically typed
// Double-precision camera: orbit / free-flight / cinematic "go to" with log-distance arcs.
import * as THREE from 'three/webgpu';
import { V3, add, sub, scale, len, norm, cross, dot } from '../astro/vec';
import type { Body } from '../astro/system';
import { CameraStateMachine } from '../navigation/cameraState';

const sceneVec = (v: V3) => new THREE.Vector3(v[0], v[2], -v[1]);
const eclVec = (v: THREE.Vector3): V3 => [v.x, -v.z, v.y];
const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smoothDamp = (cur: number, target: number, k: number, dt: number) => target + (cur - target) * Math.exp(-k * dt);

const smoothstep01 = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export class CameraRig {
  pos: V3 = [0, 0, 0];                        // heliocentric ecliptic km
  quat = new THREE.Quaternion();               // scene-frame orientation
  // v3.5 AUD-02: `target`, `mode` and `flight` are accessors that keep the camera state machine (contract 5) in step.
  // v3.4 let any caller assign rig.flight = null / rig.target = x / rig.mode = … directly (ui.ts did, the QA harness did),
  // leaving sm.mode = 'travel' or sm.target pointing at the previous body. Every write now reports the transition.
  private _target: Body | null = null;
  get target() { return this._target; }
  set target(b: Body | null) { this._target = b; if (b && this.sm.target !== b.id) this.sm.retarget(b.id); }
  // orbit state (relative to target, in ecliptic): spherical yaw/pitch around ecliptic north, log distance
  yaw = 0; pitch = 0.3; dist = 1e6; tYaw = 0; tPitch = 0.3; tDist = 1e6;
  roll = 0;
  private _mode: 'orbit' | 'free' = 'orbit';
  get mode() { return this._mode; }
  set mode(m: 'orbit' | 'free') { const prev = this._mode; this._mode = m; if (m !== prev) this.sm.dispatch({ type: m === 'free' ? 'free' : 'orbit' }); }
  private _flight: null | { t0: number; dur: number; from: { pos: V3; quat: THREE.Quaternion }; to: Body; endDist: number; endYaw: number; endPitch: number; peak: number; onDone?: () => void } = null;
  get flight() { return this._flight; }
  set flight(f) {
    const had = !!this._flight; this._flight = f;
    // a flight removed by anyone other than the arrival path is an interruption (wheel, drag, harness, UI jump)
    if (had && !f && this.sm.mode === 'travel') this.sm.dispatch({ type: 'gesture' });
  }
  /** Number of times the per-frame invariant check had to repair a state-machine mismatch (should stay 0). */
  desyncRepairs = 0;
  /** Expected state-machine mode for the rig's own state. */
  expectedMode(): 'travel' | 'orbit' | 'free' { return this._flight ? 'travel' : this._mode; }
  /** Invariant: the machine reports exactly what the rig is doing (mode and target). Repairs and counts any mismatch. */
  syncCheck() {
    const want = this.expectedMode(), t = this._target?.id;
    const okMode = this.sm.mode === want || (want === 'orbit' && (this.sm.mode === 'follow' || this.sm.mode === 'tour' || this.sm.mode === 'cinematic'));
    const okTarget = !t || this.sm.target === t;
    if (okMode && okTarget) return true;
    this.desyncRepairs++; this.sm.seed(t ?? this.sm.target, want); return false;
  }
  freeVel: V3 = [0, 0, 0]; keys = new Set<string>();
  /** v3.8.1 CAM-381-01 free-look target orientation; re-synchronised whenever someone sets `quat` directly (UI, harness). */
  tQuat = new THREE.Quaternion(); private lastQ = new THREE.Quaternion(); private tQuatValid = false;
  syncFreeTarget() { if (!this.tQuatValid || !this.quat.equals(this.lastQ)) { this.tQuat.copy(this.quat); this.tQuatValid = true; this.lastQ.copy(this.quat); } }
  lookYaw = 0; lookPitch = 0; fov = 50; tFov = 50; surfaceLock = false; lockRef: number[] | null = null;
  sensitivity = 1; inertia = 1;
  get flying() { return !!this.flight; }
  /** v3.4 contract 5: explicit mode machine + navigation history (the rig reports every transition into it) */
  sm = new CameraStateMachine(() => performance.now());
  reducedMotion = false;
  private lastGood: V3 = [0, 0, 0];
  /** Interrupt a travel animation: keep the current pose and continue in orbit mode around the destination. */
  cancelFlight() {
    const f = this.flight; if (!f) return;
    this.flight = null;                                      // setter reports the interruption ('gesture')
    const q = this.quat.clone();
    this.setTarget(f.to);
    // keep the instantaneous view direction: express the current orientation as a free-look offset from the look-at
    const look = this.lookQuat(this.pos, f.to.pos);
    const off = look.clone().invert().multiply(q);
    const e = new THREE.Euler().setFromQuaternion(off, 'YXZ');
    this.lookPitch = Math.max(-1.4, Math.min(1.4, e.x)); this.lookYaw = e.y; this.roll = 0;
  }

  setTarget(b: Body, dist?: number) {
    this.target = b;
    const rel = sub(this.pos, b.pos);
    const d = len(rel);
    this.dist = this.tDist = dist ?? d;
    this.yaw = this.tYaw = Math.atan2(rel[1], rel[0]);
    this.pitch = this.tPitch = Math.asin(Math.max(-1, Math.min(1, rel[2] / (d || 1))));
    if (!this.sm.target) this.sm.seed(b.id);
    this.mode = 'orbit';                                     // setter reports free → orbit
  }
  /** Optional ground query (engine-provided; DEM-aware for terrain bodies). */
  ground?: (b: Body, dirLocal: [number, number, number]) => number;
  minDist(b: Body) {
    if (this.ground && b.rot) {
      // camera direction in the body-fixed frame → terrain radius below the camera, plus a 50 m safety margin
      const r = sub(this.pos, b.pos), l = len(r) || 1, m = b.rot;
      const d: [number, number, number] = [(m[0] * r[0] + m[3] * r[1] + m[6] * r[2]) / l, (m[1] * r[0] + m[4] * r[1] + m[7] * r[2]) / l, (m[2] * r[0] + m[5] * r[1] + m[8] * r[2]) / l];
      return Math.max(this.ground(b, d) + 0.05, Math.min(b.radii[0], b.radius) * 0.99);
    }
    return Math.max(b.radii[0], b.radius) * 1.0008 + 0.002;
  }
  // nice viewing direction: sunlit ¾ phase, slightly above the body's orbital plane
  niceAngles(b: Body): [number, number] {
    const s = norm(scale(b.pos, -1));
    if (b.id === 'sun') return [this.yaw, 0.25];
    const yawSun = Math.atan2(s[1], s[0]);
    return [yawSun - 0.75, 0.22];
  }
  goTo(b: Body, opts: { dist?: number; dur?: number; onDone?: () => void } = {}) {
    const endDist = opts.dist ?? this.viewDistance(b);
    let [ey, ep] = this.niceAngles(b);
    const d0 = len(sub(this.pos, b.pos));
    const ratio = Math.abs(Math.log(Math.max(d0, 1) / endDist));
    // v3.8 (INT-001): interstellar legs (either end beyond 2,000 AU from the Sun, i.e. outside the planetary system) are
    // RADIAL: the camera travels along the real line between where it is and the destination and arrives on the near
    // side, instead of swinging the yaw/pitch arc around a destination parsecs away (a sideways sweep of ~1 pc that has
    // nothing to do with the real geometry). Longer cap (9 s) for the ×10⁵–10⁷ distance ratios of a stellar journey.
    const far = 2000 * 149597870.7, interstellar = len(this.pos) > far || len(b.pos) > far;
    if (interstellar && b.kind === 'xstar') { const rel = sub(this.pos, b.pos); ey = Math.atan2(rel[1], rel[0]); ep = Math.asin(Math.max(-1, Math.min(1, rel[2] / Math.max(d0, 1e-9)))); }
    const dur = (opts.dur ?? Math.min(interstellar ? 9 : 7.5, 2.4 + ratio * 0.22)) * (this.reducedMotion ? 0.35 : 1);
    // zoom-out arc: rise to roughly the separation of the two places so the journey reads as travel (not between stars)
    const sep = len(sub(b.pos, this.target ? this.target.pos : this.pos));
    const peak = interstellar ? Math.max(d0, endDist) : Math.max(d0, endDist, sep * 0.55);
    this.sm.dispatch({ type: 'travel', target: b.id });      // history + travel first, so the target setter sees it
    this._mode = 'orbit';
    this.flight = { t0: performance.now(), dur: dur * 1000, from: { pos: [...this.pos] as V3, quat: this.quat.clone() }, to: b, endDist, endYaw: ey, endPitch: ep, peak, onDone: opts.onDone, lateTurn: interstellar } as any;
    this.target = b; this.lookYaw = 0; this.lookPitch = 0;
  }
  /** v3.7: travel to an arbitrary vantage point near body b (ring selector, journeys); arrives in orbit mode around b with
   *  the camera at `pos` (the target point stays in view: orbit mode looks at b's centre). Same eased flight as goTo. */
  flyToPoint(pos: V3, _at: V3, b: Body) {
    const rel = sub(pos, b.pos), d = len(rel);
    this.goTo(b, { dist: d });
    if (this._flight) { (this._flight as any).endYaw = Math.atan2(rel[1], rel[0]); (this._flight as any).endPitch = Math.asin(Math.max(-1, Math.min(1, rel[2] / d))); }
  }
  viewDistance(b: Body) {
    const r = Math.max(b.radii[0], b.radius);
    if (b.kind === 'star') return r * 6;
    if (b.kind === 'xstar' && b.info?.dsoKind) return b.radius * 3;   // v3.8 deep-sky object: frame its extent
    if (b.kind === 'xstar') return 50 * 149597870.7;   // system view: resolved stellar discs are a later phase
    if (b.def.rings && b.id === 'saturn') return r * 6.5;
    return r * (r < 50 ? 4.5 : 3.6);
  }
  orbitPos(b: Body, yaw: number, pitch: number, d: number): V3 {
    return add(b.pos, [Math.cos(pitch) * Math.cos(yaw) * d, Math.cos(pitch) * Math.sin(yaw) * d, Math.sin(pitch) * d]);
  }
  lookQuat(from: V3, to: V3, up: V3 = [0, 0, 1]) {
    const m = new THREE.Matrix4().lookAt(sceneVec(from), sceneVec(to), sceneVec(up));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }
  update(dt: number) {
    this.updateInner(dt);
    // numerical safety: never let NaN/Inf reach the renderer (degenerate targets, zero distances)
    if (!this.pos.every(Number.isFinite) || ![this.quat.x, this.quat.y, this.quat.z, this.quat.w].every(Number.isFinite)) {
      this.pos = [...this.lastGood] as V3; this.flight = null; this.quat.identity();
      if (this.target) { this.setTarget(this.target); if (!(this.dist > 0)) this.dist = this.tDist = this.viewDistance(this.target); }
    } else this.lastGood = [...this.pos] as V3;
    // never inside a body's (largest) radius in orbit mode
    if (this.mode === 'orbit' && this.target && !this.flight) { const mn = this.minDist(this.target); if (this.dist < mn) this.dist = this.tDist = mn; }
    this.syncCheck();
  }
  private updateInner(dt: number) {
    const b = this.target;
    if (this.flight) {
      const f = this.flight, t = Math.min(1, (performance.now() - f.t0) / f.dur), s = easeInOut(t);
      // start offset relative to the (moving) destination
      const rel0 = sub(f.from.pos, f.to.pos), d0 = len(rel0);
      const y0 = Math.atan2(rel0[1], rel0[0]), p0 = Math.asin(rel0[2] / d0);
      let dy = f.endYaw - y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      // v3.8: on interstellar legs the viewing angles around the destination change only in the final part of the
      // approach (when the distance is already small), so the path stays on the real line of travel
      const sa = (f as any).lateTurn ? smoothstep01(0.6, 1, s) : s;
      const yaw = y0 + dy * sa, pitch = p0 + (f.endPitch - p0) * sa;
      const lnd = Math.log(d0) + (Math.log(f.endDist) - Math.log(d0)) * s;
      const bump = Math.max(0, Math.log(f.peak) - Math.max(Math.log(d0), Math.log(f.endDist))) * Math.sin(Math.PI * s) * 0.9;
      const d = Math.exp(lnd + bump);
      this.pos = this.orbitPos(f.to, yaw, pitch, d);
      const look = this.lookQuat(this.pos, f.to.pos);
      // turn toward the destination early in the flight
      const turn = Math.min(1, t * 2.2);
      this.quat.copy(f.from.quat).slerp(look, easeInOut(turn));
      if (t >= 1) {
        this.sm.dispatch({ type: 'arrive' });                // arrival first: the flight setter then sees a non-travel state
        this.flight = null; this.yaw = this.tYaw = yaw; this.pitch = this.tPitch = pitch; this.dist = this.tDist = d;
        f.onDone?.();
      }
      return;
    }
    if (this.mode === 'orbit' && b) {
      const k = 9 / this.inertia;
      this.yaw = smoothDamp(this.yaw, this.tYaw, k, dt); this.pitch = smoothDamp(this.pitch, this.tPitch, k, dt);
      this.dist = Math.exp(smoothDamp(Math.log(this.dist), Math.log(this.tDist), k * 0.8, dt));
      this.fov = smoothDamp(this.fov, this.tFov, 8, dt);
      let yaw = this.yaw, pitch = this.pitch;
      if (this.surfaceLock && this.lockRef) {
        // rotate the orbit offset with the body (stay above the same spot)
        const m = b.rot, l = this.lockRef; // body-fixed offset direction
        const v: V3 = [m[0] * l[0] + m[1] * l[1] + m[2] * l[2], m[3] * l[0] + m[4] * l[1] + m[5] * l[2], m[6] * l[0] + m[7] * l[1] + m[8] * l[2]];
        yaw = Math.atan2(v[1], v[0]); pitch = Math.asin(v[2]); this.yaw = this.tYaw = yaw; this.pitch = this.tPitch = pitch;
      }
      this.pos = this.orbitPos(b, yaw, pitch, this.dist);
      const q = this.lookQuat(this.pos, b.pos);
      // free-look offset (right-drag) on top of the look-at
      const off = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.lookPitch, this.lookYaw, this.roll, 'YXZ'));
      this.quat.copy(q).multiply(off);
    } else if (this.mode === 'free') {
      if (this.tQuatValid && this.quat.equals(this.lastQ)) { const k = 1 - Math.exp(-dt * (this.reducedMotion ? 40 : 22) / Math.max(0.2, this.inertia)); this.quat.slerp(this.tQuat, k).normalize(); }
      else this.tQuatValid = false;   // orientation was set externally: follow it, do not pull back toward a stale target
      this.lastQ.copy(this.quat);
      const sp = this.freeSpeed();
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat), right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat), up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
      const mv = new THREE.Vector3();
      if (this.keys.has('KeyW')) mv.add(fwd); if (this.keys.has('KeyS')) mv.sub(fwd);
      if (this.keys.has('KeyD')) mv.add(right); if (this.keys.has('KeyA')) mv.sub(right);
      if (this.keys.has('KeyE') || this.keys.has('Space')) mv.add(up); if (this.keys.has('KeyQ') || this.keys.has('KeyC')) mv.sub(up);
      const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 8 : 1;
      const target = eclVec(mv.multiplyScalar(sp * boost));
      this.freeVel = add(scale(this.freeVel, Math.exp(-4 * dt)), scale(target, 1 - Math.exp(-4 * dt)));
      this.pos = add(this.pos, scale(this.freeVel, dt));
      this.fov = smoothDamp(this.fov, this.tFov, 8, dt);
    }
  }
  nearestSurface = 1e9;
  freeSpeed() { return Math.max(0.05, this.nearestSurface) * 0.8; } // km/s, proportional to altitude
  rotate(dx: number, dy: number) {
    const s = 0.0042 * this.sensitivity;
    if (this.mode === 'orbit') {
      this.tYaw -= dx * s; this.tPitch = Math.max(-1.55, Math.min(1.55, this.tPitch + dy * s));
      if (this.surfaceLock) this.captureLock();
    } else {
      // v3.8.1 CAM-381-01: free-look drags accumulate into a TARGET orientation that the camera follows with a short,
      // frame-rate-independent exponential approach (update()). v3.4–3.8.0 applied each mouse event straight to the camera,
      // so the view (and every star) advanced in uneven steps whenever event delivery and frame pacing beat against each
      // other — a judder visible on real hardware at 60–144 Hz that a software adapter never shows.
      this.syncFreeTarget();
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * s * 0.6);
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * s * 0.6);
      this.tQuat.multiply(qy).multiply(qx);
    }
  }
  look(dx: number, dy: number) { const s = 0.003 * this.sensitivity; this.lookYaw -= dx * s; this.lookPitch = Math.max(-1.4, Math.min(1.4, this.lookPitch - dy * s)); }
  zoom(delta: number) {
    if (this.mode !== 'orbit' || !this.target) { this.tFov = Math.max(1, Math.min(100, this.tFov * Math.exp(delta * 0.001))); return; }
    const mn = this.minDist(this.target);
    // log zoom, slowing as we approach the surface
    const alt = Math.max(this.tDist - mn * 0.9995, 1e-4);
    const nAlt = alt * Math.exp(delta * 0.0012 * this.sensitivity);
    this.tDist = Math.min(2e11, Math.max(mn, mn * 0.9995 + nAlt));
  }
  captureLock() {
    if (!this.target) return;
    const m = this.target.rot, v: V3 = [Math.cos(this.tPitch) * Math.cos(this.tYaw), Math.cos(this.tPitch) * Math.sin(this.tYaw), Math.sin(this.tPitch)];
    this.lockRef = [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  }
  toFree() { this.flight = null; this.freeVel = [0, 0, 0]; this.mode = 'free'; }
}
export { sceneVec, eclVec };
