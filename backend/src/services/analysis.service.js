/**
 * analysis.service.js
 * Core scoring engine — NO AI.
 * Computes profile score, visibility score, and identifies weak areas.
 */

const { ROLES } = require('../data/roleProfiles');

/**
 * Score the profile against a target role.
 * Returns overall score (0-100) and detailed breakdown.
 */
function scoreProfile(parsed, roleSlug) {
  const role = ROLES[roleSlug];
  if (!role) throw new Error(`Unknown role: ${roleSlug}`);

  const breakdown = {};

  // 1. Keyword match score (40 pts)
  const requiredHits = role.requiredKeywords.filter(kw =>
    parsed.skills.includes(kw) || parsed.keywords.includes(kw)
  );
  const keywordScore = Math.round((requiredHits.length / role.requiredKeywords.length) * 40);
  breakdown.keywordMatch = { score: keywordScore, max: 40, matched: requiredHits.length, total: role.requiredKeywords.length };

  // 2. Nice-to-have keyword score (10 pts)
  const niceHits = role.niceToHaveKeywords.filter(kw =>
    parsed.skills.includes(kw) || parsed.keywords.includes(kw)
  );
  const niceScore = Math.min(10, Math.round((niceHits.length / Math.max(role.niceToHaveKeywords.length, 1)) * 10));
  breakdown.niceToHave = { score: niceScore, max: 10 };

  // 3. Metrics presence (15 pts)
  const metricsScore = parsed.hasMetrics ? 15 : 0;
  breakdown.metrics = { score: metricsScore, max: 15, hasMetrics: parsed.hasMetrics };

  // 4. Experience score (15 pts)
  const expYears = parsed.experience.yearsExperience;
  const idealYears = role.idealProfile.experienceYears;
  const expRatio = idealYears === 0 ? 1 : Math.min(expYears / idealYears, 1);
  const expScore = Math.round(expRatio * 15);
  breakdown.experience = { score: expScore, max: 15, years: expYears, idealYears };

  // 5. Projects score (10 pts)
  const projCount = parsed.projects.count;
  const idealProj = role.idealProfile.projectCount;
  const projScore = Math.min(10, Math.round((projCount / Math.max(idealProj, 1)) * 10));
  breakdown.projects = { score: projScore, max: 10, count: projCount, idealCount: idealProj };

  // 6. Profile completeness (10 pts)
  const sections = parsed.sections;
  const criticalSections = ['about', 'experience', 'skills', 'education'];
  const sectionHits = criticalSections.filter(s => sections[s]).length;
  const completenessScore = Math.round((sectionHits / criticalSections.length) * 10);
  breakdown.completeness = { score: completenessScore, max: 10, sectionsFound: sectionHits };

  const total = keywordScore + niceScore + metricsScore + expScore + projScore + completenessScore;
  const overall = Math.min(100, Math.max(0, total));

  return { overall, breakdown };
}

/**
 * Compute visibility score (0-100) based on keyword match only.
 * Simulates how well the profile surfaces in recruiter keyword searches.
 */
function computeVisibilityScore(parsed, roleSlug) {
  const role = ROLES[roleSlug];
  if (!role) return 0;

  const allKeywords = [...role.requiredKeywords, ...role.niceToHaveKeywords];
  const hits = allKeywords.filter(kw =>
    parsed.skills.includes(kw) ||
    parsed.keywords.includes(kw) ||
    parsed.rawText.toLowerCase().includes(kw.toLowerCase())
  );

  return Math.round((hits.length / allKeywords.length) * 100);
}

/**
 * Find keywords the profile is missing vs the role's required list.
 */
function findMissingKeywords(parsed, roleSlug) {
  const role = ROLES[roleSlug];
  if (!role) return [];

  const allFound = new Set([...parsed.skills, ...parsed.keywords]);
  return role.requiredKeywords.filter(kw => !allFound.has(kw));
}

/**
 * Identify weak areas based on parsed content.
 */
function identifyWeakAreas(parsed) {
  return parsed.weakAreas.map((w, i) => ({
    section: `Issue ${i + 1}`,
    issue  : w.issue,
    fix    : w.fix
  }));
}

module.exports = { scoreProfile, computeVisibilityScore, findMissingKeywords, identifyWeakAreas };
