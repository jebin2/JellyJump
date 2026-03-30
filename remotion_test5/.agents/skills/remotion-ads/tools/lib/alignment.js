/**
 * Forced alignment and timestamps functions
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getApiKey } = require('./env');

/**
 * Extract word-level timestamps from character alignment
 * Groups characters into words based on spaces/punctuation
 * @param {string} text - Original text
 * @param {Object} alignment - Alignment data from API
 * @returns {Array<Object>} Word timestamps
 */
function extractWordsFromAlignment(text, alignment) {
  if (!alignment || !alignment.characters) {
    return [];
  }

  const words = [];
  let currentWord = '';
  let wordStartTime = null;
  let wordEndTime = null;
  let charIndex = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const startTime = alignment.character_start_times_seconds[i];
    const endTime = alignment.character_end_times_seconds[i];

    // Handle word boundaries (space, punctuation at end)
    if (char === ' ' || char === '\n' || char === '\t') {
      if (currentWord.trim()) {
        words.push({
          text: currentWord.trim(),
          start: wordStartTime,
          end: wordEndTime,
          startMs: Math.round(wordStartTime * 1000),
          endMs: Math.round(wordEndTime * 1000),
        });
      }
      currentWord = '';
      wordStartTime = null;
      wordEndTime = null;
    } else {
      if (wordStartTime === null) {
        wordStartTime = startTime;
      }
      wordEndTime = endTime;
      currentWord += char;
    }
    charIndex++;
  }

  // Don't forget the last word
  if (currentWord.trim()) {
    words.push({
      text: currentWord.trim(),
      start: wordStartTime,
      end: wordEndTime,
      startMs: Math.round(wordStartTime * 1000),
      endMs: Math.round(wordEndTime * 1000),
    });
  }

  return words;
}

/**
 * Forced alignment: align existing audio to text
 * Returns word-level timestamps for the audio
 * @param {string} audioPath - Path to audio file
 * @param {string} text - Text transcript
 * @returns {Promise<Object>} Alignment data
 */
async function forceAlign(audioPath, text) {
  const API_KEY = getApiKey();
  const audioBuffer = fs.readFileSync(audioPath);
  const fileName = path.basename(audioPath);

  // Create multipart form data
  const boundary = '----ElevenLabsBoundary' + Date.now();

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="text"\r\n\r\n`;
  body += `${text}\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
  body += `Content-Type: audio/mpeg\r\n\r\n`;

  const bodyStart = Buffer.from(body, 'utf-8');
  const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const fullBody = Buffer.concat([bodyStart, audioBuffer, bodyEnd]);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: '/v1/forced-alignment',
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(json);
          } else {
            reject(new Error(`Forced alignment failed: ${json.detail?.message || json.detail || data}`));
          }
        } catch {
          reject(new Error(`Forced alignment failed: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

/**
 * Run forced alignment on existing audio and save word timestamps
 * @param {string} audioPath - Path to audio file
 * @param {string} text - Text transcript
 * @param {string} outputPath - Output path for alignment JSON
 * @returns {Promise<Object>} Alignment result
 */
async function alignExistingAudio(audioPath, text, outputPath) {
  console.log(`\n🎯 Running forced alignment...`);
  console.log(`   Audio: ${audioPath}`);
  console.log(`   Text: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);

  const alignment = await forceAlign(audioPath, text);

  const result = {
    audioFile: path.basename(audioPath),
    text: text,
    words: alignment.words || [],
    characters: alignment.characters || [],
    totalDuration: alignment.words?.length > 0
      ? alignment.words[alignment.words.length - 1].end
      : 0,
    loss: alignment.loss,
    alignedAt: new Date().toISOString(),
  };

  // Convert to Remotion-compatible format
  const remotionCaptions = {
    captions: result.words.map((word, index) => ({
      text: word.text + (index < result.words.length - 1 ? ' ' : ''),
      startMs: Math.round(word.start * 1000),
      endMs: Math.round(word.end * 1000),
      timestampMs: Math.round(word.start * 1000),
      confidence: 1 - (word.loss || 0),
    })),
  };

  // Save alignment data
  const alignmentPath = outputPath || audioPath.replace(/\.[^.]+$/, '-alignment.json');
  fs.writeFileSync(alignmentPath, JSON.stringify({ ...result, remotion: remotionCaptions }, null, 2));

  console.log(`\n✅ Alignment complete!`);
  console.log(`   Words: ${result.words.length}`);
  console.log(`   Duration: ${result.totalDuration?.toFixed(2)}s`);
  console.log(`   Confidence: ${((1 - (alignment.loss || 0)) * 100).toFixed(1)}%`);
  console.log(`   Output: ${alignmentPath}`);

  return result;
}

/**
 * Align all scenes in a project directory
 * @param {string} projectDir - Project directory path
 * @param {string} scenesFile - Optional scenes file path
 * @returns {Promise<Object>} Combined alignment output
 */
async function alignProjectScenes(projectDir, scenesFile) {
  const files = fs.readdirSync(projectDir);
  const infoFile = files.find(f => f.endsWith('-info.json'));

  if (!infoFile) {
    console.error(`No info file found in ${projectDir}`);
    process.exit(1);
  }

  const infoPath = path.join(projectDir, infoFile);
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

  console.log(`\n🎯 Aligning ${info.totalScenes} scenes from ${info.name}`);

  const alignments = [];

  for (const scene of info.scenes) {
    const audioPath = path.join(projectDir, scene.file);

    if (!fs.existsSync(audioPath)) {
      console.log(`⚠️  Skipping ${scene.id}: File not found`);
      continue;
    }

    console.log(`\n[${scene.id}] Aligning...`);

    try {
      const alignment = await forceAlign(audioPath, scene.text);

      const sceneAlignment = {
        id: scene.id,
        audioFile: scene.file,
        text: scene.text,
        words: alignment.words || [],
        loss: alignment.loss,
      };

      alignments.push(sceneAlignment);

      console.log(`   ✅ ${alignment.words?.length || 0} words, confidence: ${((1 - (alignment.loss || 0)) * 100).toFixed(1)}%`);

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  // Save combined alignment file
  const outputPath = path.join(projectDir, `${info.name}-captions.json`);

  // Convert to Remotion-compatible format
  let cumulativeMs = 0;
  const allCaptions = [];

  for (const scene of alignments) {
    const sceneDelay = info.scenes.find(s => s.id === scene.id)?.delay || 0;
    const sceneDuration = info.scenes.find(s => s.id === scene.id)?.actualDuration || 0;

    for (const word of scene.words) {
      allCaptions.push({
        text: word.text + ' ',
        startMs: cumulativeMs + Math.round(word.start * 1000),
        endMs: cumulativeMs + Math.round(word.end * 1000),
        timestampMs: cumulativeMs + Math.round(word.start * 1000),
        sceneId: scene.id,
      });
    }

    cumulativeMs += Math.round((sceneDuration + sceneDelay) * 1000);
  }

  const output = {
    name: info.name,
    totalScenes: alignments.length,
    totalWords: allCaptions.length,
    scenes: alignments,
    remotion: {
      captions: allCaptions,
    },
    alignedAt: new Date().toISOString(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ All scenes aligned!`);
  console.log(`   Total words: ${allCaptions.length}`);
  console.log(`   Output: ${outputPath}`);

  return output;
}

module.exports = {
  extractWordsFromAlignment,
  forceAlign,
  alignExistingAudio,
  alignProjectScenes,
};
