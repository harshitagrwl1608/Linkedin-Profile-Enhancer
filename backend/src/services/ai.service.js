require('dotenv').config();
const axios = require('axios');

// ENV SETUP
const API_KEYS = [
  process.env.GEMINI_API_KEY_1 || 'AIzaSyD8GmISGgJFOIAx41opG6h0mAHiTkiEcRI',
  process.env.GEMINI_API_KEY_2 || 'AIzaSyD8GmISGgJFOIAx41opG6h0mAHiTkiEcRI',
  process.env.GEMINI_API_KEY_3 || 'AIzaSyD8GmISGgJFOIAx41opG6h0mAHiTkiEcRI'
].filter(Boolean);

let currentKeyIndex = 0;
let isProcessing = false;

// 1. getApiKey()
function getApiKey() {
  if (API_KEYS.length === 0) {
    throw new Error('No API keys configured.');
  }
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

// 2. delay(ms)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 3. callGemini(prompt)
async function callGemini(prompt) {
  if (isProcessing) {
    throw new Error('Another request is currently processing. Please try again later.');
  }

  isProcessing = true;
  let attempts = 0;

  try {
    while (attempts < API_KEYS.length) {
      // Add 1 second delay before EVERY API call
      await delay(1000);
      const apiKey = getApiKey();

      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
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
          console.warn(`[WARN] 429 Rate Limit hit. Waiting 1500ms and retrying with next API key. (${attempts}/${API_KEYS.length} attempts)`);
          await delay(1500);
          continue;
        } else {
          // Do NOT retry for other errors
          throw new Error(`Gemini API Error: ${error.message}`);
        }
      }
    }
    throw new Error('All Gemini API keys failed due to 429 Rate Limits.');
  } finally {
    isProcessing = false; // Always clear the processing flag
  }
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

5. SKILLS:
   6–10 relevant skills

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
