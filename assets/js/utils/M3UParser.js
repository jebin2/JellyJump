/**
 * M3U Playlist Parser
 * Parses IPTV channel lists in M3U/M3U8 format
 */
export class M3UParser {
    /**
     * Parse M3U content
     * @param {string} content - Raw M3U file content
     * @returns {Array<Object>} Array of channel objects
     */
    static parse(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        const channels = [];

        if (!lines[0]?.toUpperCase().startsWith('#EXTM3U')) {
            console.warn('[M3U] Invalid M3U file - missing #EXTM3U header');
        }

        let currentInfo = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('#EXTINF:')) {
                currentInfo = this._parseExtInf(line);
            } else if (line && !line.startsWith('#') && currentInfo) {
                channels.push({
                    ...currentInfo,
                    url: line,
                    id: this._generateId()
                });
                currentInfo = null;
            }
        }

        return channels;
    }

    /**
     * Parse #EXTINF line
     * Format: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name
     * @param {string} line
     * @returns {Object}
     * @private
     */
    static _parseExtInf(line) {
        const info = {
            duration: -1,
            name: '',
            logo: '',
            group: '',
            tvgId: '',
            tvgName: '',
            language: '',
            country: ''
        };

        // Extract duration
        const durationMatch = line.match(/#EXTINF:(-?\d+)/);
        if (durationMatch) {
            info.duration = parseInt(durationMatch[1], 10);
        }

        // Extract attributes using regex
        const attrPatterns = {
            'tvg-id': 'tvgId',
            'tvg-name': 'tvgName',
            'tvg-logo': 'logo',
            'group-title': 'group',
            'tvg-language': 'language',
            'tvg-country': 'country'
        };

        for (const [attr, prop] of Object.entries(attrPatterns)) {
            const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
            const match = line.match(regex);
            if (match) {
                info[prop] = match[1];
            }
        }

        // Extract channel name (after the last comma)
        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) {
            info.name = nameMatch[1].trim();
        }

        // Fallback to tvg-name if name not found
        if (!info.name && info.tvgName) {
            info.name = info.tvgName;
        }

        return info;
    }

    /**
     * Generate unique ID
     * @returns {string}
     * @private
     */
    static _generateId() {
        return 'ch_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Fetch and parse M3U from URL
     * @param {string} url
     * @returns {Promise<Array<Object>>}
     */
    static async fetchAndParse(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch M3U: ${response.statusText}`);
        }
        const content = await response.text();
        return this.parse(content);
    }

    /**
     * Group channels by category
     * @param {Array<Object>} channels
     * @returns {Object<string, Array<Object>>}
     */
    static groupByCategory(channels) {
        return channels.reduce((groups, channel) => {
            const group = channel.group || 'Uncategorized';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(channel);
            return groups;
        }, {});
    }

    /**
     * Group channels by country
     * @param {Array<Object>} channels
     * @returns {Object<string, Array<Object>>}
     */
    static groupByCountry(channels) {
        return channels.reduce((groups, channel) => {
            const country = channel.country || 'Unknown';
            if (!groups[country]) {
                groups[country] = [];
            }
            groups[country].push(channel);
            return groups;
        }, {});
    }

    /**
     * Search channels by name
     * @param {Array<Object>} channels
     * @param {string} query
     * @returns {Array<Object>}
     */
    static search(channels, query) {
        if (!query) return channels;

        const lowerQuery = query.toLowerCase();
        return channels.filter(channel =>
            channel.name.toLowerCase().includes(lowerQuery) ||
            channel.group.toLowerCase().includes(lowerQuery) ||
            channel.tvgName.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get sample IPTV playlists for testing
     * @returns {Array<Object>}
     */
    static getSamplePlaylists() {
        return [
            {
                name: 'IPTV-Org (All Countries)',
                url: 'https://iptv-org.github.io/iptv/index.m3u',
                description: 'Community-maintained collection of worldwide channels'
            },
            {
                name: 'IPTV-Org (India)',
                url: 'https://iptv-org.github.io/iptv/countries/in.m3u',
                description: 'Indian TV channels'
            },
            {
                name: 'IPTV-Org (USA)',
                url: 'https://iptv-org.github.io/iptv/countries/us.m3u',
                description: 'US TV channels'
            },
            {
                name: 'IPTV-Org (UK)',
                url: 'https://iptv-org.github.io/iptv/countries/uk.m3u',
                description: 'UK TV channels'
            },
            {
                name: 'IPTV-Org (News)',
                url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
                description: 'News channels worldwide'
            },
            {
                name: 'IPTV-Org (Sports)',
                url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
                description: 'Sports channels worldwide'
            },
            {
                name: 'IPTV-Org (Entertainment)',
                url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u',
                description: 'Entertainment channels worldwide'
            }
        ];
    }
}
