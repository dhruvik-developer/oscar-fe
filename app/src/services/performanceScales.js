/**
 * The appraisal rating scale.
 *
 * This is scoring vocabulary rather than tenant data — the labels and their
 * score bands are what an appraisal's numeric rating is rendered as, and the
 * API has no endpoint that owns them. It lives here so the performance store
 * does not have to import from a mock data file.
 */
export const RATING_SCALES = [
  { value: 5, label: 'Outstanding', minScore: 4.5, description: 'Consistently exceeds all performance benchmarks with exceptional leadership and quality.' },
  { value: 4, label: 'Exceeds Expectations', minScore: 3.8, description: 'Regularly surpasses expected results and delivers high quality output.' },
  { value: 3, label: 'Meets Expectations', minScore: 3.0, description: 'Reliably meets all targets, core responsibilities, and department standards.' },
  { value: 2, label: 'Needs Improvement', minScore: 2.0, description: 'Partially achieves expectations; requires structured guidance and development.' },
  { value: 1, label: 'Unsatisfactory', minScore: 0.0, description: 'Performance is below required standards; corrective action plan recommended.' },
];

/** The band a numeric score falls into. */
export function scaleForScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return RATING_SCALES.find((scale) => n >= scale.minScore) || RATING_SCALES[RATING_SCALES.length - 1];
}

export default RATING_SCALES;
