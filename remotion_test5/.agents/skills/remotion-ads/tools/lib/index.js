/**
 * Remotion-Ads Tools Library
 *
 * Re-exports all modules for convenient importing
 */

// Environment
const env = require('./env');

// Presets
const presets = require('./presets');

// API
const api = require('./api');

// Dictionary
const dictionary = require('./dictionary');

// Alignment
const alignment = require('./alignment');

// Timing
const timing = require('./timing');

// Generation
const generation = require('./generation');

// CLI
const cli = require('./cli');

module.exports = {
  // Environment
  ...env,

  // Presets
  ...presets,

  // API
  ...api,

  // Dictionary
  ...dictionary,

  // Alignment
  ...alignment,

  // Timing
  ...timing,

  // Generation
  ...generation,

  // CLI
  ...cli,

  // Also export modules for namespaced access
  env,
  presets,
  api,
  dictionary,
  alignment,
  timing,
  generation,
  cli,
};
