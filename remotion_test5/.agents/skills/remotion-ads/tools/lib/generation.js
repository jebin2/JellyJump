/**
 * Speech generation functions
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_DICTIONARY } = require('./env');
const { CHARACTER_PRESETS } = require('./presets');
const { getVoiceId, generateSpeechChunk, generateSpeechWithTimestamps } = require('./api');
const { getOrCreateDictionary, applyDictionaryFallback } = require('./dictionary');
const { validateTiming } = require('./timing');

/**
 * Generate single text speech
 * @param {string} text - Text to convert
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Output file path
 */
async function generateSpeech(text, options) {
  console.log(`Generating voiceover${options.withTimestamps ? ' with timestamps' : ''}...`);
  console.log(`  Voice: ${options.voice}`);
  console.log(`  Model: ${options.model}`);
  if (options.character) console.log(`  Character: ${options.character}`);
  if (options.dictionary) console.log(`  Dictionary: ${options.dictionary}`);
  if (options.withTimestamps) console.log(`  Timestamps: enabled`);
  console.log(`  Text length: ${text.length} characters`);
  console.log(`  Output: ${options.output}`);
  console.log('');

  const voiceId = await getVoiceId(options.voice);

  // Get dictionary locators if specified
  let dictionaryLocators = [];
  let useFallback = false;
  const dictName = options.noDictionary ? null : (options.dictionary || DEFAULT_DICTIONARY);

  if (dictName) {
    try {
      const dict = await getOrCreateDictionary(dictName);
      dictionaryLocators = [{
        pronunciation_dictionary_id: dict.id,
        version_id: dict.versionId,
      }];
    } catch (e) {
      console.warn(`   ⚠ Could not load dictionary API: ${e.message}`);
      console.log(`   🔄 Using text preprocessing fallback for ${dictName}`);
      useFallback = true;
    }
  }

  // Apply text preprocessing fallback if API failed
  const processedText = useFallback && dictName ? applyDictionaryFallback(text, dictName) : text;

  let result;
  if (options.withTimestamps) {
    result = await generateSpeechWithTimestamps(processedText, voiceId, options, [], dictionaryLocators);
  } else {
    result = await generateSpeechChunk(processedText, voiceId, options, [], dictionaryLocators);
  }

  const outputDir = path.dirname(options.output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(options.output, result.audio);

  const stats = fs.statSync(options.output);
  console.log(`✓ Voiceover saved: ${options.output} (${(stats.size / 1024).toFixed(1)} KB)`);
  if (result.characterCost) console.log(`  Character cost: ${result.characterCost}`);

  // Save timestamps if generated
  if (options.withTimestamps && result.words) {
    const timestampsPath = options.output.replace(/\.[^.]+$/, '-captions.json');

    // Create Remotion-compatible captions format
    const remotionCaptions = result.words.map((word, index) => ({
      text: word.text + (index < result.words.length - 1 ? ' ' : ''),
      startMs: word.startMs,
      endMs: word.endMs,
      timestampMs: word.startMs,
    }));

    const timestampsData = {
      text: processedText,
      words: result.words,
      remotion: {
        captions: remotionCaptions,
      },
      generatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(timestampsPath, JSON.stringify(timestampsData, null, 2));
    console.log(`✓ Timestamps saved: ${timestampsPath} (${result.words.length} words)`);
  }

  if (!options.skipValidation) {
    console.log('\n📊 Validating timing...');
    const validation = validateTiming(options.output, text);
    if (validation.actualDuration) {
      console.log(`   Duration: ${validation.actualDuration.toFixed(2)}s`);
      console.log(`   Speaking rate: ${validation.wordsPerSecond?.toFixed(1)} words/sec`);
      validation.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
    }
  }

  return options.output;
}

/**
 * Regenerate a single scene
 * @param {string} scenesFile - Path to scenes JSON file
 * @param {string} sceneId - Scene ID to regenerate
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generation result
 */
async function regenerateSingleScene(scenesFile, sceneId, options) {
  const config = JSON.parse(fs.readFileSync(scenesFile, 'utf-8'));
  const voiceName = config.voice || options.voice;
  const projectName = config.name || 'voiceover';
  const outputDir = options.outputDir || path.dirname(options.output) || 'public/audio';
  const dictName = options.noDictionary ? null : (options.dictionary || config.dictionary || DEFAULT_DICTIONARY);

  const sceneIndex = config.scenes.findIndex(s => s.id === sceneId);
  if (sceneIndex === -1) {
    console.error(`Scene "${sceneId}" not found in ${scenesFile}`);
    console.error(`Available scenes: ${config.scenes.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  const scene = config.scenes[sceneIndex];
  const text = options.newText || scene.text;

  let characterSettings = { ...CHARACTER_PRESETS.literal };
  if (config.character && CHARACTER_PRESETS[config.character]) {
    characterSettings = { ...CHARACTER_PRESETS[config.character] };
  }
  if (scene.character && CHARACTER_PRESETS[scene.character]) {
    characterSettings = { ...CHARACTER_PRESETS[scene.character] };
  }
  if (options.character && CHARACTER_PRESETS[options.character]) {
    characterSettings = { ...CHARACTER_PRESETS[options.character] };
  }

  const infoFilePath = path.join(outputDir, `${projectName}-info.json`);
  let previousRequestIds = [];
  let infoData = null;

  if (fs.existsSync(infoFilePath)) {
    infoData = JSON.parse(fs.readFileSync(infoFilePath, 'utf-8'));
    const prevScenes = infoData.scenes.slice(Math.max(0, sceneIndex - 3), sceneIndex);
    previousRequestIds = prevScenes.map(s => s.requestId).filter(Boolean);
  }

  console.log(`\n🔄 Regenerating ${sceneId}`);
  console.log(`   Voice: ${voiceName}`);
  console.log(`   Character: ${options.character || scene.character || config.character || 'literal'}`);
  if (dictName) console.log(`   Dictionary: ${dictName}`);
  console.log(`   Text: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
  if (options.newText) console.log(`   (Using new text)`);
  console.log('');

  const voiceId = await getVoiceId(voiceName);

  // Get dictionary locators
  let dictionaryLocators = [];
  let useFallback = false;
  if (dictName) {
    try {
      const dict = await getOrCreateDictionary(dictName);
      dictionaryLocators = [{
        pronunciation_dictionary_id: dict.id,
        version_id: dict.versionId,
      }];
    } catch (e) {
      console.warn(`   ⚠ Could not load dictionary: ${e.message}`);
      console.log(`   🔄 Using text preprocessing fallback`);
      useFallback = true;
    }
  }

  // Apply text preprocessing fallback if API failed
  const processedText = useFallback && dictName ? applyDictionaryFallback(text, dictName) : text;

  const result = await generateSpeechChunk(processedText, voiceId, {
    ...options,
    stability: characterSettings.stability,
    similarity: characterSettings.similarity,
    style: characterSettings.style,
  }, previousRequestIds, dictionaryLocators);

  const sceneFilename = `${projectName}-${sceneId}.mp3`;
  const sceneFilePath = path.join(outputDir, sceneFilename);
  fs.writeFileSync(sceneFilePath, result.audio);

  const stats = fs.statSync(sceneFilePath);
  console.log(`✓ Regenerated: ${sceneFilename} (${(stats.size / 1024).toFixed(1)} KB)`);

  if (!options.skipValidation) {
    console.log('\n📊 Validating timing...');
    const validation = validateTiming(sceneFilePath, text, scene.duration);

    if (validation.actualDuration) {
      const status = validation.issues.length > 0 ? '❌' : validation.warnings.length > 0 ? '⚠️' : '✅';
      console.log(`${status} Actual: ${validation.actualDuration.toFixed(2)}s, Expected: ${scene.duration || 'N/A'}s`);
      console.log(`   Speaking rate: ${validation.wordsPerSecond?.toFixed(1)} words/sec (${validation.wordCount} words)`);

      if (validation.silence.leadingSilence > 0.05) {
        console.log(`   Leading silence: ${(validation.silence.leadingSilence * 1000).toFixed(0)}ms`);
      }

      validation.issues.forEach(i => console.log(`   ❌ ${i}`));
      validation.warnings.forEach(w => console.log(`   ⚠️  ${w}`));

      if (infoData) {
        infoData.scenes[sceneIndex] = {
          ...infoData.scenes[sceneIndex],
          text: text,
          size: stats.size,
          actualDuration: validation.actualDuration,
          wordsPerSecond: parseFloat(validation.wordsPerSecond.toFixed(2)),
          leadingSilence: parseFloat(validation.silence.leadingSilence.toFixed(3)),
          requestId: result.requestId,
          regeneratedAt: new Date().toISOString(),
          character: options.character || scene.character || config.character || 'literal',
        };
        infoData.updatedAt = new Date().toISOString();
        fs.writeFileSync(infoFilePath, JSON.stringify(infoData, null, 2));
        console.log(`✓ Updated: ${projectName}-info.json`);
      }
    }
  }

  if (options.newText) {
    config.scenes[sceneIndex].text = options.newText;
    fs.writeFileSync(scenesFile, JSON.stringify(config, null, 2));
    console.log(`✓ Updated: ${scenesFile}`);
  }

  console.log(`\n✅ Scene regeneration complete!`);

  return result;
}

/**
 * Generate all scenes from scenes file
 * @param {string} scenesFile - Path to scenes JSON file
 * @param {Object} options - Generation options
 * @returns {Promise<Array>} Scene info array
 */
async function generateScenes(scenesFile, options) {
  const config = JSON.parse(fs.readFileSync(scenesFile, 'utf-8'));
  const scenes = config.scenes;
  const voiceName = config.voice || options.voice;
  const projectName = config.name || 'voiceover';
  const globalCharacter = options.character || config.character || 'literal';
  const dictName = options.noDictionary ? null : (options.dictionary || config.dictionary || DEFAULT_DICTIONARY);
  const withTimestamps = options.withTimestamps;

  const outputDir = options.outputDir || path.dirname(options.output) || 'public/audio';

  console.log(`\n🎬 Generating ${scenes.length} scenes with Request Stitching`);
  console.log(`   Voice: ${voiceName}`);
  console.log(`   Model: ${options.model}`);
  console.log(`   Character: ${globalCharacter}`);
  if (dictName) console.log(`   Dictionary: ${dictName}`);
  if (withTimestamps) console.log(`   Timestamps: enabled`);
  console.log(`   Output: ${outputDir}/`);
  console.log('');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const voiceId = await getVoiceId(voiceName);

  // Get dictionary locators
  let dictionaryLocators = [];
  let useFallback = false;
  if (dictName) {
    try {
      const dict = await getOrCreateDictionary(dictName);
      dictionaryLocators = [{
        pronunciation_dictionary_id: dict.id,
        version_id: dict.versionId,
      }];
    } catch (e) {
      console.warn(`   ⚠ Could not load dictionary: ${e.message}`);
      console.log(`   🔄 Using text preprocessing fallback for ${dictName}`);
      useFallback = true;
    }
  }

  const requestIds = [];
  const audioBuffers = [];
  const sceneInfo = [];
  let totalCharacters = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneId = scene.id || `scene${i + 1}`;
    const rawText = scene.text;
    // Apply text preprocessing fallback if API failed
    const text = useFallback && dictName ? applyDictionaryFallback(rawText, dictName) : rawText;

    const sceneCharacter = scene.character || globalCharacter;
    const characterSettings = CHARACTER_PRESETS[sceneCharacter] || CHARACTER_PRESETS.literal;

    console.log(`[${i + 1}/${scenes.length}] ${sceneId} (${sceneCharacter})`);
    console.log(`   "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    try {
      let result;
      if (withTimestamps) {
        result = await generateSpeechWithTimestamps(text, voiceId, {
          ...options,
          stability: scene.stability || characterSettings.stability,
          similarity: scene.similarity || characterSettings.similarity,
          style: scene.style || characterSettings.style,
        }, requestIds.slice(-3), dictionaryLocators);
      } else {
        result = await generateSpeechChunk(text, voiceId, {
          ...options,
          stability: scene.stability || characterSettings.stability,
          similarity: scene.similarity || characterSettings.similarity,
          style: scene.style || characterSettings.style,
        }, requestIds.slice(-3), dictionaryLocators);
      }

      const sceneFilename = `${projectName}-${sceneId}.mp3`;
      const sceneFilePath = path.join(outputDir, sceneFilename);
      fs.writeFileSync(sceneFilePath, result.audio);

      const stats = fs.statSync(sceneFilePath);

      let validation = null;
      if (!options.skipValidation) {
        validation = validateTiming(sceneFilePath, text, scene.duration);
      }

      const actualDuration = validation?.actualDuration || null;
      const status = !validation ? '✓' :
                     validation.issues.length > 0 ? '⚠️' :
                     validation.warnings.length > 0 ? '⚠️' : '✓';

      console.log(`   ${status} ${sceneFilename} (${(stats.size / 1024).toFixed(1)} KB, ${actualDuration?.toFixed(2) || '?'}s)`);

      if (validation?.issues.length > 0) {
        validation.issues.forEach(i => console.log(`      ❌ ${i}`));
      }
      if (validation?.warnings.length > 0) {
        validation.warnings.forEach(w => console.log(`      ⚠️  ${w}`));
      }

      requestIds.push(result.requestId);
      audioBuffers.push(result.audio);

      const sceneData = {
        id: sceneId,
        file: sceneFilename,
        text: text,
        size: stats.size,
        duration: scene.duration || null,
        actualDuration: actualDuration,
        wordsPerSecond: validation?.wordsPerSecond ? parseFloat(validation.wordsPerSecond.toFixed(2)) : null,
        leadingSilence: validation?.silence?.leadingSilence ? parseFloat(validation.silence.leadingSilence.toFixed(3)) : 0,
        delay: scene.delay || 0,
        character: sceneCharacter,
        requestId: result.requestId,
      };

      // Add word timestamps if generated
      if (withTimestamps && result.words) {
        sceneData.words = result.words;
      }

      sceneInfo.push(sceneData);

      totalCharacters += text.length;

    } catch (error) {
      console.error(`   ✗ Error: ${error.message}`);
      throw error;
    }

    if (i < scenes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  if (options.combined) {
    const combinedFilename = `${projectName}-combined.mp3`;
    const combinedFilePath = path.join(outputDir, combinedFilename);
    const combinedBuffer = Buffer.concat(audioBuffers);
    fs.writeFileSync(combinedFilePath, combinedBuffer);

    const combinedStats = fs.statSync(combinedFilePath);
    console.log(`\n✓ Combined: ${combinedFilename} (${(combinedStats.size / 1024).toFixed(1)} KB)`);
  }

  const infoFilePath = path.join(outputDir, `${projectName}-info.json`);
  const infoData = {
    name: projectName,
    voice: voiceName,
    model: options.model,
    character: globalCharacter,
    dictionary: dictName,
    totalScenes: scenes.length,
    totalCharacters: totalCharacters,
    withTimestamps: withTimestamps,
    generatedAt: new Date().toISOString(),
    scenes: sceneInfo,
  };
  fs.writeFileSync(infoFilePath, JSON.stringify(infoData, null, 2));

  // Save combined captions file if timestamps were generated
  if (withTimestamps) {
    let cumulativeMs = 0;
    const allCaptions = [];

    for (const scene of sceneInfo) {
      if (scene.words) {
        for (const word of scene.words) {
          allCaptions.push({
            text: word.text + ' ',
            startMs: cumulativeMs + word.startMs,
            endMs: cumulativeMs + word.endMs,
            timestampMs: cumulativeMs + word.startMs,
            sceneId: scene.id,
          });
        }
      }
      cumulativeMs += Math.round((scene.actualDuration || scene.duration || 0) * 1000) + Math.round((scene.delay || 0) * 1000);
    }

    const captionsFilePath = path.join(outputDir, `${projectName}-captions.json`);
    const captionsData = {
      name: projectName,
      totalWords: allCaptions.length,
      remotion: {
        captions: allCaptions,
      },
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(captionsFilePath, JSON.stringify(captionsData, null, 2));
    console.log(`\n✓ Captions: ${captionsFilePath} (${allCaptions.length} words)`);
  }

  console.log(`\n📋 Summary`);
  console.log(`   Scenes: ${scenes.length}`);
  console.log(`   Characters: ${totalCharacters}`);

  const totalActual = sceneInfo.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
  const totalExpected = sceneInfo.reduce((sum, s) => sum + (s.duration || 0), 0);
  console.log(`   Total duration: ${totalActual.toFixed(2)}s (expected: ${totalExpected.toFixed(2)}s)`);

  const issues = sceneInfo.filter(s => s.actualDuration && s.duration && Math.abs(s.actualDuration - s.duration) / s.duration > 0.15);
  if (issues.length > 0) {
    console.log(`\n⚠️  ${issues.length} scene(s) with timing issues:`);
    issues.forEach(s => {
      const diff = s.actualDuration - s.duration;
      console.log(`   - ${s.id}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}s (actual: ${s.actualDuration.toFixed(2)}s, expected: ${s.duration}s)`);
    });
  }

  console.log(`\n✅ Scene generation complete!`);
  console.log(`\nTo regenerate a scene with timing issues:`);
  console.log(`   node generate.js --scenes ${scenesFile} --scene <scene-id> --output-dir ${outputDir}`);

  return sceneInfo;
}

module.exports = {
  generateSpeech,
  regenerateSingleScene,
  generateScenes,
};
