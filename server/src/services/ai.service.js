const config = require('../config/env');
const prisma = require('../config/db');
const { calculateTextSimilarity } = require('../utils/similarity.util');

const VALID_CATEGORIES = ['IT', 'ELECTRICAL', 'PLUMBING', 'CLEANING', 'SECURITY', 'CLASSROOM', 'HOSTEL', 'TRANSPORT', 'OTHER'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Execute Gemini API call using native fetch with timeout protection
 * @param {string} prompt 
 * @param {number} timeoutMs 
 */
const callGeminiWithTimeout = async (prompt, timeoutMs = 15000, retries = 1) => {
  if (!config.aiApiKey) {
    throw new Error('AI Provider unconfigured (AI_API_KEY is empty)');
  }

  const modelName = config.aiModel || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.aiApiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    clearTimeout(timeoutId);

    // Retry once on transient 503 (Gemini overload under parallel calls)
    if (response.status === 503 && retries > 0) {
      await new Promise((res) => setTimeout(res, 2000));
      return callGeminiWithTimeout(prompt, timeoutMs, retries - 1);
    }

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw new Error('Gemini API response contained no text candidates');
    }

    return textOutput;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Gemini API request timed out');
    }
    throw error;
  }
};

/**
 * AI Request Classification
 * Analyzes request title & description to suggest an aiCategory (Advisory ONLY - never overwrites final category)
 */
const classifyRequest = async ({ title, description }, options = {}) => {
  try {
    const prompt = `Analyze the following campus issue request title and description.
Suggest the most accurate category from EXACTLY this list: [${VALID_CATEGORIES.join(', ')}].
Do not create any new categories.

Request Title: "${title}"
Request Description: "${description}"

Respond ONLY with valid JSON in this structure:
{
  "category": "PLUMBING",
  "confidence": 0.95,
  "reason": "Short 1-sentence reason"
}`;

    const text = await callGeminiWithTimeout(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Malformed AI JSON response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const categoryUpper = parsed.category ? parsed.category.toUpperCase() : null;

    if (!categoryUpper || !VALID_CATEGORIES.includes(categoryUpper)) {
      console.warn(`AI returned invalid category "${parsed.category}". Falling back to null.`);
      return null;
    }

    return {
      category: categoryUpper,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
      reason: parsed.reason || 'AI category classification',
    };
  } catch (error) {
    console.warn('AI Classification unavailable (non-blocking fallback):', error.message);
    if (options.throwOnError) {
      throw error;
    }
    return null;
  }
};

/**
 * AI Priority Suggestion
 * Analyzes issue urgency to suggest aiPriority & reasoning (Advisory ONLY - never overwrites final priority)
 */
const suggestPriority = async ({ title, description, category }, options = {}) => {
  try {
    const prompt = `Analyze urgency for campus issue:
Title: "${title}"
Description: "${description}"
Category: "${category}"

Suggest priority from EXACTLY this list: [${VALID_PRIORITIES.join(', ')}].
Consider safety risks (e.g. water near electricity = CRITICAL/HIGH).

Respond ONLY with valid JSON:
{
  "priority": "HIGH",
  "confidence": 0.90,
  "reason": "1-sentence explanation of urgency"
}`;

    const text = await callGeminiWithTimeout(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Malformed AI JSON response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const priorityUpper = parsed.priority ? parsed.priority.toUpperCase() : null;

    if (!priorityUpper || !VALID_PRIORITIES.includes(priorityUpper)) {
      console.warn(`AI returned invalid priority "${parsed.priority}". Falling back to null.`);
      return null;
    }

    return {
      priority: priorityUpper,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.80,
      reason: parsed.reason || 'AI priority assessment',
    };
  } catch (error) {
    console.warn('AI Priority suggestion unavailable (non-blocking fallback):', error.message);
    if (options.throwOnError) {
      throw error;
    }
    return null;
  }
};

/**
 * Duplicate / Similar Request Detection
 * Compares target request against existing candidate requests
 */
const findSimilarRequests = async (targetRequest) => {
  try {
    const targetText = `${targetRequest.title} ${targetRequest.description}`;

    const candidates = await prisma.serviceRequest.findMany({
      where: {
        id: { not: targetRequest.id },
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        category: true,
        priority: true,
        createdAt: true,
      },
      take: 100,
    });

    const threshold = config.similarityThreshold || 0.80;
    const matches = [];

    for (const cand of candidates) {
      const candText = `${cand.title} ${cand.description}`;
      const score = calculateTextSimilarity(targetText, candText);

      if (score >= threshold) {
        matches.push({
          similarRequestId: cand.id,
          similarRequest: cand,
          similarityScore: score,
        });
      }
    }

    matches.sort((a, b) => b.similarityScore - a.similarityScore);
    return matches.slice(0, 5);
  } catch (error) {
    console.warn('Similar request detection error:', error.message);
    return [];
  }
};

/**
 * AI Resolution Suggestions
 * Generates practical resolution advice for staff/admin
 */
const generateResolutionSuggestion = async (request) => {
  try {
    const prompt = `You are an expert campus facility operations manager.
Provide a clear, practical, step-by-step resolution suggestion for staff executing this request.

Request Title: "${request.title}"
Description: "${request.description}"
Category: "${request.category}"
Priority: "${request.priority}"
Current Status: "${request.status}"

Provide actionable steps to investigate, repair, and verify resolution.
Do not automatically resolve the ticket.

Respond with concise markdown advice.`;

    const textOutput = await callGeminiWithTimeout(prompt);
    return {
      suggestion: textOutput,
    };
  } catch (error) {
    console.warn('AI Resolution generation unavailable (non-blocking fallback):', error.message);
    return {
      suggestion: 'Standard resolution procedure: Perform site inspection, troubleshoot symptoms, repair root cause, and confirm resolution with campus requester.',
      isFallback: true,
    };
  }
};

/**
 * Non-blocking Background AI Processing on Request Creation
 * Populates aiCategory, aiPriority, aiPriorityReason, aiProcessedAt, and RequestSimilarity
 * NEVER overwrites user's final category or priority!
 */
const processAiInsightsForRequest = async (requestId) => {
  try {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) return;

    // Sequential to avoid parallel Gemini 503 rate-limit errors
    const classResult = await classifyRequest({ title: request.title, description: request.description });
    const prioResult = await suggestPriority({ title: request.title, description: request.description, category: request.category });
    const similarMatches = await findSimilarRequests(request);

    const updateData = {
      aiProcessedAt: new Date(),
    };

    if (classResult && classResult.category) {
      updateData.aiCategory = classResult.category;
    }

    if (prioResult && prioResult.priority) {
      updateData.aiPriority = prioResult.priority;
      updateData.aiPriorityReason = prioResult.reason;
    }

    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    for (const match of similarMatches) {
      await prisma.requestSimilarity.upsert({
        where: {
          requestId_similarRequestId: {
            requestId: request.id,
            similarRequestId: match.similarRequestId,
          },
        },
        update: {
          similarityScore: match.similarityScore,
        },
        create: {
          requestId: request.id,
          similarRequestId: match.similarRequestId,
          similarityScore: match.similarityScore,
        },
      });
    }
  } catch (error) {
    console.warn(`AI Processing failed for request ${requestId} (Non-blocking fallback applied):`, error.message);
  }
};

module.exports = {
  classifyRequest,
  suggestPriority,
  findSimilarRequests,
  generateResolutionSuggestion,
  processAiInsightsForRequest,
};
