// Galilean satellites: Lieske E5 theory (Meeus ch. 44, high accuracy), adapted from astronomia (MIT).
// Returns Jupiter-centred rectangular coordinates referred to the ecliptic & mean equinox of date, in Jupiter equatorial radii.
// @ts-nocheck
import { base, planetelements } from 'astronomia'
export function galileanEcl (jde) {
  
  // variables assigned in following block
  let t

  t = jde - 2443000.5


  const p = Math.PI / 180
  const l1 = 106.07719 * p + 203.48895579 * p * t
  const l2 = 175.73161 * p + 101.374724735 * p * t
  const l3 = 120.55883 * p + 50.317609207 * p * t
  const l4 = 84.44459 * p + 21.571071177 * p * t
  const π1 = 97.0881 * p + 0.16138586 * p * t
  const π2 = 154.8663 * p + 0.04726307 * p * t
  const π3 = 188.184 * p + 0.00712734 * p * t
  const π4 = 335.2868 * p + 0.00184 * p * t
  const ω1 = 312.3346 * p - 0.13279386 * p * t
  const ω2 = 100.4411 * p - 0.03263064 * p * t
  const ω3 = 119.1942 * p - 0.00717703 * p * t
  const ω4 = 322.6186 * p - 0.00175934 * p * t
  const Γ = 0.33033 * p * Math.sin(163.679 * p + 0.0010512 * p * t) +
    0.03439 * p * Math.sin(34.486 * p - 0.0161731 * p * t)
  const Φλ = 199.6766 * p + 0.1737919 * p * t
  let ψ = 316.5182 * p - 0.00000208 * p * t
  const G = 30.23756 * p + 0.0830925701 * p * t + Γ
  const Gʹ = 31.97853 * p + 0.0334597339 * p * t
  const Π = 13.469942 * p

  const Σ1 = 0.47259 * p * Math.sin(2 * (l1 - l2)) +
    -0.03478 * p * Math.sin(π3 - π4) +
    0.01081 * p * Math.sin(l2 - 2 * l3 + π3) +
    0.00738 * p * Math.sin(Φλ) +
    0.00713 * p * Math.sin(l2 - 2 * l3 + π2) +
    -0.00674 * p * Math.sin(π1 + π3 - 2 * Π - 2 * G) +
    0.00666 * p * Math.sin(l2 - 2 * l3 + π4) +
    0.00445 * p * Math.sin(l1 - π3) +
    -0.00354 * p * Math.sin(l1 - l2) +
    -0.00317 * p * Math.sin(2 * ψ - 2 * Π) +
    0.00265 * p * Math.sin(l1 - π4) +
    -0.00186 * p * Math.sin(G) +
    0.00162 * p * Math.sin(π2 - π3) +
    0.00158 * p * Math.sin(4 * (l1 - l2)) +
    -0.00155 * p * Math.sin(l1 - l3) +
    -0.00138 * p * Math.sin(ψ + ω3 - 2 * Π - 2 * G) +
    -0.00115 * p * Math.sin(2 * (l1 - 2 * l2 + ω2)) +
    0.00089 * p * Math.sin(π2 - π4) +
    0.00085 * p * Math.sin(l1 + π3 - 2 * Π - 2 * G) +
    0.00083 * p * Math.sin(ω2 - ω3) +
    0.00053 * p * Math.sin(ψ - ω2)
  const Σ2 = 1.06476 * p * Math.sin(2 * (l2 - l3)) +
    0.04256 * p * Math.sin(l1 - 2 * l2 + π3) +
    0.03581 * p * Math.sin(l2 - π3) +
    0.02395 * p * Math.sin(l1 - 2 * l2 + π4) +
    0.01984 * p * Math.sin(l2 - π4) +
    -0.01778 * p * Math.sin(Φλ) +
    0.01654 * p * Math.sin(l2 - π2) +
    0.01334 * p * Math.sin(l2 - 2 * l3 + π2) +
    0.01294 * p * Math.sin(π3 - π4) +
    -0.01142 * p * Math.sin(l2 - l3) +
    -0.01057 * p * Math.sin(G) +
    -0.00775 * p * Math.sin(2 * (ψ - Π)) +
    0.00524 * p * Math.sin(2 * (l1 - l2)) +
    -0.0046 * p * Math.sin(l1 - l3) +
    0.00316 * p * Math.sin(ψ - 2 * G + ω3 - 2 * Π) +
    -0.00203 * p * Math.sin(π1 + π3 - 2 * Π - 2 * G) +
    0.00146 * p * Math.sin(ψ - ω3) +
    -0.00145 * p * Math.sin(2 * G) +
    0.00125 * p * Math.sin(ψ - ω4) +
    -0.00115 * p * Math.sin(l1 - 2 * l3 + π3) +
    -0.00094 * p * Math.sin(2 * (l2 - ω2)) +
    0.00086 * p * Math.sin(2 * (l1 - 2 * l2 + ω2)) +
    -0.00086 * p * Math.sin(5 * Gʹ - 2 * G + 52.225 * p) +
    -0.00078 * p * Math.sin(l2 - l4) +
    -0.00064 * p * Math.sin(3 * l3 - 7 * l4 + 4 * π4) +
    0.00064 * p * Math.sin(π1 - π4) +
    -0.00063 * p * Math.sin(l1 - 2 * l3 + π4) +
    0.00058 * p * Math.sin(ω3 - ω4) +
    0.00056 * p * Math.sin(2 * (ψ - Π - G)) +
    0.00056 * p * Math.sin(2 * (l2 - l4)) +
    0.00055 * p * Math.sin(2 * (l1 - l3)) +
    0.00052 * p * Math.sin(3 * l3 - 7 * l4 + π3 + 3 * π4) +
    -0.00043 * p * Math.sin(l1 - π3) +
    0.00041 * p * Math.sin(5 * (l2 - l3)) +
    0.00041 * p * Math.sin(π4 - Π) +
    0.00032 * p * Math.sin(ω2 - ω3) +
    0.00032 * p * Math.sin(2 * (l3 - G - Π))
  const Σ3 = 0.1649 * p * Math.sin(l3 - π3) +
    0.09081 * p * Math.sin(l3 - π4) +
    -0.06907 * p * Math.sin(l2 - l3) +
    0.03784 * p * Math.sin(π3 - π4) +
    0.01846 * p * Math.sin(2 * (l3 - l4)) +
    -0.0134 * p * Math.sin(G) +
    -0.01014 * p * Math.sin(2 * (ψ - Π)) +
    0.00704 * p * Math.sin(l2 - 2 * l3 + π3) +
    -0.0062 * p * Math.sin(l2 - 2 * l3 + π2) +
    -0.00541 * p * Math.sin(l3 - l4) +
    0.00381 * p * Math.sin(l2 - 2 * l3 + π4) +
    0.00235 * p * Math.sin(ψ - ω3) +
    0.00198 * p * Math.sin(ψ - ω4) +
    0.00176 * p * Math.sin(Φλ) +
    0.0013 * p * Math.sin(3 * (l3 - l4)) +
    0.00125 * p * Math.sin(l1 - l3) +
    -0.00119 * p * Math.sin(5 * Gʹ - 2 * G + 52.225 * p) +
    0.00109 * p * Math.sin(l1 - l2) +
    -0.001 * p * Math.sin(3 * l3 - 7 * l4 + 4 * π4) +
    0.00091 * p * Math.sin(ω3 - ω4) +
    0.0008 * p * Math.sin(3 * l3 - 7 * l4 + π3 + 3 * π4) +
    -0.00075 * p * Math.sin(2 * l2 - 3 * l3 + π3) +
    0.00072 * p * Math.sin(π1 + π3 - 2 * Π - 2 * G) +
    0.00069 * p * Math.sin(π4 - Π) +
    -0.00058 * p * Math.sin(2 * l3 - 3 * l4 + π4) +
    -0.00057 * p * Math.sin(l3 - 2 * l4 + π4) +
    0.00056 * p * Math.sin(l3 + π3 - 2 * Π - 2 * G) +
    -0.00052 * p * Math.sin(l2 - 2 * l3 + π1) +
    -0.00050 * p * Math.sin(π2 - π3) +
    0.00048 * p * Math.sin(l3 - 2 * l4 + π3) +
    -0.00045 * p * Math.sin(2 * l2 - 3 * l3 + π4) +
    -0.00041 * p * Math.sin(π2 - π4) +
    -0.00038 * p * Math.sin(2 * G) +
    -0.00037 * p * Math.sin(π3 - π4 + ω3 - ω4) +
    -0.00032 * p * Math.sin(3 * l3 - 7 * l4 + 2 * π3 + 2 * π4) +
    0.0003 * p * Math.sin(4 * (l3 - l4)) +
    0.00029 * p * Math.sin(l3 + π4 - 2 * Π - 2 * G) +
    -0.00028 * p * Math.sin(ω3 + ψ - 2 * Π - 2 * G) +
    0.00026 * p * Math.sin(l3 - Π - G) +
    0.00024 * p * Math.sin(l2 - 3 * l3 + 2 * l4) +
    0.00021 * p * Math.sin(2 * (l3 - Π - G)) +
    -0.00021 * p * Math.sin(l3 - π2) +
    0.00017 * p * Math.sin(2 * (l3 - π3))
  const Σ4 = 0.84287 * p * Math.sin(l4 - π4) +
    0.03431 * p * Math.sin(π4 - π3) +
    -0.03305 * p * Math.sin(2 * (ψ - Π)) +
    -0.03211 * p * Math.sin(G) +
    -0.01862 * p * Math.sin(l4 - π3) +
    0.01186 * p * Math.sin(ψ - ω4) +
    0.00623 * p * Math.sin(l4 + π4 - 2 * G - 2 * Π) +
    0.00387 * p * Math.sin(2 * (l4 - π4)) +
    -0.00284 * p * Math.sin(5 * Gʹ - 2 * G + 52.225 * p) +
    -0.00234 * p * Math.sin(2 * (ψ - π4)) +
    -0.00223 * p * Math.sin(l3 - l4) +
    -0.00208 * p * Math.sin(l4 - Π) +
    0.00178 * p * Math.sin(ψ + ω4 - 2 * π4) +
    0.00134 * p * Math.sin(π4 - Π) +
    0.00125 * p * Math.sin(2 * (l4 - G - Π)) +
    -0.00117 * p * Math.sin(2 * G) +
    -0.00112 * p * Math.sin(2 * (l3 - l4)) +
    0.00107 * p * Math.sin(3 * l3 - 7 * l4 + 4 * π4) +
    0.00102 * p * Math.sin(l4 - G - Π) +
    0.00096 * p * Math.sin(2 * l4 - ψ - ω4) +
    0.00087 * p * Math.sin(2 * (ψ - ω4)) +
    -0.00085 * p * Math.sin(3 * l3 - 7 * l4 + π3 + 3 * π4) +
    0.00085 * p * Math.sin(l3 - 2 * l4 + π4) +
    -0.00081 * p * Math.sin(2 * (l4 - ψ)) +
    0.00071 * p * Math.sin(l4 + π4 - 2 * Π - 3 * G) +
    0.00061 * p * Math.sin(l1 - l4) +
    -0.00056 * p * Math.sin(ψ - ω3) +
    -0.00054 * p * Math.sin(l3 - 2 * l4 + π3) +
    0.00051 * p * Math.sin(l2 - l4) +
    0.00042 * p * Math.sin(2 * (ψ - G - Π)) +
    0.00039 * p * Math.sin(2 * (π4 - ω4)) +
    0.00036 * p * Math.sin(ψ + Π - π4 - ω4) +
    0.00035 * p * Math.sin(2 * Gʹ - G + 188.37 * p) +
    -0.00035 * p * Math.sin(l4 - π4 + 2 * Π - 2 * ψ) +
    -0.00032 * p * Math.sin(l4 + π4 - 2 * Π - G) +
    0.0003 * p * Math.sin(2 * Gʹ - 2 * G + 149.15 * p) +
    0.00029 * p * Math.sin(3 * l3 - 7 * l4 + 2 * π3 + 2 * π4) +
    0.00028 * p * Math.sin(l4 - π4 + 2 * ψ - 2 * Π) +
    -0.00028 * p * Math.sin(2 * (l4 - ω4)) +
    -0.00027 * p * Math.sin(π3 - π4 + ω3 - ω4) +
    -0.00026 * p * Math.sin(5 * Gʹ - 3 * G + 188.37 * p) +
    0.00025 * p * Math.sin(ω4 - ω3) +
    -0.00025 * p * Math.sin(l2 - 3 * l3 + 2 * l4) +
    -0.00023 * p * Math.sin(3 * (l3 - l4)) +
    0.00021 * p * Math.sin(2 * l4 - 2 * Π - 3 * G) +
    -0.00021 * p * Math.sin(2 * l3 - 3 * l4 + π4) +
    0.00019 * p * Math.sin(l4 - π4 - G) +
    -0.00019 * p * Math.sin(2 * l4 - π3 - π4) +
    -0.00018 * p * Math.sin(l4 - π4 + G) +
    -0.00016 * p * Math.sin(l4 + π3 - 2 * Π - 2 * G)
  const L1 = l1 + Σ1
  const L2 = l2 + Σ2
  const L3 = l3 + Σ3
  const L4 = l4 + Σ4

  // variables assigned in following block
  let I
  const X = new Array(5).fill(0)
  const Y = new Array(5).fill(0)
  const Z = new Array(5).fill(0)
  let R

  ;(function () {
    const L = [L1, L2, L3, L4]
    const B = [
      Math.atan(0.0006393 * Math.sin(L1 - ω1) +
        0.0001825 * Math.sin(L1 - ω2) +
        0.0000329 * Math.sin(L1 - ω3) +
        -0.0000311 * Math.sin(L1 - ψ) +
        0.0000093 * Math.sin(L1 - ω4) +
        0.0000075 * Math.sin(3 * L1 - 4 * l2 - 1.9927 * Σ1 + ω2) +
        0.0000046 * Math.sin(L1 + ψ - 2 * Π - 2 * G)),
      Math.atan(0.0081004 * Math.sin(L2 - ω2) +
        0.0004512 * Math.sin(L2 - ω3) +
        -0.0003284 * Math.sin(L2 - ψ) +
        0.0001160 * Math.sin(L2 - ω4) +
        0.0000272 * Math.sin(l1 - 2 * l3 + 1.0146 * Σ2 + ω2) +
        -0.0000144 * Math.sin(L2 - ω1) +
        0.0000143 * Math.sin(L2 + ψ - 2 * Π - 2 * G) +
        0.0000035 * Math.sin(L2 - ψ + G) +
        -0.0000028 * Math.sin(l1 - 2 * l3 + 1.0146 * Σ2 + ω3)),
      Math.atan(0.0032402 * Math.sin(L3 - ω3) +
        -0.0016911 * Math.sin(L3 - ψ) +
        0.0006847 * Math.sin(L3 - ω4) +
        -0.0002797 * Math.sin(L3 - ω2) +
        0.0000321 * Math.sin(L3 + ψ - 2 * Π - 2 * G) +
        0.0000051 * Math.sin(L3 - ψ + G) +
        -0.0000045 * Math.sin(L3 - ψ - G) +
        -0.0000045 * Math.sin(L3 + ψ - 2 * Π) +
        0.0000037 * Math.sin(L3 + ψ - 2 * Π - 3 * G) +
        0.000003 * Math.sin(2 * l2 - 3 * L3 + 4.03 * Σ3 + ω2) +
        -0.0000021 * Math.sin(2 * l2 - 3 * L3 + 4.03 * Σ3 + ω3)),
      Math.atan(-0.0076579 * Math.sin(L4 - ψ) +
        0.0044134 * Math.sin(L4 - ω4) +
        -0.0005112 * Math.sin(L4 - ω3) +
        0.0000773 * Math.sin(L4 + ψ - 2 * Π - 2 * G) +
        0.0000104 * Math.sin(L4 - ψ + G) +
        -0.0000102 * Math.sin(L4 - ψ - G) +
        0.0000088 * Math.sin(L4 + ψ - 2 * Π - 3 * G) +
        -0.0000038 * Math.sin(L4 + ψ - 2 * Π - G))
    ]
    R = [
      5.90569 * (1 +
        -0.0041339 * Math.cos(2 * (l1 - l2)) +
        -0.0000387 * Math.cos(l1 - π3) +
        -0.0000214 * Math.cos(l1 - π4) +
        0.000017 * Math.cos(l1 - l2) +
        -0.0000131 * Math.cos(4 * (l1 - l2)) +
        0.0000106 * Math.cos(l1 - l3) +
        -0.0000066 * Math.cos(l1 + π3 - 2 * Π - 2 * G)),
      9.39657 * (1 +
        0.0093848 * Math.cos(l1 - l2) +
        -0.0003116 * Math.cos(l2 - π3) +
        -0.0001744 * Math.cos(l2 - π4) +
        -0.0001442 * Math.cos(l2 - π2) +
        0.0000553 * Math.cos(l2 - l3) +
        0.0000523 * Math.cos(l1 - l3) +
        -0.0000290 * Math.cos(2 * (l1 - l2)) +
        0.0000164 * Math.cos(2 * (l2 - ω2)) +
        0.0000107 * Math.cos(l1 - 2 * l3 + π3) +
        -0.0000102 * Math.cos(l2 - π1) +
        -0.0000091 * Math.cos(2 * (l1 - l3))),
      14.98832 * (1 +
        -0.0014388 * Math.cos(l3 - π3) +
        -0.0007917 * Math.cos(l3 - π4) +
        0.0006342 * Math.cos(l2 - l3) +
        -0.0001761 * Math.cos(2 * (l3 - l4)) +
        0.0000294 * Math.cos(l3 - l4) +
        -0.0000156 * Math.cos(3 * (l3 - l4)) +
        0.0000156 * Math.cos(l1 - l3) +
        -0.0000153 * Math.cos(l1 - l2) +
        0.000007 * Math.cos(2 * l2 - 3 * l3 + π3) +
        -0.0000051 * Math.cos(l3 + π3 - 2 * Π - 2 * G)),
      26.36273 * (1 +
        -0.0073546 * Math.cos(l4 - π4) +
        0.0001621 * Math.cos(l4 - π3) +
        0.0000974 * Math.cos(l3 - l4) +
        -0.0000543 * Math.cos(l4 + π4 - 2 * Π - 2 * G) +
        -0.0000271 * Math.cos(2 * (l4 - π4)) +
        0.0000182 * Math.cos(l4 - Π) +
        0.0000177 * Math.cos(2 * (l3 - l4)) +
        -0.0000167 * Math.cos(2 * l4 - ψ - ω4) +
        0.0000167 * Math.cos(ψ - ω4) +
        -0.0000155 * Math.cos(2 * (l4 - Π - G)) +
        0.0000142 * Math.cos(2 * (l4 - ψ)) +
        0.0000105 * Math.cos(l1 - l4) +
        0.0000092 * Math.cos(l2 - l4) +
        -0.0000089 * Math.cos(l4 - Π - G) +
        -0.0000062 * Math.cos(l4 + π4 - 2 * Π - 3 * G) +
        0.0000048 * Math.cos(2 * (l4 - ω4)))
    ]
    // p. 311
    const T0 = (jde - 2433282.423) / base.JulianCentury
    const P = (1.3966626 * p + 0.0003088 * p * T0) * T0
    for (const i in L) {
      L[i] += P
    }
    ψ += P
    const T = (jde - base.J1900) / base.JulianCentury
    I = 3.120262 * p + 0.0006 * p * T
    for (const i in L) {
      const [sLψ, cLψ] = base.sincos(L[i] - ψ)
      const [sB, cB] = base.sincos(B[i])
      X[i] = R[i] * cLψ * cB
      Y[i] = R[i] * sLψ * cB
      Z[i] = R[i] * sB
    }
  })()

  Z[4] = 1
  // p. 312
  const A = new Array(5).fill(0)
  const B = new Array(5).fill(0)
  const C = new Array(5).fill(0)
  const [sI, cI] = base.sincos(I)
  const Ω = planetelements.node(planetelements.jupiter, jde)
  const [sΩ, cΩ] = base.sincos(Ω)
  const [sΦ, cΦ] = base.sincos(ψ - Ω)
  const [si, ci] = base.sincos(planetelements.inc(planetelements.jupiter, jde))

  const out = []
  for (const i in A) {
    let a0
    // step 1
    let a = X[i]
    let b = Y[i] * cI - Z[i] * sI
    let c = Y[i] * sI + Z[i] * cI
    // step 2
    a0 = a * cΦ - b * sΦ
    b = a * sΦ + b * cΦ
    a = a0
    // step 3
    const b0 = b * ci - c * si
    c = b * si + c * ci
    b = b0
    // step 4
    a0 = a * cΩ - b * sΩ
    b = a * sΩ + b * cΩ
    a = a0
      out.push([a, b, c])
  }
  return out
}
