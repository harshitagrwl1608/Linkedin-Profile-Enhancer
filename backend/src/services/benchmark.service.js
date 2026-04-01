/**
 * benchmark.service.js
 * Compares user profile against the ideal profile template for a role.
 * Returns percentile estimate and structured gap analysis.
 */

const { ROLES } = require('../data/roleProfiles');

/**
 * Benchmark the parsed profile against the ideal for the role.
 * @param {object} parsed     - Output of parseProfile()
 * @param {string} roleSlug   - e.g. "backend-developer"
 * @param {number} overallScore - 0-100 from analysis service
 */
function benchmark(parsed, roleSlug, overallScore) {
  const role = ROLES[roleSlug];
  if (!role) throw new Error(`Unknown role: ${roleSlug}`);

  const ideal = role.idealProfile;
  const gaps  = [];

  // ── Skill gaps ───────────────────────────────────────────────────────────
  const foundSkillsLower = parsed.skills.map(s => s.toLowerCase());
  const missingSkills = ideal.skills.filter(
    s => !foundSkillsLower.some(f => f.includes(s.toLowerCase()) || s.toLowerCase().includes(f))
  );

  if (missingSkills.length > 0) {
    gaps.push({
      area    : 'Skills',
      gap     : `Missing: ${missingSkills.join(', ')}`,
      howToFix: `Build projects using ${missingSkills.slice(0, 3).join(', ')}. Add to your profile with a brief description of how you used them.`
    });
  }

  // ── Experience gap ───────────────────────────────────────────────────────
  const userYears  = parsed.experience.yearsExperience;
  const idealYears = ideal.experienceYears;
  if (userYears < idealYears) {
    gaps.push({
      area    : 'Experience',
      gap     : `${idealYears - userYears} year(s) short of the typical ${idealYears}yr benchmark for top candidates.`,
      howToFix: 'Add freelance, open-source, or internship experience. Even side projects count if described with impact.'
    });
  }

  // ── Projects gap ─────────────────────────────────────────────────────────
  const userProj  = parsed.projects.count;
  const idealProj = ideal.projectCount;
  if (userProj < idealProj) {
    gaps.push({
      area    : 'Projects',
      gap     : `Only ${userProj} project(s) detected; top candidates show ${idealProj}+.`,
      howToFix: 'Build and list 2-3 public GitHub projects with live demos. Describe tech stack and measurable impact.'
    });
  }

  // ── Metrics gap ──────────────────────────────────────────────────────────
  if (!parsed.hasMetrics) {
    gaps.push({
      area    : 'Metrics & Impact',
      gap     : 'No quantifiable achievements found in the profile.',
      howToFix: 'Add at least 3 metrics: "reduced latency by 30%", "grew user base by 2x", "shipped feature in 2 sprints".'
    });
  }

  // ── Section completeness ─────────────────────────────────────────────────
  const sections = parsed.sections;
  const missingSections = [];
  if (!sections.about)      missingSections.push('About/Summary');
  if (!sections.skills)     missingSections.push('Skills');
  if (!sections.education)  missingSections.push('Education');
  if (!sections.projects)   missingSections.push('Projects');

  if (missingSections.length > 0) {
    gaps.push({
      area    : 'Profile Completeness',
      gap     : `Missing or unclear sections: ${missingSections.join(', ')}.`,
      howToFix: 'Add clearly labeled sections. LinkedIn algorithm boosts profiles with complete sections.'
    });
  }

  // ── Percentile estimate ──────────────────────────────────────────────────
  const percentile = estimatePercentile(overallScore);

  // ── Top 10% traits for this role ─────────────────────────────────────────
  const topCandidateTraits = buildTopTraits(role, ideal);

  return { percentile, gaps, topCandidateTraits };
}

function estimatePercentile(score) {
  if (score >= 85) return 'Top 5%';
  if (score >= 75) return 'Top 15%';
  if (score >= 65) return 'Top 25%';
  if (score >= 55) return 'Top 35%';
  if (score >= 45) return 'Top 50%';
  if (score >= 35) return 'Bottom 40%';
  return 'Bottom 25%';
}

function buildTopTraits(role, ideal) {
  return [
    `${ideal.experienceYears}+ years of hands-on ${role.displayName} experience`,
    `Proficiency in core stack: ${ideal.skills.slice(0, 4).join(', ')}`,
    `${ideal.projectCount}+ notable projects with measurable outcomes`,
    'Quantified every bullet point with % / numbers / business impact',
    ideal.certifications.length
      ? `Holds relevant certification(s): ${ideal.certifications[0]}`
      : 'Contributes to open-source or has a strong GitHub profile',
    'Strong About section with a clear, role-specific narrative',
    'Active LinkedIn presence with endorsements and recommendations'
  ];
}

module.exports = { benchmark };
