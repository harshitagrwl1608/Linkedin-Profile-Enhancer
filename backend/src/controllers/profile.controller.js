/**
 * profile.controller.js
 * Handles HTTP requests for all /api/profile/* endpoints.
 * Orchestrates services and returns structured JSON responses.
 */


const { parseProfile }             = require('../services/parser.service');
const { scoreProfile, computeVisibilityScore, findMissingKeywords, identifyWeakAreas } = require('../services/analysis.service');
const { benchmark }                = require('../services/benchmark.service');
const { simulateRecruiterSearch }  = require('../services/recruiter.service');
const { enhanceProfile }           = require('../services/ai.service');
const { normalizeRole, ROLES }     = require('../data/roleProfiles');

// ─── Helpers ──────────────────────────────────────────────────────────────────



function runCoreAnalysis(profileText, targetRole) {
  const roleSlug       = normalizeRole(targetRole);
  const parsed         = parseProfile(profileText);
  const { overall, breakdown } = scoreProfile(parsed, roleSlug);
  const visibilityScore        = computeVisibilityScore(parsed, roleSlug);
  const missingKeywords        = findMissingKeywords(parsed, roleSlug);
  const weakAreas              = identifyWeakAreas(parsed);

  return { roleSlug, parsed, overall, breakdown, visibilityScore, missingKeywords, weakAreas };
}

