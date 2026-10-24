// Team roster fallback — intentionally empty.
//
// No sample/dump members live here. When the backend team roster is empty
// (no users yet / pull returned nothing), callers receive an empty list via
// withSampleTeam() instead of fake people.
export const SAMPLE_TEAM_MEMBERS = [];

/** Real roster when it has anyone, otherwise the sample directory. */
export function withSampleTeam(members) {
  return members && members.length > 0 ? members : SAMPLE_TEAM_MEMBERS;
}
