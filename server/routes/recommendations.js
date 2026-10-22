const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const config = require('../config/env');
const logger = require('../utils/logger');

const ML_BASE_URL = config.ML_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Helper to call the Python FastAPI recommendation service with timeout and circuit-breaker handling.
 */
async function callMlService(endpoint, options = {}) {
  const url = `${ML_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const err = new Error(data?.detail || data?.message || `ML Service returned status ${response.status}`);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Recommendation service timed out.');
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    if (err.status) {
      throw err;
    }
    logger.error({ err, url }, '[Recommendations] Failed to connect to Python ML service');
    const connErr = new Error('Recommendation service is temporarily unavailable. Please verify the ML service is running.');
    connErr.status = 502;
    throw connErr;
  }
}

/**
 * @swagger
 * /api/recommendations/health:
 *   get:
 *     summary: Check Python ML recommendation microservice health
 *     tags: [Recommendations]
 *     responses:
 *       200:
 *         description: ML service is healthy and connected
 *       502:
 *         description: ML service is offline or unreachable
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const health = await callMlService('/health', { method: 'GET' });
    return res.json({
      success: true,
      mlService: health
    });
  } catch (err) {
    return res.status(err.status || 502).json({
      success: false,
      message: err.message || 'ML service unreachable'
    });
  }
}));

/**
 * @swagger
 * /api/recommendations:
 *   post:
 *     summary: Retrieve travel recommendations based on structured user preferences
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               travel_type:
 *                 type: string
 *               budget_level:
 *                 type: string
 *               companions:
 *                 type: string
 *               duration_days:
 *                 type: string
 *               region:
 *                 type: string
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Destination recommendation list with grounded explanations
 *       400:
 *         description: Invalid preference parameters
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: ML service unavailable
 */
router.post('/recommend', verifyToken, asyncHandler(async (req, res) => {
  const topN = parseInt(req.query.top_n, 10) || 5;
  const diversity = parseFloat(req.query.diversity) || 0.15;

  try {
    const data = await callMlService(`/recommend?top_n=${topN}&diversity=${diversity}`, {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    return res.json(data);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      message: err.message,
      detail: err.data?.detail
    });
  }
}));

/**
 * @swagger
 * /api/recommendations/chat:
 *   post:
 *     summary: Chat with TravelSync recommendation engine in natural language
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               previous_preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Parsed recommendations, conversational assistant response, and follow-ups
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: ML service unavailable
 */
router.post('/chat', verifyToken, asyncHandler(async (req, res) => {
  const { message, previous_preferences, direct_preference_update } = req.body || {};
  if ((!message || typeof message !== 'string' || !message.trim()) && !direct_preference_update) {
    return res.status(400).json({
      success: false,
      message: 'A non-empty "message" string or "direct_preference_update" is required.'
    });
  }

  try {
    const data = await callMlService('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: (message || '').trim(),
        previous_preferences: previous_preferences || null,
        direct_preference_update: direct_preference_update || null
      })
    });
    return res.json(data);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      message: err.message,
      detail: err.data?.detail
    });
  }
}));

module.exports = router;
