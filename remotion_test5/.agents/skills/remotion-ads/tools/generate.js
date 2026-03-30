#!/usr/bin/env node

/**
 * ElevenLabs Voiceover Generator with Request Stitching
 *
 * Features:
 * - Single text generation
 * - Scene-based generation with request stitching for consistent prosody
 * - Character/narrator modes for natural voiceovers
 * - Pronunciation dictionaries for brand names and terms
 * - Single scene regeneration for fine-tuning
 * - Automatic timing validation with ffprobe
 * - Silence detection
 * - Individual scene files + combined output
 *
 * Usage:
 *   node generate.js --text "Your text" --output output.mp3
 *   node generate.js --scenes scenes.json --output-dir public/audio/
 *   node generate.js --scenes scenes.json --scene scene2 --output-dir public/audio/
 *   node generate.js --validate public/audio/project/
 *   node generate.js --list-voices
 *   node generate.js --list-dictionaries
 */

const fs = require('fs');

// Import from lib modules
const {
  loadEnv,
  requireApiKey,
  parseArgs,
  printHelp,
  listCharacters,
  listVoices,
  displayDictionaries,
  validateProject,
  alignExistingAudio,
  alignProjectScenes,
  generateSpeech,
  generateScenes,
  regenerateSingleScene,
} = require('./lib');

// Load environment variables
loadEnv();

// ============================================
// MAIN
// ============================================

async function main() {
  const options = parseArgs();

  // Check if API key is needed for the command
  const needsApiKey = !options.validate &&
                      !options.listCharacters &&
                      !options.listDictionaries &&
                      !process.argv.includes('--help') &&
                      !process.argv.includes('-h') &&
                      !options.align;

  if (needsApiKey) {
    requireApiKey(true);
  }

  try {
    if (options.listVoices) {
      await listVoices();
      return;
    }

    if (options.listCharacters) {
      listCharacters();
      return;
    }

    if (options.listDictionaries) {
      await displayDictionaries();
      return;
    }

    if (options.validate) {
      await validateProject(options.validate);
      return;
    }

    // Forced alignment for existing audio
    if (options.align) {
      if (!options.alignText && !options.text) {
        console.error('Error: --align-text or --text is required with --align');
        process.exit(1);
      }
      const text = options.alignText || options.text;
      await alignExistingAudio(options.align, text, options.output.replace('.mp3', '-alignment.json'));
      return;
    }

    // Align all scenes in a project directory
    if (options.alignProject) {
      await alignProjectScenes(options.alignProject, options.scenes);
      return;
    }

    if (options.scenes) {
      if (!fs.existsSync(options.scenes)) {
        console.error(`Error: Scenes file not found: ${options.scenes}`);
        process.exit(1);
      }

      if (options.scene) {
        await regenerateSingleScene(options.scenes, options.scene, options);
        return;
      }

      await generateScenes(options.scenes, options);
      return;
    }

    let text = options.text;

    if (options.file) {
      if (!fs.existsSync(options.file)) {
        console.error(`Error: File not found: ${options.file}`);
        process.exit(1);
      }
      text = fs.readFileSync(options.file, 'utf-8').trim();
    }

    if (!text) {
      console.error('Error: No text provided. Use --text, --file, or --scenes');
      printHelp();
      process.exit(1);
    }

    await generateSpeech(text, options);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
