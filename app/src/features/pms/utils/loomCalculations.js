/**
 * Client-side calculation engine for Loom PMS.
 * Matches backend formulas and Prototype v0.4 costing specifications.
 */

export function qc(quality, yarnMap = {}) {
  if (!quality) return null;
  const wy = yarnMap[quality.warp_yarn || quality.warpYarn] || {};
  const fy = yarnMap[quality.weft_yarn || quality.weftYarn] || {};

  const wd = Number(wy.denier || quality.warp_denier || 0);
  const fd = Number(fy.denier || quality.weft_denier || 0);
  const ppi = Number(quality.ppi || 0);
  const ends = Number(quality.ends || 0);
  const crimp = Number(quality.crimp ?? 5);
  const wastage = Number(quality.wastage ?? 8);
  const reedW = Number(quality.reed_w || quality.reedW || 58);
  const pickCharge = Number(quality.pick_charge || quality.pickCharge || 0.15);
  const wyRate = Number(wy.rate || 0);
  const fyRate = Number(fy.rate || 0);

  const ppm = ppi * 39.37;
  const warpKgM = (ends * wd * (1 + crimp / 100)) / 9000000;
  const weftKgM = (fd * reedW * ppi * (1 + wastage / 100)) / 9000000;

  // [OLD CODE - COMMENTED OUT]: Nominal weight without crimp & wastage, dividing by reed width
  // const glm = ((ends * wd + fd * reedW * ppi) / 9000000) * 1000;
  // const gsm = reedW ? glm / (reedW * 0.0254) : 0;

  // [REAL-LIFE TEXTILE STANDARD]:
  // 1. Physical scale weight of 1 linear meter (GLM) must include warp crimp and weft take-up.
  const glm = (warpKgM + weftKgM) * 1000;
  // 2. Off-loom greige fabric contracts by ~4-6% from reed space (standard contraction factor 0.95).
  // Calculating GSM over contracted greige width accurately matches laboratory circular GSM scale cutters.
  const greigeWidthInches = Number(quality.greige_width || (reedW * 0.95));
  const greigeWidthMeters = greigeWidthInches * 0.0254;
  const gsm = greigeWidthMeters > 0 ? (glm / greigeWidthMeters) : (reedW ? glm / (reedW * 0.0254) : 0);

  const warpCost = warpKgM * wyRate;
  const weftCost = weftKgM * fyRate;
  const jobCost = ppi * pickCharge;
  const totalCost = warpCost + weftCost + jobCost;

  return {
    ppm,
    warpKgM,
    weftKgM,
    totKgM: warpKgM + weftKgM,
    glm,
    gsm,
    warpCost,
    weftCost,
    jobCost,
    totalCost,
    warpDen: wd,
    weftDen: fd,
  };
}

export function formatNum(val, decimals = 0) {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Prevents typing negative characters and scientific notation ('-', 'e', '+') in number inputs.
 */
export function preventNegativeInput(e) {
  if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'Subtract' || e.keyCode === 189) {
    e.preventDefault();
  }
}

/**
 * Ensures a value is clamped to a non-negative number (>= 0).
 */
export function clampNonNegative(val, fallback = 0) {
  if (val === '' || val === null || val === undefined) return '';
  const num = parseFloat(val);
  return isNaN(num) || num < 0 ? fallback : num;
}