// ─── POST /api/profile/analyze ────────────────────────────────────────────────
async function analyze(req, res, next) {
  try {
    const { profileText, targetRole } = req.body;

    const { roleSlug, parsed, overall, breakdown, visibilityScore, missingKeywords, weakAreas } =
      runCoreAnalysis(profileText, targetRole);

    const role = ROLES[roleSlug];

    res.json({
      success: true,
      data: {
        overallScore   : overall,
        visibilityScore,
        scoreBreakdown : breakdown,
        evaluation: {
          summary       : buildEvalSummary(overall, parsed),
          strengths     : buildStrengths(parsed, missingKeywords, role),
          weakSections  : weakAreas,
          missingKeywords
        },
        keywords: {
          present  : parsed.skills,
          missing  : missingKeywords,
          suggested: role.niceToHaveKeywords.slice(0, 10)
        },
        parsedProfile: {
          skills          : parsed.skills,
          yearsOfExperience: parsed.experience.yearsExperience,
          projectCount    : parsed.projects.count,
          wordCount       : parsed.wordCount,
          sectionsFound   : parsed.sections
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/profile/enhance ───────────────────────────────────────────────
async function enhance(req, res, next) {
  try {
    const { profileText, targetRole, tone } = req.body;

    const { roleSlug, parsed, overall, missingKeywords, weakAreas } =
      runCoreAnalysis(profileText, targetRole);

    const aiResult = await enhanceProfile(parsed, roleSlug, tone || 'professional', {
      missingKeywords,
      weakAreas
    });

    let mappedTone = 'professional';
    if (tone === 'technical') mappedTone = 'technical';
    else if (tone === 'faang' || tone === 'confident') mappedTone = 'faang';
    
    const imps = aiResult && aiResult.improvements ? aiResult.improvements : {};
    const getImp = (t) => imps[t] || {};
    const profImp = getImp('professional');
    const techImp = getImp('technical');
    const faangImp = getImp('faang');
    const improvement = getImp(mappedTone).headline ? getImp(mappedTone) : profImp;

    const scores = aiResult && aiResult.scores ? aiResult.scores : {};
    const ri = aiResult && aiResult.recruiter_insights ? aiResult.recruiter_insights : {};
    const hs = ri.hiring_signal || {};

    res.json({
      success: true,
      data: {
        rewrite: {
          headlineCorporate  : profImp.headline || '',
          headlineStartup    : techImp.headline || '',
          headlineFAANG      : faangImp.headline || '',
          aboutSection       : Array.isArray(improvement.about) ? improvement.about.join('\n') : (improvement.about || ''),
          experienceRewrite  : improvement.experience ? improvement.experience.map(b => ({ title: 'Experience', bullets: [b] })) : [],
          projectsRewrite    : [],
          finalProfile       : {
            headline: improvement.headline,
            about: Array.isArray(improvement.about) ? improvement.about.join('\n') : improvement.about,
            experience: improvement.experience || [],
            projects: []
          }
        },
        aiAssessment: {
          score              : scores.overall_score || 0,
          diagnosis          : { 
            summary: hs.reason || "Transformed profile generated successfully.", 
            criticalIssues: ri.weaknesses || [], 
            quickWins: ri.strengths || [] 
          },
          skills             : { recommended: ri.missing_keywords || [] },
          keywordOptimization: { addToAbout: ri.missing_keywords || [] },
          recruiterBoostTips : []
        },
        actionPlan: []
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/profile/benchmark ─────────────────────────────────────────────
async function runBenchmark(req, res, next) {
  try {
    const { profileText, targetRole } = req.body;

    const { roleSlug, parsed, overall } = runCoreAnalysis(profileText, targetRole);
    const bmResult = benchmark(parsed, roleSlug, overall);

    res.json({
      success: true,
      data: {
        overallScore  : overall,
        percentile    : bmResult.percentile,
        gaps          : bmResult.gaps,
        topCandidateTraits: bmResult.topCandidateTraits
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/profile/full-report ───────────────────────────────────────────
async function fullReport(req, res, next) {
  try {
    const { profileText, targetRole, tone } = req.body;

    const { roleSlug, parsed, overall, breakdown, visibilityScore, missingKeywords, weakAreas } =
      runCoreAnalysis(profileText, targetRole);

    const role = ROLES[roleSlug];

    // Run benchmark and recruiter sim (pure logic — fast)
    const bmResult = benchmark(parsed, roleSlug, overall);
    const recResult = simulateRecruiterSearch(parsed, roleSlug, visibilityScore);

    // Run AI enhancement
    let aiResult = {};
    try {
      aiResult = await enhanceProfile(parsed, roleSlug, tone || 'professional', {
        missingKeywords,
        weakAreas
      });
    } catch (aiErr) {
      console.error(`[ERROR] AI enhancement failed for role ${roleSlug}:`, aiErr.message);
      aiResult = buildFallbackAIResult(roleSlug, parsed, role, overall);
    }

    const rankingChance = recResult.rankingChance.split(' — ')[0];

    let mappedTone = 'professional';
    if (tone === 'technical') mappedTone = 'technical';
    else if (tone === 'faang' || tone === 'confident') mappedTone = 'faang';

    const imps = aiResult && aiResult.improvements ? aiResult.improvements : {};
    const getImp = (t) => imps[t] || {};
    const profImp = getImp('professional');
    const techImp = getImp('technical');
    const faangImp = getImp('faang');
    const improvement = getImp(mappedTone).headline ? getImp(mappedTone) : profImp;

    const scores = aiResult && aiResult.scores ? aiResult.scores : {};
    const ri = aiResult && aiResult.recruiter_insights ? aiResult.recruiter_insights : {};
    const hs = ri.hiring_signal || {};

    res.json({
      success: true,
      data: {
        overallScore       : overall,
        visibilityScore,
        rankingChance,
        evaluation: {
          summary          : buildEvalSummary(overall, parsed),
          strengths        : buildStrengths(parsed, missingKeywords, role),
          weakSections     : weakAreas,
          missingKeywords
        },
        rewrite: {
          headlineCorporate  : profImp.headline || `${role.displayName} | ${role.idealProfile.skills.slice(0,2).join(' · ')}`,
          headlineStartup    : techImp.headline || `Building with ${role.idealProfile.skills[0]} | ${role.displayName}`,
          headlineFAANG      : faangImp.headline || `${role.displayName} — ${role.idealProfile.skills.slice(0,3).join(', ')}`,
          aboutSection       : Array.isArray(improvement.about) ? improvement.about.join('\n') : (improvement.about || ''),
          experienceRewrite  : improvement.experience ? improvement.experience.map(b => ({ title: 'Experience', bullets: [b] })) : [],
          projectsRewrite    : [],
          finalProfile       : {
            headline: improvement.headline,
            about: Array.isArray(improvement.about) ? improvement.about.join('\n') : improvement.about,
            experience: improvement.experience || [],
            projects: []
          }
        },
        aiAssessment: {
          score              : scores.overall_score || overall,
          diagnosis          : { 
            summary: hs.reason || "Transformed profile generated successfully.", 
            criticalIssues: ri.weaknesses || [], 
            quickWins: ri.strengths || [] 
          },
          skills             : { recommended: ri.missing_keywords || [] },
          keywordOptimization: { addToAbout: ri.missing_keywords || [] },
          recruiterBoostTips : []
        },
        keywords: {
          present  : parsed.skills,
          missing  : missingKeywords,
          suggested: (ri.missing_keywords && ri.missing_keywords.length > 0) ? ri.missing_keywords : role.niceToHaveKeywords.slice(0, 12)
        },
        benchmark: {
          percentile        : bmResult.percentile,
          gaps              : bmResult.gaps,
          topCandidateTraits: bmResult.topCandidateTraits
        },
        recruiterSim: {
          visibilityScore  : recResult.visibilityScore,
          rankingChance    : recResult.rankingChance,
          searchQuery      : recResult.searchQuery,
          appearInSearch   : recResult.appearInSearch,
          improvements     : recResult.improvements
        },
        actionPlan: buildFallbackActionPlan(missingKeywords, weakAreas, bmResult.gaps)
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─── Utility Builders ─────────────────────────────────────────────────────────

function buildEvalSummary(score, parsed) {
  const level = score >= 75 ? 'strong' : score >= 50 ? 'average' : 'weak';
  const metrics = parsed.hasMetrics ? 'includes some metrics' : 'lacks quantifiable achievements';
  const proj = parsed.projects.count > 0 ? `${parsed.projects.count} project(s) detected` : 'no projects found';
  return `This profile scores ${score}/100 — a ${level} profile. It ${metrics} and has ${proj}. ${
    score < 60 ? 'Significant keyword and content improvements are needed to compete with top candidates.' :
    score < 80 ? 'Good foundation — focus on adding metrics, missing keywords, and a compelling About section.' :
    'Excellent profile — minor tweaks to keywords and About section will push it to top 10%.'
  }`;
}

function buildStrengths(parsed, missingKeywords, role) {
  const strengths = [];
  if (parsed.skills.length >= 5)       strengths.push(`${parsed.skills.length} technical skills identified`);
  if (parsed.hasMetrics)               strengths.push('Profile contains quantifiable achievements');
  if (parsed.experience.yearsExperience >= role.idealProfile.experienceYears) strengths.push(`${parsed.experience.yearsExperience} years of experience meets role benchmark`);
  if (parsed.projects.count >= 2)      strengths.push(`${parsed.projects.count} projects showcase practical experience`);
  if (parsed.sections.about)           strengths.push('Has an About/Summary section');
  if (missingKeywords.length <= 3)     strengths.push('Strong keyword coverage for the target role');
  if (strengths.length === 0)          strengths.push('Profile submitted — ready for optimization!');
  return strengths;
}

function buildFallbackActionPlan(missingKeywords, weakAreas, gaps) {
  const steps = [];
  if (missingKeywords.length > 0) steps.push({ step: 1, title: 'Add missing keywords', description: `Insert these keywords naturally: ${missingKeywords.slice(0, 5).join(', ')}.`, priority: 'high', impact: 'Boosts recruiter search visibility significantly.' });
  if (weakAreas.length > 0)       steps.push({ step: 2, title: 'Fix weak language', description: (weakAreas[0] && weakAreas[0].fix) || 'Replace passive language with action verbs.', priority: 'high', impact: 'Makes bullets impactful and ATS-friendly.' });
  steps.push({ step: 3, title: 'Add metrics', description: 'Quantify every bullet. Use %, $, numbers of users, time saved.', priority: 'high', impact: 'Profiles with metrics get 3x more recruiter clicks.' });
  if (gaps.some(g => g.area === 'Projects')) steps.push({ step: 4, title: 'Add projects', description: 'Add 2 GitHub projects with live links, tech stack, and measurable outcomes.', priority: 'medium', impact: 'Compensates for experience gaps.' });
  steps.push({ step: steps.length + 1, title: 'Rewrite About section', description: 'Use a story-driven format: who you are → what you build → CTA.', priority: 'medium', impact: 'About section is the first thing recruiters read.' });
  return steps;
}

function buildFallbackAIResult(roleSlug, parsed, role, baseScore = 0) {
  return {
    scores: {
      overall_score: baseScore,
      keyword_score: baseScore,
      impact_score: baseScore,
      clarity_score: baseScore,
      ats_score: baseScore
    },
    score_reasons: { keyword: '', impact: '', clarity: '', ats: '' },
    improvements: {
      professional: {
        headline: `${role.displayName} | ${parsed.skills.slice(0,3).join(' · ')}`,
        about: [`Experienced ${role.displayName} skilled in ${parsed.skills.slice(0,5).join(', ')}. Passionate about building scalable, high-quality software.`],
        experience: [
          "Built resilient backend services handling high-volume traffic using Node.js.",
          "Optimized database queries in MongoDB, reducing average latency by 25%.",
          "Designed secure REST APIs supporting 5,000+ daily active users.",
          "Implemented comprehensive unit testing, achieving 90% code coverage."
        ]
      },
      technical: { headline: '', about: [], experience: [] },
      faang: { headline: '', about: [], experience: [] }
    },
    recruiter_insights: {
      boolean_search_queries: [],
      missing_keywords: role.niceToHaveKeywords.slice(0, 8),
      strengths: [],
      weaknesses: [],
      hiring_signal: { level: 'Medium', reason: 'Fallback generated.' }
    }
  };
}

module.exports = { analyze, enhance, runBenchmark, fullReport };
