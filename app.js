/* ============================================================
   LinkedIn Profile Optimizer — app.js
   Calls the Node.js backend API (/api/profile/full-report)
   ============================================================ */

// ——— State ———
let selectedTone = 'Professional & Polished';
let lastRawResponse = '';

// ——— Backend base URL ———
const BACKEND_URL = 'http://localhost:5000';

// ——— Tone selection ———
document.querySelectorAll('.tone-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTone = btn.dataset.tone;
  });
});

// ——— Char counter ———
const profileText = document.getElementById('profileText');
const charCount   = document.getElementById('charCount');
profileText.addEventListener('input', () => {
  charCount.textContent = profileText.value.length.toLocaleString();
});

// ——— Tab switching ———
const tabsBar    = document.querySelector('.tabs-bar');
const tabContent = document.getElementById('tabContent');

tabsBar.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTab(btn.dataset.tab);
});

// ——— Re-analyze ———
document.getElementById('reAnalyzeBtn').addEventListener('click', () => {
  document.getElementById('resultsSection').hidden = true;
  document.getElementById('formCard').scrollIntoView({ behavior: 'smooth' });
});

// ——— Copy full report ———
document.getElementById('copyAllBtn').addEventListener('click', () => {
  if (!lastRawResponse) return;
  navigator.clipboard.writeText(lastRawResponse).then(() => {
    const btn = document.getElementById('copyAllBtn');
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy Full Report`;
    }, 2000);
  });
});

// ——— Main Form Submit ———
document.getElementById('optimizerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const targetRole = document.getElementById('targetRole').value.trim();
  const profile    = document.getElementById('profileText').value.trim();

  // Validate
  if (!targetRole) return showError('Please enter your target role.');
  if (!profile)    return showError('Please paste your LinkedIn profile content.');

  // Tone mapping (backend uses lowercase)
  const toneMap = {
    'Professional & Polished'  : 'professional',
    'Bold & Confident'         : 'confident',
    'Technical & Data-Driven'  : 'technical',
    'Friendly & Approachable'  : 'friendly',
    'FAANG-level Executive'    : 'faang',
    'Humble & Collaborative'   : 'humble'
  };
  const tone = toneMap[selectedTone] || 'professional';

  hideError();
  setLoading(true);

  try {
    const data = await callBackend(profile, targetRole, tone);
    lastRawResponse = JSON.stringify(data, null, 2);
    renderResults(data, targetRole);
  } catch (err) {
    showError(err.message || 'Backend error. Make sure the server is running on localhost:5000.');
  } finally {
    setLoading(false);
  }
});

// ===== Call Backend API =====
async function callBackend(profileText, targetRole, tone) {
  const res = await fetch(`${BACKEND_URL}/api/profile/full-report`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ profileText, targetRole, tone })
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.errors?.[0]?.msg || json.error || `HTTP ${res.status}`);
  }

  // Map backend response to frontend's expected shape
  const d = json.data;
  return {
    overallScore    : d.overallScore,
    visibilityScore : d.visibilityScore,
    rankingChance   : d.rankingChance,
    evaluation: {
      summary        : d.evaluation?.summary,
      strengths      : d.evaluation?.strengths,
      weakSections   : (d.evaluation?.weakSections || []).map((w, i) => ({
        section: w.section || `Issue ${i+1}`,
        issue  : w.issue,
        fix    : w.fix
      })),
      missingKeywords: d.evaluation?.missingKeywords
    },
    rewrite: {
      headlineCorporate  : d.rewrite?.headlineCorporate,
      headlineStartup    : d.rewrite?.headlineStartup,
      headlineFAANG      : d.rewrite?.headlineFAANG,
      aboutSection       : d.rewrite?.aboutSection,
      experienceRewrite  : d.rewrite?.experienceRewrite,
      projectsRewrite    : d.rewrite?.projectsRewrite,
      finalProfile       : d.rewrite?.finalProfile
    },
    keywords: {
      present  : d.keywords?.present,
      missing  : d.keywords?.missing,
      suggested: d.keywords?.suggested
    },
    benchmark: {
      percentile        : d.benchmark?.percentile,
      gaps              : d.benchmark?.gaps,
      topCandidateTraits: d.benchmark?.topCandidateTraits
    },
    recruiterSim: {
      visibilityScore: d.recruiterSim?.visibilityScore,
      rankingChance  : d.recruiterSim?.rankingChance,
      searchQuery    : d.recruiterSim?.searchQuery,
      appearInSearch : d.recruiterSim?.appearInSearch,
      improvements   : d.recruiterSim?.improvements
    },
    aiAssessment: d.aiAssessment,
    actionPlan: d.actionPlan
  };
}

// ===== Legacy (unused — kept for reference) =====
function buildPrompt(role, url, profile, tone) {
  return `
You are a world-class LinkedIn profile optimizer and tech recruiter with 10+ years of hiring experience at top companies including FAANG, unicorn startups, and Fortune 500 firms.

Analyze the following LinkedIn profile for the target role and provide a deeply structured, brutally honest, and specific optimization report.

TARGET ROLE: ${role}
LINKEDIN URL: ${url || 'Not provided'}
DESIRED TONE: ${tone}

PROFILE CONTENT:
---
${profile}
---

Respond ONLY in the following strict JSON format (no markdown, no extra text, just valid JSON):

{
  "overallScore": <number 0-100>,
  "visibilityScore": <number 0-100>,
  "rankingChance": "<e.g. Top 15%>",

  "evaluation": {
    "summary": "<2-3 sentence brutally honest evaluation>",
    "missingKeywords": ["keyword1", "keyword2", ...],
    "weakSections": [
      { "section": "<section name>", "issue": "<specific issue>", "fix": "<specific fix>" }
    ],
    "strengths": ["<strength 1>", "<strength 2>", ...]
  },

  "rewrite": {
    "headlineCorporate": "<corporate style headline, max 220 chars>",
    "headlineStartup": "<startup style headline, max 220 chars>",
    "headlineFAANG": "<FAANG executive style headline, max 220 chars>",
    "aboutSection": "<3-4 paragraph story-driven, tone-matched About section>",
    "experienceRewrite": [
      {
        "role": "<job title at company>",
        "bullets": ["<impact bullet with metric>", "<impact bullet with metric>", ...]
      }
    ]
  },

  "keywords": {
    "present": ["<keyword found in profile>", ...],
    "missing": ["<critical missing keyword>", ...],
    "suggested": ["<additional high-impact keyword>", ...]
  },

  "benchmark": {
    "percentile": "<e.g. Top 30% for this role>",
    "gaps": [
      { "area": "<skill/project/experience area>", "gap": "<what's missing>", "howToFix": "<specific action>" }
    ],
    "topCandidateTraits": ["<trait top 10% have>", ...]
  },

  "recruiterSim": {
    "visibilityScore": <number 0-100>,
    "rankingChance": "<text>",
    "searchQuery": "<sample Boolean search string a recruiter might use>",
    "appearInSearch": <true|false>,
    "improvements": ["<specific improvement>", ...]
  },

  "actionPlan": [
    {
      "step": <number>,
      "title": "<action title>",
      "description": "<specific, actionable description>",
      "priority": "high|medium|low",
      "impact": "<expected impact>"
    }
  ]
}
`;
}

// ===== Call Gemini API =====
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty response from Gemini. Please try again.');
  return raw;
}

// ===== Parse JSON Response =====
function parseResponse(text) {
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Could not parse Gemini response. Please try again.');
  }
}

// ===== Render Results =====
let parsedData = null;

function renderResults(data, role) {
  parsedData = data;

  // Show section
  const resultsSection = document.getElementById('resultsSection');
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Score row
  const analyzerScore = data.overallScore || 0;
  const aiScore = data.aiAssessment?.score || analyzerScore;
  const scoreClass = analyzerScore >= 70 ? 'high' : analyzerScore >= 45 ? 'mid' : 'low';
  const aiScoreClass = aiScore >= 70 ? 'high' : aiScore >= 45 ? 'mid' : 'low';
  document.getElementById('scoreRow').innerHTML = `
    <div class="score-chip">
      <div>
        <div class="score-label">Analyzer Score</div>
        <div class="score-value ${scoreClass}">${analyzerScore}<span style="font-size:1rem;color:var(--text-muted)">/100</span></div>
      </div>
    </div>
    <div class="score-chip">
      <div>
        <div class="score-label">AI Score</div>
        <div class="score-value ${aiScoreClass}">${aiScore}<span style="font-size:1rem;color:var(--text-muted)">/100</span></div>
      </div>
    </div>
    <div class="score-chip">
      <div>
        <div class="score-label">Visibility</div>
        <div class="score-value ${(data.visibilityScore||0) >= 70 ? 'high' : (data.visibilityScore||0) >= 45 ? 'mid' : 'low'}">${data.visibilityScore || '—'}<span style="font-size:1rem;color:var(--text-muted)">/100</span></div>
      </div>
    </div>
    <div class="score-chip">
      <div>
        <div class="score-label">Ranking Estimate</div>
        <div style="font-size:1rem;font-weight:700;color:var(--accent);margin-top:2px">${data.rankingChance || '—'}</div>
      </div>
    </div>
    <div class="score-bar-wrap">
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;font-weight:600">PROFILE STRENGTH</div>
      <div class="score-bar-track">
        <div class="score-bar-fill" id="scoreBarFill" style="width:0%"></div>
      </div>
    </div>
  `;
  // Animate bar
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = document.getElementById('scoreBarFill');
      if (fill) fill.style.width = Math.max(analyzerScore, aiScore) + '%';
    });
  });

  // Activate first tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="evaluation"]').classList.add('active');
  renderTab('evaluation');
}

// ===== Render a Tab =====
function renderTab(tab) {
  if (!parsedData) return;
  const d = parsedData;
  let html = '';

  switch (tab) {
    case 'evaluation':
      html = renderEvaluation(d.evaluation);
      break;
    case 'rewrite':
      html = renderRewrite(d.rewrite);
      break;
    case 'keywords':
      html = renderKeywords(d.keywords);
      break;
    case 'benchmark':
      html = renderBenchmark(d.benchmark);
      break;
    case 'recruiter':
      html = renderRecruiter(d.recruiterSim);
      break;
    case 'action':
      html = renderActionPlan(d.actionPlan);
      break;
    default:
      html = '<p>Tab not found.</p>';
  }
  tabContent.innerHTML = html;
  addCopyButtons();
}

// ===== Section Renderers =====

function renderEvaluation(ev) {
  if (!ev) return '<p class="prose" style="color:var(--text-muted)">No evaluation data found.</p>';
  const ai = parsedData?.aiAssessment?.diagnosis || {};
  return `
    <div class="section-title">📊 Profile Evaluation</div>
    
    <div class="result-card">
      <h4>AI Diagnosis summary</h4>
      <p class="prose">${esc(ai.summary || ev.summary || '')}</p>
    </div>

    ${ai.criticalIssues?.length ? `
    <div class="result-card" style="border-color:rgba(239,68,68,0.4)">
      <h4>🚨 Critical Issues</h4>
      <ul>${ai.criticalIssues.map(c => `<li style="color:var(--red)">${esc(c)}</li>`).join('')}</ul>
    </div>` : ''}

    ${ai.quickWins?.length ? `
    <div class="result-card" style="border-color:rgba(16,185,129,0.4)">
      <h4>⚡ Quick Wins</h4>
      <ul>${ai.quickWins.map(q => `<li style="color:var(--green)">${esc(q)}</li>`).join('')}</ul>
    </div>` : ''}

    ${ev.weakSections?.length && (!ai.criticalIssues || ai.criticalIssues.length === 0) ? `
    <div class="result-card">
      <h4>⚠️ Weak Sections</h4>
      ${ev.weakSections.map(w => `
        <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700;color:var(--text);font-size:0.9rem;margin-bottom:4px">📌 ${esc(w.section)}</div>
          <div style="color:var(--red);font-size:0.85rem;margin-bottom:4px">Issue: ${esc(w.issue)}</div>
          <div style="color:var(--green);font-size:0.85rem">Fix: ${esc(w.fix)}</div>
        </div>`).join('')}
    </div>` : ''}
    
    ${ev.missingKeywords?.length ? `
    <div class="result-card">
      <h4>🔍 Missing Keywords (at a glance)</h4>
      <div class="tag-cloud">${ev.missingKeywords.map(k => `<span class="tag missing">${esc(k)}</span>`).join('')}</div>
    </div>` : ''}
  `;
}

function renderRewrite(rw) {
  if (!rw) return '<p class="prose" style="color:var(--text-muted)">No rewrite data found.</p>';
  return `
    <div class="section-title">✍️ AI-Rewritten Content</div>
    <div class="result-card" data-copy-group="headlines">
      <h4>📌 Headlines (3 Variations)</h4>
      ${headlineCard('🏢 Corporate', rw.headlineCorporate)}
      ${headlineCard('🚀 Startup', rw.headlineStartup)}
      ${headlineCard('⚡ FAANG-Level', rw.headlineFAANG)}
    </div>
    <div class="result-card">
      <h4>📝 About Section (Story-Driven)</h4>
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="copy-snippet-btn" onclick="copyText(${JSON.stringify(rw.aboutSection || '')})">
          Copy
        </button>
      </div>
      <p class="prose" style="white-space:pre-line">${esc(rw.aboutSection || '')}</p>
    </div>
    ${rw.experienceRewrite?.length ? `
    <div class="result-card">
      <h4>💼 Experience Rewrite (Impact-Focused)</h4>
      ${rw.experienceRewrite.map(exp => `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700;color:var(--accent-2);font-size:0.9rem;margin-bottom:8px">${esc(exp.title || exp.role)}</div>
          <ul>${(exp.bullets || []).map(b => `<li style="font-size:0.87rem;color:var(--text-muted);margin-bottom:4px">${esc(b)}</li>`).join('')}</ul>
        </div>`).join('')}
    </div>` : ''}
    ${rw.projectsRewrite?.length ? `
    <div class="result-card">
      <h4>🛠️ Projects Rewrite (Metrics-Driven)</h4>
      ${rw.projectsRewrite.map(proj => `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700;color:var(--accent);font-size:0.9rem;margin-bottom:8px">${esc(proj.name)}</div>
          <p style="font-size:0.87rem;color:var(--text-muted);line-height:1.5">${esc(proj.description)}</p>
        </div>`).join('')}
    </div>` : ''}

    ${rw.finalProfile ? `
    <div class="result-card" style="border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.05);margin-top:24px">
      <h4 style="color:var(--green)">🏆 Final Ready-To-Copy Profile</h4>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">The ultimate, fully-transformed profile. Just copy and paste this into LinkedIn.</p>
      
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Headline</div>
          <button class="copy-snippet-btn" onclick="copyText(${JSON.stringify(rw.finalProfile.headline || '')})">Copy</button>
        </div>
        <div style="font-size:1rem;font-weight:700;color:var(--text)">${esc(rw.finalProfile.headline)}</div>
      </div>
      
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">About</div>
          <button class="copy-snippet-btn" onclick="copyText(${JSON.stringify(rw.finalProfile.about || '')})">Copy</button>
        </div>
        <p class="prose" style="white-space:pre-line;font-size:0.9rem">${esc(rw.finalProfile.about)}</p>
      </div>
      
      ${rw.finalProfile.experience?.length ? `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Experience Bullets</div>
          <button class="copy-snippet-btn" onclick="copyText(${JSON.stringify(rw.finalProfile.experience.join('\\n'))})">Copy All</button>
        </div>
        <ul style="padding-left:20px">${rw.finalProfile.experience.map(eb => `<li style="font-size:0.9rem;color:var(--text-muted);margin-bottom:6px">${esc(eb)}</li>`).join('')}</ul>
      </div>` : ''}

      ${rw.finalProfile.projects?.length ? `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Projects</div>
          <button class="copy-snippet-btn" onclick="copyText(${JSON.stringify(rw.finalProfile.projects.join('\\n\\n'))})">Copy All</button>
        </div>
        <div class="prose" style="white-space:pre-line;font-size:0.9rem;color:var(--text-muted)">${esc(rw.finalProfile.projects.join('\\n\\n'))}</div>
      </div>` : ''}
    </div>
    ` : ''}
  `;
}

function headlineCard(label, text) {
  if (!text) return '';
  return `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px">
      <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${label}</div>
      <div style="font-size:0.95rem;font-weight:600;color:var(--text);line-height:1.5">${esc(text)}</div>
      <button class="copy-snippet-btn" onclick="copyText(${JSON.stringify(text)})" style="margin-top:8px">Copy</button>
    </div>
  `;
}

function renderKeywords(kw) {
  if (!kw) return '<p class="prose" style="color:var(--text-muted)">No keyword data found.</p>';
  return `
    <div class="section-title">🔑 Keyword Optimization</div>
    ${kw.present?.length ? `
    <div class="result-card">
      <h4>✅ Keywords Present in Your Profile</h4>
      <div class="tag-cloud">${kw.present.map(k => `<span class="tag present">${esc(k)}</span>`).join('')}</div>
    </div>` : ''}
    ${kw.missing?.length ? `
    <div class="result-card">
      <h4>❌ Critical Missing Keywords</h4>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Add these ASAP — recruiters search for them.</p>
      <div class="tag-cloud">${kw.missing.map(k => `<span class="tag missing">${esc(k)}</span>`).join('')}</div>
    </div>` : ''}
    ${kw.suggested?.length ? `
    <div class="result-card">
      <h4>💡 High-Impact Keywords to Add</h4>
      <div class="tag-cloud">${kw.suggested.map(k => `<span class="tag suggested">${esc(k)}</span>`).join('')}</div>
    </div>` : ''}
  `;
}

function renderBenchmark(bm) {
  if (!bm) return '<p class="prose" style="color:var(--text-muted)">No benchmark data found.</p>';
  return `
    <div class="section-title">📈 Benchmark vs Top Candidates</div>
    <div class="result-card" style="border-color:rgba(139,92,246,0.3)">
      <h4>Your Percentile Estimate</h4>
      <div style="font-family:'Outfit',sans-serif;font-size:1.8rem;font-weight:900;color:var(--accent)">${esc(bm.percentile || '—')}</div>
    </div>
    ${bm.topCandidateTraits?.length ? `
    <div class="result-card">
      <h4>🏆 What Top 10% Candidates Have</h4>
      <ul>${bm.topCandidateTraits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>` : ''}
    ${bm.gaps?.length ? `
    <div class="result-card">
      <h4>🚧 Your Gaps & How to Close Them</h4>
      ${bm.gaps.map(g => `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700;color:var(--text);font-size:0.9rem;margin-bottom:4px">📌 ${esc(g.area)}</div>
          <div style="color:var(--red);font-size:0.85rem;margin-bottom:4px">Gap: ${esc(g.gap)}</div>
          <div style="color:var(--green);font-size:0.85rem">Action: ${esc(g.howToFix)}</div>
        </div>`).join('')}
    </div>` : ''}
  `;
}

function renderRecruiter(rs) {
  if (!rs) return '<p class="prose" style="color:var(--text-muted)">No recruiter simulation data found.</p>';
  const vs = rs.visibilityScore || 0;
  const circumference = 2 * Math.PI * 54; // r=54
  const offset = circumference - (vs / 100) * circumference;
  const color = vs >= 70 ? '#10b981' : vs >= 45 ? '#f59e0b' : '#ef4444';
  return `
    <div class="section-title">🔍 Recruiter Simulation</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
      <div class="result-card" style="flex:0 0 auto;text-align:center;min-width:180px">
        <h4>Recruiter Visibility</h4>
        <div class="visibility-ring">
          <svg width="130" height="130" class="ring-svg">
            <circle class="ring-track" cx="65" cy="65" r="54"/>
            <circle class="ring-fill" cx="65" cy="65" r="54"
              stroke="${color}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"/>
            <text class="ring-label" x="65" y="60" style="fill:var(--text)">${vs}</text>
            <text class="ring-sublabel" x="65" y="78" style="fill:var(--text-muted)">/ 100</text>
          </svg>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted)">Ranking: <strong style="color:var(--accent)">${esc(rs.rankingChance || '—')}</strong></div>
        <div style="margin-top:8px;font-size:0.78rem;padding:4px 10px;border-radius:999px;display:inline-block;background:${rs.appearInSearch ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${rs.appearInSearch ? '#6ee7b7' : '#fca5a5'}">
          ${rs.appearInSearch ? '✓ Would appear in search' : '✗ May not appear in search'}
        </div>
      </div>
      <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:14px">
        ${rs.searchQuery ? `
        <div class="result-card" style="word-break:break-all">
          <h4>🔎 Sample Recruiter Search Query</h4>
          <code style="font-size:0.8rem;color:var(--accent-2);line-height:1.8">${esc(rs.searchQuery)}</code>
        </div>` : ''}
        ${rs.improvements?.length ? `
        <div class="result-card">
          <h4>🚀 Basic Visibility Improvements</h4>
          <ul>${rs.improvements.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>` : ''}
        ${parsedData.aiAssessment?.recruiterBoostTips?.length ? `
        <div class="result-card" style="border-color:rgba(139,92,246,0.3)">
          <h4>✨ AI Recruiter Boost Tips</h4>
          <ul>${parsedData.aiAssessment.recruiterBoostTips.map(t => `<li style="color:var(--accent)">${esc(t)}</li>`).join('')}</ul>
        </div>` : ''}
      </div>
    </div>
  `;
}

function renderActionPlan(steps) {
  if (!steps?.length) return '<p class="prose" style="color:var(--text-muted)">No action plan data found.</p>';
  return `
    <div class="section-title">⚡ Step-by-Step Action Plan</div>
    <div class="result-card">
      <h4>Priority-Ordered Roadmap</h4>
      <div>
        ${steps.map(s => `
          <div class="action-step">
            <div class="step-num">${s.step}</div>
            <div class="step-content">
              <h4>${esc(s.title)}</h4>
              <p>${esc(s.description)}</p>
              ${s.impact ? `<p style="margin-top:6px;color:var(--accent-2);font-size:0.82rem">📈 Impact: ${esc(s.impact)}</p>` : ''}
              <span class="step-priority priority-${s.priority === 'high' ? 'high' : s.priority === 'medium' ? 'med' : 'low'}">${esc(s.priority || 'medium')}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ===== Copy Snippet Buttons =====
function addCopyButtons() {
  // handled inline via onclick
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(console.error);
}

// ===== Utility =====
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoading(on) {
  const btn    = document.getElementById('submitBtn');
  const btext  = btn.querySelector('.btn-text');
  const bload  = btn.querySelector('.btn-loader');
  btn.disabled = on;
  btext.hidden = on;
  bload.hidden = !on;
}

function showError(msg) {
  const banner = document.getElementById('errorBanner');
  document.getElementById('errorMsg').textContent = msg;
  banner.hidden = false;
  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  document.getElementById('errorBanner').hidden = true;
}

// ===== Copy snippet button styles (injected) =====
const styleEl = document.createElement('style');
styleEl.textContent = `
  .copy-snippet-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
    display:block;
  }
  .copy-snippet-btn:hover { color: var(--text); border-color: var(--border-hover); }
`;
document.head.appendChild(styleEl);
