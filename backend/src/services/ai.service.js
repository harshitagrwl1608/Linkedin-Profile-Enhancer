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
  if (!parsed.headline || typeof parsed.headline !== 'string') {
    throw new Error('Validation Error: Missing or invalid "headline" field.');
  }
  if (!parsed.about || typeof parsed.about !== 'string') {
    throw new Error('Validation Error: Missing or invalid "about" field.');
  }
  if (!Array.isArray(parsed.experience) || parsed.experience.length !== 4) {
    throw new Error(`Validation Error: "experience" array must be exactly 4 strings (Got ${parsed.experience ? parsed.experience.length : 'unknown'}).`);
  }
  if (!Array.isArray(parsed.projects) || parsed.projects.length !== 2) {
    throw new Error(`Validation Error: "projects" array must be exactly 2 strings (Got ${parsed.projects ? parsed.projects.length : 'unknown'}).`);
  }

  return parsed;
}

// 5. generateProfile(role, profileText, tone)
async function generateProfile(role, profileText, tone) {
  const prompt = `You are a top-tier technical recruiter.

Your task is to transform a weak LinkedIn profile into a strong, hireable candidate profile tailored to the TARGET ROLE and SELECTED TONE.

---

IMPORTANT:

The input may be weak or incomplete.

You MUST:

* Infer realistic experience
* Upgrade the candidate to a strong entry-level professional
* Make them appear ready for hiring

---

STRICT RULES:

* Output ONLY valid JSON
* No explanations, markdown, or comments
* No placeholders
* Do NOT use generic words:
  hardworking, passionate, motivated, experienced

---

TONE MODE (MANDATORY):

Generate a COMPLETELY NEW version for the SELECTED TONE.

Each tone must follow a different writing style:

* PROFESSIONAL → clean, formal, recruiter-friendly
* BOLD → strong, confident, impact-driven
* TECHNICAL → detailed, tools & systems focused
* FRIENDLY → natural, slightly conversational
* FAANG → sharp, high-impact, premium
* HUMBLE → simple, honest, beginner-level

CRITICAL:

* Do NOT reuse sentences across tones
* Rewrite wording completely
* Change sentence structure and vocabulary

---

ROLE ADAPTATION:

Adapt content to TARGET ROLE using relevant technologies.

---

CONTENT REQUIREMENTS:

1. HEADLINE:
   Format: ROLE | Tech1, Tech2, Tech3

---

2. ABOUT:

* 110–140 words
* Start directly with what the person builds
* Include work, tools, problems, focus

---

3. EXPERIENCE:
   Exactly 4 bullets

Each:

* Starts with Built / Designed / Implemented / Optimized / Developed
* Includes number + technology

---

4. PROJECTS:
   Exactly 2

Each:

* What was built
* Tech stack
* Measurable impact

---

5. AI ASSESSMENT SCORE (0-100):

Evaluate the profile broadly. Give a score from 0 to 100 based on:
* Impact (metrics, results, scale)
* Technology match for TARGET ROLE
* Content density (too short = lower score)
* Tone consistency

CRITICAL: Do NOT always return 50. Be critical. A weak profile should get 10-30. A great one 80-95.

---

OUTPUT FORMAT:

{
"score": number,
"headline": "string",
"about": "string",
"experience": ["string","string","string","string"],
"projects": ["string","string"],
"skills": ["string"]
}

---

FINAL VALIDATION:

* JSON valid
* 4 experience bullets
* 2 projects
* Tone clearly visible

---

TARGET ROLE:
\${role}

SELECTED TONE:
\${tone}

INPUT PROFILE:
\${profileText}`;

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
