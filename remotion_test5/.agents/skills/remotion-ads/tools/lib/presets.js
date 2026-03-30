/**
 * Character presets and timing configuration
 */

// Timing thresholds for validation
const TIMING_CONFIG = {
  maxDurationDiffPercent: 15,
  maxLeadingSilenceMs: 200,
  maxTrailingSilenceMs: 500,
  minWordsPerSecond: 2.0,
  maxWordsPerSecond: 4.5,
  idealWordsPerSecond: 3.0,
};

// Character/narrator presets
const CHARACTER_PRESETS = {
  literal: {
    name: 'Literal',
    description: 'Reads text exactly as written',
    stability: 0.5,
    similarity: 0.75,
    style: 0.0,
  },
  narrator: {
    name: 'Narrator',
    description: 'Professional storyteller, smooth transitions, engaging',
    stability: 0.65,
    similarity: 0.8,
    style: 0.15,
  },
  salesperson: {
    name: 'Salesperson',
    description: 'Enthusiastic, persuasive, energetic delivery',
    stability: 0.4,
    similarity: 0.75,
    style: 0.35,
  },
  expert: {
    name: 'Expert',
    description: 'Authoritative, confident, knowledgeable tone',
    stability: 0.7,
    similarity: 0.85,
    style: 0.1,
  },
  conversational: {
    name: 'Conversational',
    description: 'Casual, friendly, like talking to a friend',
    stability: 0.45,
    similarity: 0.7,
    style: 0.25,
  },
  dramatic: {
    name: 'Dramatic',
    description: 'Intense, emotional, high impact delivery',
    stability: 0.35,
    similarity: 0.75,
    style: 0.5,
  },
  calm: {
    name: 'Calm',
    description: 'Soothing, reassuring, gentle delivery',
    stability: 0.8,
    similarity: 0.85,
    style: 0.05,
  },
};

module.exports = {
  TIMING_CONFIG,
  CHARACTER_PRESETS,
};
