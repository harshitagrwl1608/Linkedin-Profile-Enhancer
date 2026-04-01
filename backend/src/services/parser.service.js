/**
 * parser.service.js
 * Extracts and normalizes structured information from raw profile/resume text.
 * Zero AI — pure heuristic + regex logic.
 */

const { MASTER_SKILLS } = require('../data/roleProfiles');

// ─── Section Headers ──────────────────────────────────────────────────────────
const SECTION_PATTERNS = {
  headline  : /^headline[:\s]/im,
  about     : /\b(about|summary|profile|objective)\b/i,
  experience: /\b(experience|work history|employment|positions?)\b/i,
  projects  : /\b(projects?|portfolio|work samples?)\b/i,
  skills    : /\b(skills?|technologies|tech stack|tools?)\b/i,
  education : /\b(education|academic|degree|university|college)\b/i,
  certifications: /\b(certifications?|licenses?|credentials?)\b/i
};

// ─── Weak-section detectors ───────────────────────────────────────────────────
const WEAK_SIGNALS = [
  { pattern: /\b(responsible for|worked on|helped with|assisted in)\b/gi,
    issue  : 'Passive, responsibility-focused language instead of impact-driven.',
    fix    : 'Replace with action verbs: "Led", "Built", "Reduced", "Increased".' },
  { pattern: /\b(various|several|many|some|multiple tasks|miscellaneous)\b/gi,
    issue  : 'Vague quantifiers — no specifics.',
    fix    : 'Be precise: "5 microservices", "3 client projects", "2 cross-functional teams".' },
  { pattern: /\b(good communication|team player|hard[- ]working|passionate about|love to)\b/gi,
    issue  : 'Clichéd, soft-skill filler phrases recruiters ignore.',
    fix    : 'Show evidence instead: "Coordinated with 3 teams to ship feature 2 weeks early."' },
  { pattern: /\b(etc\.?|and more|and so on)\b/gi,
    issue  : 'Incomplete bullet points — trailing "etc." signals lack of detail.',
    fix    : 'Expand each point fully with specifics.' },
];

// Metrics detector — looks for numbers / percentages / dollar amounts
const HAS_METRIC_RE = /\b(\d+[\w%$+x]?|\d+\.\d+%?|\$\d+[km]?)\b/i;

// ─── Main parse function ──────────────────────────────────────────────────────

/**
 * @param {string} rawText  - Raw LinkedIn / resume text
 * @returns {object}        - Structured parsed profile
 */
function parseProfile(rawText) {
  const text = rawText || '';
  const lower = text.toLowerCase();

  const skills      = extractSkills(lower);
  const experience  = extractExperience(text);
  const projects    = extractProjects(text);
  const keywords    = extractKeywords(lower);
  const weakAreas   = detectWeakSections(text);
  const hasMetrics  = HAS_METRIC_RE.test(text);
  const sections    = detectSections(text);

  return {
    rawText: text,
    skills,
    experience,
    projects,
    keywords,
    weakAreas,
    hasMetrics,
    sections,
    wordCount: text.split(/\s+/).filter(Boolean).length
  };
}

// ─── Skills Extraction ────────────────────────────────────────────────────────
function extractSkills(lowerText) {
  const found = [];
  for (const skill of MASTER_SKILLS) {
    // Word-boundary safe match
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(lowerText)) found.push(skill);
  }
  return [...new Set(found)];
}

// ─── Experience Extraction ────────────────────────────────────────────────────
function extractExperience(text) {
  const entries = [];
  // Look for year ranges like "2021 - 2023", "Jan 2022 – Present"
  const dateRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\s*\d{4}\s*[-–—to]+\s*(present|current|\d{4})\b/gi;
  let match;
  while ((match = dateRe.exec(text)) !== null) {
    const snippet = text.substring(Math.max(0, match.index - 60), match.index + 60).trim();
    entries.push({ dateRange: match[0].trim(), context: snippet });
  }

  // Estimate years of experience from earliest year found
  const years = text.match(/\b(20\d{2}|19\d{2})\b/g) || [];
  const yearNums = years.map(Number).filter(y => y >= 2000 && y <= 2030);
  const minYear = yearNums.length ? Math.min(...yearNums) : null;
  const yearsExperience = minYear ? new Date().getFullYear() - minYear : 0;

  return { entries, yearsExperience: Math.min(yearsExperience, 30) };
}

// ─── Projects Extraction ──────────────────────────────────────────────────────
function extractProjects(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const projectLines = [];
  let inProjectSection = false;

  for (const line of lines) {
    if (SECTION_PATTERNS.projects.test(line)) { inProjectSection = true; continue; }
    if (inProjectSection && /\b(experience|education|skills|certifications)\b/i.test(line)) {
      inProjectSection = false;
    }
    if (inProjectSection && line.length > 10) projectLines.push(line);
  }

  return {
    count: projectLines.length,
    items: projectLines.slice(0, 10)
  };
}

// ─── Keyword Extraction ───────────────────────────────────────────────────────
function extractKeywords(lowerText) {
  const words = lowerText
    .replace(/[^a-z0-9.\s/-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word]) => word);
}

// ─── Weak Section Detection ───────────────────────────────────────────────────
function detectWeakSections(text) {
  const issues = [];

  for (const { pattern, issue, fix } of WEAK_SIGNALS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      issues.push({ issue, fix });
    }
  }

  if (!HAS_METRIC_RE.test(text)) {
    issues.push({
      issue: 'No quantifiable metrics found (%, numbers, dollar amounts).',
      fix  : 'Add impact numbers: "Reduced load time by 40%", "Served 10k+ users".'
    });
  }

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 100) {
    issues.push({
      issue: 'Profile is too short (< 100 words).',
      fix  : 'Expand your About section and add detailed experience bullet points.'
    });
  }

  return issues;
}

// ─── Section Detection ────────────────────────────────────────────────────────
function detectSections(text) {
  const present = {};
  for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) {
    present[name] = pattern.test(text);
  }
  return present;
}

module.exports = { parseProfile, extractSkills, detectWeakSections };
