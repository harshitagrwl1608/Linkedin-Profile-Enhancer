/**
 * recruiter.service.js
 * Simulates how a recruiter searches for candidates for a given role.
 * Estimates search visibility and ranking, and returns improvements.
 */

const { ROLES } = require('../data/roleProfiles');

/**
 * @param {object} parsed       - Output of parseProfile()
 * @param {string} roleSlug     - e.g. "backend-developer"
 * @param {number} visibilityScore - 0-100 from analysis service
 */
function simulateRecruiterSearch(parsed, roleSlug, visibilityScore) {
  const role = ROLES[roleSlug];
  if (!role) throw new Error(`Unknown role: ${roleSlug}`);

  // Build Boolean search query recruiters typically use
  const topTerms = role.recruiterSearchTerms.slice(0, 5);
  const searchQuery = topTerms
    .map((t, i) => (i === 0 ? `"${t}"` : `OR "${t}"`))
    .join(' ') + ` AND "${role.displayName}"`;

  // Check which recruiter terms are present
  const lowerText = parsed.rawText.toLowerCase();
  const termHits  = role.recruiterSearchTerms.filter(t => lowerText.includes(t.toLowerCase()));

  // Would appear in the above search?
  const appearInSearch = termHits.length >= Math.ceil(role.recruiterSearchTerms.length * 0.4);

  // Ranking chance narrative
  const rankingChance = computeRankingChance(visibilityScore);

  // Improvement suggestions
  const improvements = buildImprovements(parsed, role, termHits, visibilityScore);

  return {
    visibilityScore,
    rankingChance,
    searchQuery,
    appearInSearch,
    improvements
  };
}

function computeRankingChance(score) {
  if (score >= 80) return 'Top 10% — very likely to appear on page 1 of recruiter searches';
  if (score >= 65) return 'Top 20% — likely to appear in most recruiter searches';
  if (score >= 50) return 'Top 35% — moderate chance of appearing; needs more keywords';
  if (score >= 35) return 'Bottom 40% — low visibility; profile needs significant keyword work';
  return 'Bottom 25% — very low search visibility; major improvements needed';
}

function buildImprovements(parsed, role, termHits, score) {
  const improvements = [];
  const missing = role.recruiterSearchTerms.filter(t => !termHits.includes(t));

  if (missing.length > 0) {
    improvements.push(`Add these recruiter search terms to your headline or About: ${missing.join(', ')}.`);
  }

  if (!parsed.sections.headline) {
    improvements.push('Add a strong headline with your exact job title and top 2-3 skills.');
  }

  if (!parsed.hasMetrics) {
    improvements.push('Add quantifiable achievements — LinkedIn algorithm boosts profiles with numbers.');
  }

  if (parsed.experience.yearsExperience < role.idealProfile.experienceYears) {
    improvements.push(`Recruiters filter by ${role.idealProfile.experienceYears}+ years. Highlight freelance, part-time, or personal project work to bridge the gap.`);
  }

  if (score < 50) {
    improvements.push(`Your profile matches only ${score}% of recruiter search terms. Do a keyword sweep: paste job description keywords into your About and Skills sections.`);
  }

  if (improvements.length === 0) {
    improvements.push('Great keyword coverage! Focus on getting 5+ LinkedIn recommendations for a further boost.');
    improvements.push('Engage with posts in your field — profile activity boosts algorithmic ranking.');
  }

  return improvements;
}

module.exports = { simulateRecruiterSearch };
