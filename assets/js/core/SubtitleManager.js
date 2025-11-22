/**
 * Subtitle Manager
 * Handles parsing and management of WebVTT subtitles.
 */
export class SubtitleManager {
    constructor() {
        this.cues = [];
        this.activeCues = [];
    }

    /**
     * Parse WebVTT content
     * @param {string} vttContent 
     */
    parse(vttContent) {
        this.cues = [];
        const lines = vttContent.split(/\r\n|\n|\r/);
        let currentCue = null;

        // Simple VTT parser
        // Skips header "WEBVTT"
        // Looks for timestamps "00:00:00.000 --> 00:00:05.000"

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line || line === 'WEBVTT') continue;

            // Check for timestamp line
            const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s-->\s(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/);

            if (timeMatch) {
                if (currentCue) {
                    this.cues.push(currentCue);
                }

                currentCue = {
                    start: this._parseTime(timeMatch[1]),
                    end: this._parseTime(timeMatch[2]),
                    text: ''
                };
            } else if (currentCue) {
                // Append text to current cue
                currentCue.text += (currentCue.text ? '\n' : '') + line;
            }
        }

        if (currentCue) {
            this.cues.push(currentCue);
        }

        console.log(`Parsed ${this.cues.length} subtitle cues.`);
    }

    /**
     * Get active cues for a specific time
     * @param {number} time - Current time in seconds
     * @returns {Array} Array of active cue objects
     */
    getActiveCues(time) {
        return this.cues.filter(cue => time >= cue.start && time <= cue.end);
    }

    /**
     * Parse timestamp string to seconds
     * @param {string} timeString 
     * @returns {number} Seconds
     * @private
     */
    _parseTime(timeString) {
        const parts = timeString.split(':');
        let seconds = 0;

        if (parts.length === 3) {
            seconds += parseInt(parts[0]) * 3600;
            seconds += parseInt(parts[1]) * 60;
            seconds += parseFloat(parts[2]);
        } else if (parts.length === 2) {
            seconds += parseInt(parts[0]) * 60;
            seconds += parseFloat(parts[1]);
        }

        return seconds;
    }

    clear() {
        this.cues = [];
        this.activeCues = [];
    }
}
