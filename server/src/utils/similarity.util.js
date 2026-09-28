/**
 * Lightweight Text Similarity Calculation Utility
 * Computes term vector cosine / n-gram overlap similarity score between two text strings
 * Returns a score between 0.0 (completely distinct) and 1.0 (identical)
 */

const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2); // Ignore short stop-words
};

const getTermFrequencies = (tokens) => {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  return tf;
};

/**
 * Calculate similarity score between two request texts (Title + Description)
 * @param {string} textA 
 * @param {string} textB 
 * @returns {number} Score between 0.0 and 1.0
 */
const calculateTextSimilarity = (textA, textB) => {
  if (!textA || !textB) return 0.0;

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const tfA = getTermFrequencies(tokensA);
  const tfB = getTermFrequencies(tokensB);

  const allTerms = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const term of allTerms) {
    const valA = tfA[term] || 0;
    const valB = tfB[term] || 0;
    dotProduct += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }

  if (magA === 0 || magB === 0) return 0.0;

  const cosineSimilarity = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  return parseFloat(cosineSimilarity.toFixed(4));
};

module.exports = {
  calculateTextSimilarity,
};
