/**
 * ElevenLabs API functions
 */

const https = require('https');
const { getApiKey } = require('./env');

/**
 * Make an HTTP request to the ElevenLabs API
 * @param {Object} options - Request options
 * @param {string|null} postData - POST body data
 * @returns {Promise<Object>} Response with status, data, headers, requestId, characterCost
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const headers = res.headers;
        const requestId = headers['request-id'];
        const characterCost = headers['character-cost'];

        if (res.headers['content-type']?.includes('application/json')) {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(Buffer.concat(chunks).toString()),
              headers,
              requestId,
              characterCost
            });
          } catch {
            resolve({
              status: res.statusCode,
              data: Buffer.concat(chunks),
              headers,
              requestId,
              characterCost
            });
          }
        } else {
          resolve({
            status: res.statusCode,
            data: Buffer.concat(chunks),
            headers,
            requestId,
            characterCost
          });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * List all available voices
 */
async function listVoices() {
  const API_KEY = getApiKey();
  console.log('Fetching available voices...\n');

  const response = await makeRequest({
    hostname: 'api.elevenlabs.io',
    path: '/v1/voices',
    method: 'GET',
    headers: { 'xi-api-key': API_KEY },
  });

  if (response.status !== 200) {
    console.error('Error fetching voices:', response.data);
    return;
  }

  console.log('Available Voices:\n');
  console.log('Name'.padEnd(25) + 'ID'.padEnd(28) + 'Labels');
  console.log('-'.repeat(80));

  response.data.voices.forEach(voice => {
    const labels = voice.labels ? Object.values(voice.labels).join(', ') : '';
    console.log(
      voice.name.substring(0, 24).padEnd(25) +
      voice.voice_id.padEnd(28) +
      labels.substring(0, 25)
    );
  });

  console.log('\nRecommended for German:');
  console.log('  - Vossi (custom German male voice)');
  console.log('  - Antoni (professional, warm)');
  console.log('  - Arnold (authoritative)');
}

/**
 * Get voice ID from voice name
 * @param {string} voiceName - Voice name or ID
 * @returns {Promise<string>} Voice ID
 */
async function getVoiceId(voiceName) {
  const API_KEY = getApiKey();

  if (voiceName.length >= 20 && voiceName.length <= 24) {
    return voiceName;
  }

  const response = await makeRequest({
    hostname: 'api.elevenlabs.io',
    path: '/v1/voices',
    method: 'GET',
    headers: { 'xi-api-key': API_KEY },
  });

  if (response.status !== 200) {
    throw new Error('Failed to fetch voices');
  }

  const voice = response.data.voices.find(
    v => v.name.toLowerCase() === voiceName.toLowerCase()
  );

  if (!voice) {
    throw new Error(`Voice "${voiceName}" not found. Use --list-voices to see available voices.`);
  }

  return voice.voice_id;
}

/**
 * Generate a speech chunk using TTS
 * @param {string} text - Text to convert
 * @param {string} voiceId - Voice ID
 * @param {Object} options - Generation options
 * @param {string[]} previousRequestIds - Previous request IDs for stitching
 * @param {Object[]} dictionaryLocators - Dictionary locators
 * @returns {Promise<Object>} Audio buffer, request ID, character cost
 */
async function generateSpeechChunk(text, voiceId, options, previousRequestIds = [], dictionaryLocators = []) {
  const API_KEY = getApiKey();

  const requestBody = {
    text: text,
    model_id: options.model,
    voice_settings: {
      stability: options.stability,
      similarity_boost: options.similarity,
      style: options.style,
      use_speaker_boost: true,
    },
    previous_request_ids: previousRequestIds,
  };

  // Add pronunciation dictionary if provided
  if (dictionaryLocators.length > 0) {
    requestBody.pronunciation_dictionary_locators = dictionaryLocators;
  }

  const response = await makeRequest({
    hostname: 'api.elevenlabs.io',
    path: `/v1/text-to-speech/${voiceId}`,
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
  }, JSON.stringify(requestBody));

  if (response.status !== 200) {
    console.error('Error generating speech:', response.data);
    throw new Error('Failed to generate speech');
  }

  return {
    audio: response.data,
    requestId: response.requestId,
    characterCost: response.characterCost,
  };
}

/**
 * Generate speech with word-level timestamps
 * @param {string} text - Text to convert
 * @param {string} voiceId - Voice ID
 * @param {Object} options - Generation options
 * @param {string[]} previousRequestIds - Previous request IDs for stitching
 * @param {Object[]} dictionaryLocators - Dictionary locators
 * @returns {Promise<Object>} Audio buffer, request ID, character cost, alignment, words
 */
async function generateSpeechWithTimestamps(text, voiceId, options, previousRequestIds = [], dictionaryLocators = []) {
  const API_KEY = getApiKey();
  const { extractWordsFromAlignment } = require('./alignment');

  const requestBody = {
    text: text,
    model_id: options.model,
    voice_settings: {
      stability: options.stability,
      similarity_boost: options.similarity,
      style: options.style,
      use_speaker_boost: true,
    },
    previous_request_ids: previousRequestIds,
  };

  if (dictionaryLocators.length > 0) {
    requestBody.pronunciation_dictionary_locators = dictionaryLocators;
  }

  const response = await makeRequest({
    hostname: 'api.elevenlabs.io',
    path: `/v1/text-to-speech/${voiceId}/with-timestamps`,
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
  }, JSON.stringify(requestBody));

  if (response.status !== 200) {
    console.error('Error generating speech with timestamps:', response.data);
    throw new Error('Failed to generate speech with timestamps');
  }

  const data = response.data;

  // Convert base64 audio to buffer
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');

  // Extract word-level timestamps from character alignment
  const words = extractWordsFromAlignment(text, data.alignment || data.normalized_alignment);

  return {
    audio: audioBuffer,
    requestId: response.requestId,
    characterCost: response.characterCost,
    alignment: data.alignment,
    normalizedAlignment: data.normalized_alignment,
    words: words,
  };
}

module.exports = {
  makeRequest,
  listVoices,
  getVoiceId,
  generateSpeechChunk,
  generateSpeechWithTimestamps,
};
