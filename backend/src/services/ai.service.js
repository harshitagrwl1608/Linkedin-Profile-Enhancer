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
  const maxRetries = 2;

  while (attempts < maxRetries) {
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
          console.warn(`[WARN] 429 Rate Limit hit. Retrying with next available API key. (${attempts}/${maxRetries} attempts)`);
          await delay(1000);
          continue;
        } else {
          // Do NOT retry for other errors
          throw new Error(`Gemini API Error: ${error.message}`);
        }
      }
    }
    const err = new Error('AI service busy. Try again in 2 minutes.');
    err.status = 429;
    throw err;
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
  if (!parsed.rewrite || typeof parsed.rewrite !== 'object') {
    throw new Error('Validation Error: Missing "rewrite" data.');
  }

  return parsed;
}

// 5. generateProfile(role, profileText, tone)
async function generateProfile(role, profileText, tone) {
  const prompt = `You are a strict LinkedIn profile analyzer and optimizer.

Your job is to analyze and improve a LinkedIn profile WITHOUT inventing any information.DON't INVENT anything...just predict what should be

========================
🚨 STRICT RULES (MANDATORY)
========================
1. NEVER invent:
   - experience
   - projects
   - metrics (numbers, %, users, etc.)
   - technologies not mentioned in input

2. If something is missing:
   - write: "Not provided"
   - or use: "[Add metric here]"

3. Be realistic:
   - weak input → low scores
   - do NOT inflate

4. Output MUST be valid JSON ONLY
   - no explanation
   - no markdown
   - no extra text

5. If you break JSON format → response is INVALID

========================
INPUT
========================
Target Role: \${role}

Profile Content:
\${profileText}

========================
TASKS
========================

1. PROFILE ANALYSIS
Evaluate:
- clarity
- completeness
- keyword relevance for target role
- presence of measurable impact

---

2. SCORING (0–100)

Return:
- overall
- keyword
- clarity
- completeness

Rules:
- Very short input → score below 40
- No keywords → keyword score below 30
- No metrics → reduce overall score

---

3. TOP ISSUES (max 5)

Each issue must include:
- issue
- why_it_matters
- fix

Be specific, not generic.

---

4. SAFE REWRITE (NO HALLUCINATION)

ONLY improve wording of given content.

Allowed:
- better phrasing
- structure improvement

NOT allowed:
- adding fake achievements
- adding fake tools
- adding fake numbers

Use:
"[Add metric here]" where needed

Return:
- headline
- about (2–4 bullet points)
- experience (2–4 bullet points)

---

5. KEYWORDS

Return:
- present_keywords (from input only)
- missing_keywords (based on target role)

---

6. RECRUITER VIEW

Return:
- search_queries (2 realistic queries)
- visibility (Low / Medium / High)
- reason (short)

---

========================
OUTPUT FORMAT (STRICT JSON)
========================

{
  "scores": {
    "overall": 0,
    "keyword": 0,
    "clarity": 0,
    "completeness": 0
  },
  "issues": [
    {
      "issue": "",
      "why_it_matters": "",
      "fix": ""
    }
  ],
  "rewrite": {
    "headline": "",
    "about": [],
    "experience": []
  },
  "keywords": {
    "present": [],
    "missing": []
  },
  "recruiter_view": {
    "search_queries": [],
    "visibility": "",
    "reason": ""
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
