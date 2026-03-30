/**
 * Audio timing and validation functions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { TIMING_CONFIG } = require('./presets');

/**
 * Get audio duration using ffprobe
 * @param {string} filePath - Path to audio file
 * @returns {number|null} Duration in seconds or null if unavailable
 */
function getAudioDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    return parseFloat(result.trim());
  } catch {
    console.warn(`   ⚠ Could not get duration for ${filePath} (ffprobe not available?)`);
    return null;
  }
}

/**
 * Detect silence in audio file
 * @param {string} filePath - Path to audio file
 * @returns {Object} Leading and trailing silence in seconds
 */
function detectSilence(filePath) {
  try {
    const result = execSync(
      `ffmpeg -i "${filePath}" -af silencedetect=noise=-30dB:d=0.1 -f null - 2>&1`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const silenceStarts = [];
    const silenceEnds = [];

    const lines = result.split('\n');
    for (const line of lines) {
      const startMatch = line.match(/silence_start: ([\d.]+)/);
      const endMatch = line.match(/silence_end: ([\d.]+)/);
      if (startMatch) silenceStarts.push(parseFloat(startMatch[1]));
      if (endMatch) silenceEnds.push(parseFloat(endMatch[1]));
    }

    const duration = getAudioDuration(filePath);

    let leadingSilence = 0;
    if (silenceStarts.length > 0 && silenceStarts[0] < 0.05) {
      leadingSilence = silenceEnds[0] || 0;
    }

    let trailingSilence = 0;
    if (silenceEnds.length > 0 && duration) {
      const lastEnd = silenceEnds[silenceEnds.length - 1];
      const lastStart = silenceStarts[silenceStarts.length - 1];
      if (Math.abs(lastEnd - duration) < 0.1 || lastEnd > duration - 0.1) {
        trailingSilence = duration - lastStart;
      }
    }

    return { leadingSilence, trailingSilence };
  } catch {
    return { leadingSilence: 0, trailingSilence: 0 };
  }
}

/**
 * Count words in text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Validate audio timing against expectations
 * @param {string} filePath - Path to audio file
 * @param {string} text - Text content
 * @param {number|null} expectedDuration - Expected duration in seconds
 * @returns {Object} Validation results
 */
function validateTiming(filePath, text, expectedDuration = null) {
  const issues = [];
  const warnings = [];

  const actualDuration = getAudioDuration(filePath);
  if (!actualDuration) {
    return { actualDuration: null, issues: ['Could not determine audio duration'], warnings: [], silence: null, wordsPerSecond: null };
  }

  if (expectedDuration) {
    const diffPercent = Math.abs(actualDuration - expectedDuration) / expectedDuration * 100;
    if (diffPercent > TIMING_CONFIG.maxDurationDiffPercent) {
      const diff = actualDuration - expectedDuration;
      if (diff > 0) {
        issues.push(`Audio ${diff.toFixed(2)}s longer than expected (${actualDuration.toFixed(2)}s vs ${expectedDuration}s)`);
      } else {
        issues.push(`Audio ${Math.abs(diff).toFixed(2)}s shorter than expected (${actualDuration.toFixed(2)}s vs ${expectedDuration}s)`);
      }
    }
  }

  const silence = detectSilence(filePath);
  if (silence.leadingSilence > TIMING_CONFIG.maxLeadingSilenceMs / 1000) {
    warnings.push(`Leading silence: ${(silence.leadingSilence * 1000).toFixed(0)}ms (may start late)`);
  }
  if (silence.trailingSilence > TIMING_CONFIG.maxTrailingSilenceMs / 1000) {
    warnings.push(`Trailing silence: ${(silence.trailingSilence * 1000).toFixed(0)}ms`);
  }

  const wordCount = countWords(text);
  const speakingDuration = actualDuration - silence.leadingSilence - silence.trailingSilence;
  const wordsPerSecond = wordCount / speakingDuration;

  if (wordsPerSecond < TIMING_CONFIG.minWordsPerSecond) {
    warnings.push(`Speaking rate slow: ${wordsPerSecond.toFixed(1)} words/sec (target: ${TIMING_CONFIG.idealWordsPerSecond})`);
  } else if (wordsPerSecond > TIMING_CONFIG.maxWordsPerSecond) {
    warnings.push(`Speaking rate fast: ${wordsPerSecond.toFixed(1)} words/sec (target: ${TIMING_CONFIG.idealWordsPerSecond})`);
  }

  return {
    actualDuration,
    expectedDuration,
    issues,
    warnings,
    silence,
    wordsPerSecond,
    wordCount,
  };
}

/**
 * Validate an entire project directory
 * @param {string} outputDir - Project output directory
 * @returns {Promise<Object>} Validation results
 */
async function validateProject(outputDir) {
  const files = fs.readdirSync(outputDir);
  const infoFile = files.find(f => f.endsWith('-info.json'));

  if (!infoFile) {
    console.error(`No info file found in ${outputDir}`);
    process.exit(1);
  }

  const infoPath = path.join(outputDir, infoFile);
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

  console.log(`\n🔍 Validating ${info.name} (${info.totalScenes} scenes)\n`);

  let hasIssues = false;
  let hasWarnings = false;
  const updatedScenes = [];

  for (const scene of info.scenes) {
    const filePath = path.join(outputDir, scene.file);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${scene.id}: File not found - ${scene.file}`);
      hasIssues = true;
      updatedScenes.push(scene);
      continue;
    }

    const validation = validateTiming(filePath, scene.text, scene.duration);

    const updatedScene = {
      ...scene,
      actualDuration: validation.actualDuration,
      wordsPerSecond: validation.wordsPerSecond ? parseFloat(validation.wordsPerSecond.toFixed(2)) : null,
      leadingSilence: validation.silence?.leadingSilence ? parseFloat(validation.silence.leadingSilence.toFixed(3)) : 0,
      trailingSilence: validation.silence?.trailingSilence ? parseFloat(validation.silence.trailingSilence.toFixed(3)) : 0,
    };
    updatedScenes.push(updatedScene);

    const status = validation.issues.length > 0 ? '❌' : validation.warnings.length > 0 ? '⚠️' : '✅';
    console.log(`${status} ${scene.id}: ${validation.actualDuration?.toFixed(2)}s (expected: ${scene.duration || 'N/A'}s)`);

    if (validation.issues.length > 0) {
      hasIssues = true;
      validation.issues.forEach(i => console.log(`   ❌ ${i}`));
    }
    if (validation.warnings.length > 0) {
      hasWarnings = true;
      validation.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
    }

    if (validation.wordsPerSecond) {
      const rateIcon = validation.wordsPerSecond < TIMING_CONFIG.minWordsPerSecond ? '🐢' :
                       validation.wordsPerSecond > TIMING_CONFIG.maxWordsPerSecond ? '🐇' : '👍';
      console.log(`   ${rateIcon} ${validation.wordCount} words @ ${validation.wordsPerSecond.toFixed(1)} words/sec`);
    }
  }

  info.scenes = updatedScenes;
  info.validatedAt = new Date().toISOString();
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));

  console.log('\n' + '─'.repeat(50));
  const totalActual = updatedScenes.reduce((sum, s) => sum + (s.actualDuration || 0), 0);
  const totalExpected = updatedScenes.reduce((sum, s) => sum + (s.duration || 0), 0);
  console.log(`📊 Total duration: ${totalActual.toFixed(2)}s (expected: ${totalExpected.toFixed(2)}s)`);

  if (hasIssues) {
    console.log('\n❌ Issues found - consider regenerating affected scenes');
    console.log('   Example: node generate.js --scenes <file> --scene <id> --output-dir ' + outputDir);
  } else if (hasWarnings) {
    console.log('\n⚠️  Warnings found - review timing for best results');
  } else {
    console.log('\n✅ All scenes passed validation!');
  }

  console.log(`\n📝 Updated: ${infoFile} (with actual durations)`);

  return { hasIssues, hasWarnings };
}

module.exports = {
  getAudioDuration,
  detectSilence,
  countWords,
  validateTiming,
  validateProject,
};
