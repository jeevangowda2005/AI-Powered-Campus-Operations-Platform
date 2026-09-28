const requestService = require('../services/request.service');
const aiService = require('../services/ai.service');
const prisma = require('../config/db');

/**
 * AI Classify Endpoint
 * POST /api/ai/classify/:requestId
 */
const classify = async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.requestId, req.user);
    const result = await aiService.classifyRequest({
      title: request.title,
      description: request.description,
    });

    // Persist the AI suggestion to DB so it survives page refresh
    if (result && result.category) {
      await prisma.serviceRequest.update({
        where: { id: request.id },
        data: { aiCategory: result.category },
      });
    }

    return res.status(200).json({
      success: true,
      message: result ? 'AI classification completed' : 'AI classification unavailable (fallback applied)',
      data: {
        aiCategory: result ? result.category : null,
        confidence: result ? result.confidence : null,
        reason: result ? result.reason : 'AI service fallback',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI Priority Suggestion Endpoint
 * POST /api/ai/suggest-priority/:requestId
 */
const suggestPriority = async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.requestId, req.user);
    const result = await aiService.suggestPriority({
      title: request.title,
      description: request.description,
      category: request.category,
    });

    // Persist the AI suggestion to DB so it survives page refresh
    if (result && result.priority) {
      await prisma.serviceRequest.update({
        where: { id: request.id },
        data: {
          aiPriority: result.priority,
          aiPriorityReason: result.reason || null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: result ? 'AI priority analysis completed' : 'AI priority analysis unavailable (fallback applied)',
      data: {
        aiPriority: result ? result.priority : null,
        confidence: result ? result.confidence : null,
        reason: result ? result.reason : 'AI service fallback',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Duplicate / Similar Requests Endpoint
 * GET /api/ai/similar/:requestId
 */
const getSimilar = async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.requestId, req.user);

    // Fetch computed similarities from database
    const dbSimilarities = await prisma.requestSimilarity.findMany({
      where: { requestId: request.id },
      include: {
        similarRequest: {
          select: {
            id: true,
            title: true,
            category: true,
            priority: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { similarityScore: 'desc' },
    });

    let similarRequests = dbSimilarities.map((item) => ({
      requestId: item.similarRequestId,
      title: item.similarRequest.title,
      status: item.similarRequest.status,
      category: item.similarRequest.category,
      priority: item.similarRequest.priority,
      similarityScore: item.similarityScore,
    }));

    // If no DB similarities exist yet, compute dynamically
    if (similarRequests.length === 0) {
      const dynamicMatches = await aiService.findSimilarRequests(request);
      similarRequests = dynamicMatches.map((m) => ({
        requestId: m.similarRequestId,
        title: m.similarRequest.title,
        status: m.similarRequest.status,
        category: m.similarRequest.category,
        priority: m.similarRequest.priority,
        similarityScore: m.similarityScore,
      }));
    }

    return res.status(200).json({
      success: true,
      data: { similarRequests },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI Resolution Suggestion Endpoint (STAFF & ADMIN ONLY)
 * POST /api/ai/resolution/:requestId
 */
const generateResolution = async (req, res, next) => {
  try {
    // Strictly restrict resolution suggestions to STAFF and ADMIN
    if (!['STAFF', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: AI resolution suggestions are restricted to Staff and Admins',
      });
    }

    const request = await requestService.getRequestById(req.params.requestId, req.user);
    const result = await aiService.generateResolutionSuggestion(request);

    return res.status(200).json({
      success: true,
      data: {
        suggestion: result.suggestion,
        isFallback: !!result.isFallback,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  classify,
  suggestPriority,
  getSimilar,
  generateResolution,
};
