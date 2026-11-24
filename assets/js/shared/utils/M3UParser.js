// @ts-check
import { fetchWithPolicy } from '../net/fetchWithPolicy.js';
import { Logger } from "./Logger.js";
import { SERVICES } from '../config/services.js';
/**
 * One #EXTINF entry's details.
 * @typedef {{duration: number, name: string, logo: string, group: string, tvgId: string,
 *   tvgName: string, language: string, country: string}} ChannelInfo
 * @typedef {ChannelInfo & {url: string, id: string}} Channel
 */
/**
 * M3U Playlist Parser
 * Parses IPTV channel lists in M3U/M3U8 format
 */
export class M3UParser {
    /**
     * Parse M3U content
     * @param {string} content - Raw M3U file content
     * @returns {Channel[]} Array of channel objects
     */
    static parse(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        /** @type {Channel[]} */
        const channels = [];

        if (!lines[0]?.toUpperCase().startsWith('#EXTM3U')) {
            Logger.warn('[M3U] Invalid M3U file - missing #EXTM3U header');
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
     * @returns {ChannelInfo}
     * @private
     */
    static _parseExtInf(line) {
        /** @type {ChannelInfo} */
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
        /** @type {Record<string, 'tvgId'|'tvgName'|'logo'|'group'|'language'|'country'>} */
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
     * @returns {Promise<Channel[]>}
     */
    static async fetchAndParse(url) {
        const response = await fetchWithPolicy(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch M3U: ${response.status} ${response.statusText}`);
        }
        const content = await response.text();
        return this.parse(content);
    }

    /**
     * Group channels by category
     * @param {Channel[]} channels
     * @returns {Record<string, Channel[]>}
     */
    static groupByCategory(channels) {
        return channels.reduce((groups, channel) => {
            const group = channel.group || 'Uncategorized';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(channel);
            return groups;
        }, /** @type {Record<string, Channel[]>} */ ({}));
    }

    /**
     * Group channels by country
     * @param {Channel[]} channels
     * @returns {Record<string, Channel[]>}
     */
    static groupByCountry(channels) {
        return channels.reduce((groups, channel) => {
            const country = channel.country || 'Unknown';
            if (!groups[country]) {
                groups[country] = [];
            }
            groups[country].push(channel);
            return groups;
        }, /** @type {Record<string, Channel[]>} */ ({}));
    }

    /**
     * Search channels by name
     * @param {Channel[]} channels
     * @param {string} query
     * @returns {Channel[]}
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
     * @returns {{name: string, url: string, description: string}[]}
     */
    static getSamplePlaylists() {
        return [
            {
                name: 'IPTV-Org (All Countries)',
                url: SERVICES.iptvPlaylists + 'index.m3u',
                description: 'Community-maintained collection of worldwide channels'
            },
            {
                name: 'IPTV-Org (India)',
                url: SERVICES.iptvPlaylists + 'countries/in.m3u',
                description: 'Indian TV channels'
            },
            {
                name: 'IPTV-Org (USA)',
                url: SERVICES.iptvPlaylists + 'countries/us.m3u',
                description: 'US TV channels'
            },
            {
                name: 'IPTV-Org (UK)',
                url: SERVICES.iptvPlaylists + 'countries/uk.m3u',
                description: 'UK TV channels'
            },
            {
                name: 'IPTV-Org (News)',
                url: SERVICES.iptvPlaylists + 'categories/news.m3u',
                description: 'News channels worldwide'
            },
            {
                name: 'IPTV-Org (Sports)',
                url: SERVICES.iptvPlaylists + 'categories/sports.m3u',
                description: 'Sports channels worldwide'
            },
            {
                name: 'IPTV-Org (Entertainment)',
                url: SERVICES.iptvPlaylists + 'categories/entertainment.m3u',
                description: 'Entertainment channels worldwide'
            }
        ];
    }
}
