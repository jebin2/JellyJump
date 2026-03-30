/**
 * CLI argument parsing and help functions
 */

const { CHARACTER_PRESETS } = require('./presets');
const { DEFAULT_DICTIONARY } = require('./env');

/**
 * Parse command line arguments
 * @returns {Object} Parsed options
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    text: null,
    file: null,
    output: 'output.mp3',
    outputDir: null,
    voice: 'Vossi',
    model: 'eleven_multilingual_v2',
    stability: 0.5,
    similarity: 0.75,
    style: 0.0,
    speed: 1.0,
    listVoices: false,
    listCharacters: false,
    listDictionaries: false,
    scenes: null,
    scene: null,
    character: null,
    combined: true,
    newText: null,
    validate: null,
    skipValidation: false,
    dictionary: DEFAULT_DICTIONARY,  // Default to vosslegal dictionary
    noDictionary: false,
    withTimestamps: false,  // Generate with word-level timestamps
    align: null,            // Path to audio file for forced alignment
    alignText: null,        // Text for forced alignment
    alignProject: null,     // Align all scenes in a project directory
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--text':
      case '-t':
        options.text = nextArg;
        i++;
        break;
      case '--file':
      case '-f':
        options.file = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.output = nextArg;
        i++;
        break;
      case '--output-dir':
        options.outputDir = nextArg;
        i++;
        break;
      case '--voice':
      case '-v':
        options.voice = nextArg;
        i++;
        break;
      case '--model':
      case '-m':
        options.model = nextArg;
        i++;
        break;
      case '--stability':
        options.stability = parseFloat(nextArg);
        i++;
        break;
      case '--similarity':
        options.similarity = parseFloat(nextArg);
        i++;
        break;
      case '--style':
        options.style = parseFloat(nextArg);
        i++;
        break;
      case '--speed':
        options.speed = parseFloat(nextArg);
        i++;
        break;
      case '--list-voices':
        options.listVoices = true;
        break;
      case '--list-characters':
        options.listCharacters = true;
        break;
      case '--list-dictionaries':
        options.listDictionaries = true;
        break;
      case '--scenes':
        options.scenes = nextArg;
        i++;
        break;
      case '--scene':
        options.scene = nextArg;
        i++;
        break;
      case '--character':
      case '-c':
        options.character = nextArg;
        i++;
        break;
      case '--new-text':
        options.newText = nextArg;
        i++;
        break;
      case '--no-combined':
        options.combined = false;
        break;
      case '--validate':
        options.validate = nextArg;
        i++;
        break;
      case '--skip-validation':
        options.skipValidation = true;
        break;
      case '--dictionary':
      case '-d':
        options.dictionary = nextArg;
        i++;
        break;
      case '--no-dictionary':
        options.noDictionary = true;
        options.dictionary = null;
        break;
      case '--with-timestamps':
        options.withTimestamps = true;
        break;
      case '--align':
        options.align = nextArg;
        i++;
        break;
      case '--align-text':
        options.alignText = nextArg;
        i++;
        break;
      case '--align-project':
        options.alignProject = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  if (options.character) {
    const preset = CHARACTER_PRESETS[options.character.toLowerCase()];
    if (preset) {
      options.stability = preset.stability;
      options.similarity = preset.similarity;
      options.style = preset.style;
    } else {
      console.error(`Unknown character: ${options.character}`);
      console.error(`Use --list-characters to see available options.`);
      process.exit(1);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
ElevenLabs Voiceover Generator with Request Stitching, Timestamps & Pronunciation Dictionaries

Usage:
  node generate.js --text "Your text" --output output.mp3
  node generate.js --text "Your text" --with-timestamps --output output.mp3
  node generate.js --scenes scenes.json --output-dir public/audio/
  node generate.js --scenes scenes.json --scene scene2 --new-text "New text"
  node generate.js --validate public/audio/project/
  node generate.js --align audio.mp3 --align-text "Your transcript"
  node generate.js --align-project public/audio/project/
  node generate.js --list-voices
  node generate.js --list-characters
  node generate.js --list-dictionaries

Options:
  --text, -t          Text to convert to speech
  --file, -f          Read text from file
  --output, -o        Output file path (default: output.mp3)
  --output-dir        Output directory for scene files
  --voice, -v         Voice name or ID (default: Vossi)
  --model, -m         Model ID (default: eleven_multilingual_v2)
  --stability         Voice stability 0-1 (default: 0.5)
  --similarity        Similarity boost 0-1 (default: 0.75)
  --style             Style exaggeration 0-1 (default: 0.0)
  --character, -c     Character preset (narrator, salesperson, expert, etc.)
  --dictionary, -d    Pronunciation dictionary name (default: vosslegal)
  --no-dictionary     Disable pronunciation dictionary
  --scenes            JSON file with scenes for stitched generation
  --scene             Regenerate single scene by ID (use with --scenes)
  --new-text          New text for scene regeneration (optional)
  --no-combined       Don't create combined file (scenes mode only)
  --validate          Validate timing of generated audio in directory
  --skip-validation   Skip automatic validation after generation
  --with-timestamps   Generate with word-level timestamps (for captions)
  --align             Align existing audio file to text (forced alignment)
  --align-text        Text transcript for forced alignment
  --align-project     Align all scenes in a project directory
  --list-voices       List all available voices
  --list-characters   List all character presets
  --list-dictionaries List pronunciation dictionaries
  --help, -h          Show this help

Character Presets:
  literal        - Reads text exactly as written (default)
  narrator       - Professional storyteller, smooth, engaging
  salesperson    - Enthusiastic, persuasive, energetic
  expert         - Authoritative, confident, knowledgeable
  conversational - Casual, friendly, natural
  dramatic       - Intense, emotional, impactful
  calm           - Soothing, reassuring, gentle

Pronunciation Dictionaries:
  Use --dictionary to specify a custom pronunciation dictionary for
  brand names and technical terms.

  To create a custom dictionary, add a .pls file to:
    dictionaries/

  Example .pls file:
    <?xml version="1.0" encoding="UTF-8"?>
    <lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
        alphabet="ipa" xml:lang="de">
      <lexeme>
        <grapheme>voss.legal</grapheme>
        <alias>Foss Legahl</alias>
      </lexeme>
    </lexicon>

Timestamps & Captions:
  Use --with-timestamps to generate audio with word-level timing data.
  This creates a JSON file with timestamps for each word, compatible
  with Remotion's @remotion/captions package for animated captions.

  Use --align to get timestamps for existing audio files (forced alignment).
  This is useful when you already have voiceovers and need timing data.

  Use --align-project to align all scenes in a project directory.
  This creates a combined captions file for the entire project.

Timing Validation:
  After generation, the tool automatically validates:
  - Actual vs expected duration (warns if >15% difference)
  - Leading silence (warns if >200ms - audio starts late)
  - Trailing silence (warns if >500ms)
  - Speaking rate (optimal: ~3 words/second for German)

Scene File Format (scenes.json):
{
  "name": "feuchtigkeit",
  "voice": "Vossi",
  "character": "narrator",
  "dictionary": "vosslegal",
  "scenes": [
    {
      "id": "scene1",
      "text": "Text for scene 1",
      "duration": 4,
      "character": "dramatic"
    }
  ]
}
  `);
}

/**
 * List all character presets
 */
function listCharacters() {
  console.log('\nAvailable Character Presets:\n');
  console.log('Name'.padEnd(15) + 'Stability'.padEnd(12) + 'Similarity'.padEnd(12) + 'Style'.padEnd(8) + 'Description');
  console.log('-'.repeat(90));

  for (const [key, preset] of Object.entries(CHARACTER_PRESETS)) {
    console.log(
      key.padEnd(15) +
      preset.stability.toFixed(2).padEnd(12) +
      preset.similarity.toFixed(2).padEnd(12) +
      preset.style.toFixed(2).padEnd(8) +
      preset.description
    );
  }

  console.log('\nUsage:');
  console.log('  --character narrator     # Use narrator style');
  console.log('  --character salesperson  # Use salesperson style');
}

module.exports = {
  parseArgs,
  printHelp,
  listCharacters,
};
