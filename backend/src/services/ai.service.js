require('dotenv').config();
const axios = require('axios');

// ENV SETUP
const API_KEYS = Object.keys(process.env)
  .filter(key => key.startsWith('GEMINI_API_KEY_'))
  .sort((a, b) => {
    const numA = parseInt(a.replace('GEMINI_API_KEY_', ''));
    const numB = parseInt(b.replace('GEMINI_API_KEY_', ''));
    return numA - numB;
  })
  .map(key => process.env[key])
  .filter(Boolean);

/**
 * KeyManager handles rotation, shuffling and cooldown of API keys.
 */
class KeyManager {
  constructor(keys) {
    if (!keys || keys.length === 0) {
      throw new Error('No API keys provided to KeyManager.');
    }
    this.entries = keys.map(k => ({ key: k, cooldownUntil: 0 }));
    // Shuffle initial pool to distribute load across server instances
    this.entries.sort(() => Math.random() - 0.5);
    this.currentIndex = 0;
  }

  getNextKey() {
    const now = Date.now();
    const len = this.entries.length;
    for (let i = 0; i < len; i++) {
      const idx = (this.currentIndex + i) % len;
      const entry = this.entries[idx];
      if (now >= entry.cooldownUntil) {
        this.currentIndex = (idx + 1) % len;
        return entry.key;
      }
    }
    console.warn('[KeyManager] All keys are in cooldown. Falling back.');
    const entry = this.entries[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % len;
    return entry.key;
  }

  markRateLimited(key) {
    const entry = this.entries.find(e => e.key === key);
    if (entry) {
      entry.cooldownUntil = Date.now() + 60000; // 1 min cooldown
      console.warn(`[KeyManager] Key ${key.substring(0, 10)}... cooldown for 60s`);
    }
  }
}

const keyManager = new KeyManager(API_KEYS);

// 1. getApiKey()
function getApiKey() {
  return keyManager.getNextKey();
}

// 2. delay(ms)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 3. callGemini(prompt)
async function callGemini(prompt) {
  let attempts = 0;

  while (attempts < API_KEYS.length) {
      // Add 1 second delay before EVERY API call
      await delay(1000);
      const apiKey = getApiKey();

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await axios.post(
          url,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192
            }
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000
          }
        );

        const candidates = response.data && response.data.candidates;
        const text = candidates && candidates[0] && candidates[0].content &&
                     candidates[0].content.parts && candidates[0].content.parts[0] &&
                     candidates[0].content.parts[0].text;
                     
        if (!text) {
          throw new Error('Empty response from text path.');
        }
        
        return text;
      } catch (error) {
        attempts++;
        const status = error.response ? error.response.status : null;

        // RETRY LOGIC (ONLY FOR 429)
        if (status === 429) {
          keyManager.markRateLimited(apiKey);
          console.warn(`[WARN] 429 Rate Limit hit. Retrying with next available API key. (${attempts}/${API_KEYS.length} attempts)`);
          await delay(1000);
          continue;
        } else {
          // Do NOT retry for other errors
          throw new Error(`Gemini API Error: ${error.message}`);
        }
      }
    }
    throw new Error('All Gemini API keys failed due to 429 Rate Limits.');
}

// 4. parseResponse(text)
function parseResponse(text) {
  // 1. Remove markdown if present & 2. Trim string
  let jsonString = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;

  try {
    // 3. Parse JSON safely
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON response returned from API.');
  }

  // VALIDATION
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Validation Error: Parsed response is not a valid JSON object.');
  }
  if (!parsed.scores || typeof parsed.scores !== 'object') {
    throw new Error('Validation Error: Missing "scores" object.');
  }
  if (!parsed.improvements || !parsed.improvements.professional) {
    throw new Error('Validation Error: Missing "improvements" data.');
  }

  return parsed;
}

// 5. generateProfile(role, profileText, tone)
async function generateProfile(role, profileText, tone) {
  const prompt = `You are an expert LinkedIn profile optimizer, recruiter, and ATS evaluator.

Your task is to analyze and improve a LinkedIn profile with HIGH precision and STRUCTURED output.

IMPORTANT RULES:
- Return ONLY valid JSON (no markdown, no explanations, no extra text)
- Maintain strict structure
- Do NOT include placeholders like "..." or vague text
- Be specific, professional, and results-driven

INPUT:
ROLE: ${role}
PROFILE CONTENT:
${profileText}

TASKS:

1. ANALYZE PROFILE
Evaluate:
- clarity
- keyword strength
- impact (metrics, results)
- ATS optimization
- recruiter appeal

2. GENERATE SCORES (0-100)
Scores must be realistic and justified:
- overall_score
- keyword_score
- impact_score
- clarity_score
- ats_score

3. PROVIDE SCORE REASONS
Give short, specific reasons (NOT generic)

4. IMPROVE PROFILE (MULTIPLE TONES)
Generate:
- professional_version
- technical_version
- faang_level_version

Each should include:
- headline
- about (bullet points)
- experience (bullet points with impact verbs + metrics)

5. RECRUITER SIMULATION
Act like a recruiter:
- boolean_search_queries (3)
- missing_keywords (list)
- strengths (list)
- weaknesses (list)
- hiring_signal (Strong / Medium / Weak with reason)

OUTPUT FORMAT (STRICT JSON):

{
  "scores": {
    "overall_score": 0,
    "keyword_score": 0,
    "impact_score": 0,
    "clarity_score": 0,
    "ats_score": 0
  },
  "score_reasons": {
    "keyword": "",
    "impact": "",
    "clarity": "",
    "ats": ""
  },
  "improvements": {
    "professional": {
      "headline": "",
      "about": [],
      "experience": []
    },
    "technical": {
      "headline": "",
      "about": [],
      "experience": []
    },
    "faang": {
      "headline": "",
      "about": [],
      "experience": []
    }
  },
  "recruiter_insights": {
    "boolean_search_queries": [],
    "missing_keywords": [],
    "strengths": [],
    "weaknesses": [],
    "hiring_signal": {
      "level": "",
      "reason": ""
    }
  }
}`;

  const rawText = await callGemini(prompt);
  return parseResponse(rawText);
}

// Controller integration logic adapter
async function enhanceProfile(parsed, roleSlug, tone, analysis) {
  const role = roleSlug.replace(/-/g, ' ');
  return await generateProfile(role, parsed.rawText, tone);
}

module.exports = {
  getApiKey,
  delay,
  callGemini,
  parseResponse,
  generateProfile,
  enhanceProfile
};
