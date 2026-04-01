/**
 * profile.routes.js
 * Defines all /api/profile/* routes with inline input validation.
 */

const express = require('express');
const ctrl    = require('../controllers/profile.controller');

const router = express.Router();

// Simple inline validator middleware (no express-validator dependency)
function validateProfileInput(req, res, next) {
  const { profileText, targetRole } = req.body;
  const errors = [];

  if (!profileText || typeof profileText !== 'string' || profileText.trim().length < 20) {
    errors.push({ param: 'profileText', msg: 'profileText must be a string of at least 20 characters.' });
  }
  if (!targetRole || typeof targetRole !== 'string' || targetRole.trim().length < 2) {
    errors.push({ param: 'targetRole', msg: 'targetRole must be a string of at least 2 characters.' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Normalize
  req.body.profileText = profileText.trim();
  req.body.targetRole  = targetRole.trim();
  if (req.body.tone) req.body.tone = req.body.tone.trim().toLowerCase();

  next();
}

/**
 * POST /api/profile/analyze
 * Runs analysis engine only (fast — no AI).
 */
router.post('/analyze', validateProfileInput, ctrl.analyze);

/**
 * POST /api/profile/enhance
 * Calls Gemini AI to rewrite profile content.
 */
router.post('/enhance', validateProfileInput, ctrl.enhance);

/**
 * POST /api/profile/benchmark
 * Compares profile to ideal candidate template.
 */
router.post('/benchmark', validateProfileInput, ctrl.runBenchmark);

/**
 * POST /api/profile/full-report
 * Combines analysis + AI enhancement + benchmark + recruiter simulation.
 */
router.post('/full-report', validateProfileInput, ctrl.fullReport);

module.exports = router;
