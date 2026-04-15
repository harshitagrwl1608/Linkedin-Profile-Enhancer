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
  const maxRetries = keyManager.entries.length;

  while (attempts < maxRetries) {
      // Add 1 second delay before EVERY API call
      await delay(1000);
      const apiKey = getApiKey();

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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

        if (status === 429) {
          keyManager.markRateLimited(apiKey);
        }

        if (attempts < maxRetries) {
          console.warn(`[WARN] AI API Error (${status || error.message}). Retrying with next available API key. (${attempts}/${maxRetries} attempts)`);
          await delay(1000);
          continue;
        } else {
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

  return parsed;
}

// 5. generateProfile(role, profileText, tone)
async function generateProfile(role, profileText, tone) {
  const basePrompt = `🧩 BASE SYSTEM PROMPT (USE IN ALL CALLS)
You are a strict LinkedIn profile optimizer.

GLOBAL CONTEXT:
- Role: ${role}
- Tone: ${tone}
- Keep consistency across all outputs

GLOBAL RULES (apply to ALL responses):
- Do NOT invent experience, projects, or metrics
- Only improve given content
- Use bullet points where applicable
- No fluff, no generic statements
- If data is missing, write "[Add details]"
- IMPORTANT TONE ENFORCEMENT: The output must strictly reflect the ${tone} tone. Adjust your vocabulary and style based on this direction.

IMPORTANT:
Your output must be consistent with other sections generated separately.
Do NOT contradict or introduce new information.

Return ONLY valid JSON.
`;

  const inputContext = `
========================
INPUT
========================
Target Role: ${role}
Tone: ${tone}

Profile Content:
${profileText}
`;

  const prompts = {
    headline: `1️⃣ HEADLINE PROMPT
Generate 3 optimized LinkedIn headlines.

Return:
{
  "headlines": [
    "professional version",
    "technical version",
    "bold version"
  ]
}`,
    about: `2️⃣ ABOUT PROMPT
Rewrite the About section.

Rules:
- 3–5 bullet points
- concise
- no fake metrics

Return:
{
  "about": [
    "...",
    "..."
  ]
}`,
    experience: `3️⃣ EXPERIENCE PROMPT
Rewrite experience section.

Rules:
- 3–5 bullet points
- action-oriented
- no fake metrics
- use "[Add metric here]" if needed

Return:
{
  "experience": [
    "...",
    "..."
  ]
}`,
    keywords: `4️⃣ KEYWORD PROMPT
Extract keywords.

Return:
{
  "present": [],
  "missing": []
}`,
    analysis: `5️⃣ ANALYSIS PROMPT
Generate profile scores, recruiter view, and top issues.

Rules:
- Evaluate clarity, completeness, keyword relevance, measurable impact
- Return valid JSON strictly matching this structure.

Return:
{
  "scores": {
    "overall": 0, "keyword": 0, "clarity": 0, "completeness": 0
  },
  "issues": [
    {
      "issue": "",
      "why_it_matters": "",
      "fix": ""
    }
  ],
  "recruiter_view": {
    "search_queries": [],
    "visibility": "Low | Medium | High",
    "reason": ""
  }
}`
  };

  const validations = {
    headline: (res) => { if (!res.headlines || !Array.isArray(res.headlines)) throw new Error("Invalid headline response"); },
    about: (res) => { if (!res.about || !Array.isArray(res.about)) throw new Error("Invalid about response"); },
    experience: (res) => { if (!res.experience || !Array.isArray(res.experience)) throw new Error("Invalid experience response"); },
    keywords: (res) => { if (!res.present || !Array.isArray(res.present)) throw new Error("Invalid keywords response"); },
    analysis: (res) => { if (!res.scores || typeof res.scores !== 'object' || !Array.isArray(res.issues)) throw new Error("Invalid analysis response"); }
  };

  const fallbacks = {
    headline: { headlines: ["", "", ""] },
    about: { about: [] },
    experience: { experience: [] },
    keywords: { present: [], missing: [] },
    analysis: { scores: { overall: 50, keyword: 50, clarity: 50, completeness: 50 }, issues: [], recruiter_view: { search_queries: [], visibility: "Low", reason: "Fallback generated due to partial AI error." } }
  };

  const executeSubtask = async (key, specificPrompt, context) => {
    let attempts = 0;
    const maxSubRetries = 3;
    const fullPrompt = `${basePrompt}\n${context}\n${specificPrompt}`;
    
    while (attempts < maxSubRetries) {
      try {
        const rawText = await callGemini(fullPrompt);
        const parsed = parseResponse(rawText);
        validations[key](parsed);
        return { key, status: "success", data: parsed };
      } catch (err) {
        attempts++;
        if (attempts >= maxSubRetries) {
          console.warn(`[WARN] AI sub-task ${key} permanently failed: ${err.message}. Using fallback.`);
          return { key, status: "fallback", data: fallbacks[key], error: err.message };
        }
      }
    }
  };

  // =========================
  // STAGE 1: Analysis Call
  // =========================
  const stage1Result = await executeSubtask('analysis', prompts.analysis, inputContext);
  
  if (stage1Result.status === "fallback") {
    const err = new Error('AI service busy. API keys exhausted or not connected.');
    err.status = 429;
    throw err;
  }

  const analysisData = stage1Result.data;
  const fallbackIssues = [];

  let formattedIssues = "No major issues identified.";
  if (analysisData.issues && analysisData.issues.length > 0) {
    formattedIssues = analysisData.issues.map(i => `- ${i.issue} (Fix: ${i.fix})`).join('\n');
  }

  // =========================
  // STAGE 2: Parallel Tasks
  // =========================
  const stage2Context = `${inputContext}
========================
IDENTIFIED PROFILE WEAKNESSES (Fix these during rewrite!)
========================
${formattedIssues}
`;

  const stage2Tasks = Object.entries(prompts)
    .filter(([key]) => key !== 'analysis')
    .map(([key, specificPrompt]) => executeSubtask(key, specificPrompt, stage2Context));
    
  const resultsList = await Promise.allSettled(stage2Tasks);
  
  const results = { analysis: analysisData };
  
  for (const item of resultsList) {
    if (item.status === "fulfilled") {
        const val = item.value;
        results[val.key] = val.data;
        if (val.status === "fallback") {
          const err = new Error(`AI service failure on subtask: ${val.key}`);
          err.status = 429;
          throw err;
        }
    }
  }

  // =========================
  // STAGE 4: Merge 
  // (Stage 3 logic is inherent in the validator mappings)
  // =========================
  const hl = results.headline || fallbacks.headline;
  const ab = results.about || fallbacks.about;
  const ex = results.experience || fallbacks.experience;
  const kw = results.keywords || fallbacks.keywords;

  const mergedIssues = [...(analysisData.issues || []), ...fallbackIssues];

  let finalJson = {
    scores: analysisData.scores,
    issues: mergedIssues,
    rewrite: {
      headline: hl.headlines,
      about: ab.about,
      experience: ex.experience
    },
    keywords: kw,
    recruiter_view: analysisData.recruiter_view || fallbacks.analysis.recruiter_view
  };

  // =========================
  // STAGE 5: Consistency Pass
  // =========================
  const consistencyPrompt = `5️⃣ FINAL CONSISTENCY PASS
Here is the independently generated data compiled into a single JSON object.
Your task: Review the JSON to ensure tone is perfectly consistent. Fix any obvious grammatical contradictions between About and Experience. Do NOT add new hallucinated achievements.

Return EXACTLY this JSON schema seamlessly updated:
${JSON.stringify(finalJson, null, 2)}`;

  try {
     const rawConsText = await callGemini(`${basePrompt}\n${consistencyPrompt}`);
     const consistentJson = parseResponse(rawConsText);
     
     // Soft validation hybrid verify
     if (consistentJson.scores && consistentJson.rewrite) {
         finalJson = consistentJson;
     } else {
         throw new Error("Consistency check returned malformed schema");
     }
  } catch (err) {
     console.warn("[WARN] Stage 5 Consistency Pass Failed:", err.message);
     finalJson.issues.push({
         issue: "Consistency Pass Alert",
         why_it_matters: "Tone might mismatch due to server overload",
         fix: "Final data passed without final consistency review."
     });
  }

  return finalJson;
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
