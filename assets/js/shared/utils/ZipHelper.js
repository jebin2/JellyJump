/**
 * Minimal stored-ZIP builder (DEFLATE method 0 — no compression).
 * Suitable for packaging HLS segments which are already compressed video data.
 */
export class ZipHelper {
    /**
     * Build a ZIP ArrayBuffer from a Map of path → ArrayBuffer entries.
     * Single-pass: pre-computes metadata, then writes directly into one output buffer.
     * @param {Map<string, ArrayBuffer>} files
     * @returns {ArrayBuffer}
     */
    static build(files) {
        const encoder = new TextEncoder();

        // Pre-pass: compute metadata without copying data
        const entries = [];
        let localSize = 0;
        for (const [path, buffer] of files) {
            const nameBytes = encoder.encode(path);
            const data = new Uint8Array(buffer);
            entries.push({ nameBytes, data, crc: ZipHelper._crc32(data), localOffset: localSize });
            localSize += 30 + nameBytes.length + data.byteLength;
        }

        const centralSize = entries.reduce((n, e) => n + 46 + e.nameBytes.length, 0);
        const zip = new Uint8Array(localSize + centralSize + 22);
        const v = new DataView(zip.buffer);
        let p = 0;

        // Local file entries
        for (const { nameBytes, data, crc } of entries) {
            v.setUint32(p, 0x04034b50, true); p += 4; // signature
            v.setUint16(p, 20, true);          p += 2; // version needed
            v.setUint16(p, 0, true);           p += 2; // flags
            v.setUint16(p, 0, true);           p += 2; // compression: stored
            v.setUint32(p, 0, true);           p += 4; // mod time + mod date
            v.setUint32(p, crc, true);         p += 4; // crc-32
            v.setUint32(p, data.byteLength, true); p += 4; // compressed size
            v.setUint32(p, data.byteLength, true); p += 4; // uncompressed size
            v.setUint16(p, nameBytes.length, true); p += 2; // file name length
            v.setUint16(p, 0, true);           p += 2; // extra field length
            zip.set(nameBytes, p);             p += nameBytes.length;
            zip.set(data, p);                  p += data.byteLength;
        }

        // Central directory
        for (const { nameBytes, data, crc, localOffset } of entries) {
            v.setUint32(p, 0x02014b50, true); p += 4; // signature
            v.setUint16(p, 20, true);          p += 2; // version made by
            v.setUint16(p, 20, true);          p += 2; // version needed
            v.setUint16(p, 0, true);           p += 2; // flags
            v.setUint16(p, 0, true);           p += 2; // compression: stored
            v.setUint32(p, 0, true);           p += 4; // mod time + mod date
            v.setUint32(p, crc, true);         p += 4; // crc-32
            v.setUint32(p, data.byteLength, true); p += 4; // compressed size
            v.setUint32(p, data.byteLength, true); p += 4; // uncompressed size
            v.setUint16(p, nameBytes.length, true); p += 2; // file name length
            v.setUint32(p, 0, true);           p += 4; // extra + comment length
            v.setUint32(p, 0, true);           p += 4; // disk number + internal attrs
            v.setUint32(p, 0, true);           p += 4; // external attributes
            v.setUint32(p, localOffset, true); p += 4; // local header offset
            zip.set(nameBytes, p);             p += nameBytes.length;
        }

        // End of central directory
        v.setUint32(p, 0x06054b50, true);         p += 4; // signature
        v.setUint32(p, 0, true);                   p += 4; // disk numbers
        v.setUint16(p, entries.length, true);      p += 2; // entries on disk
        v.setUint16(p, entries.length, true);      p += 2; // total entries
        v.setUint32(p, centralSize, true);         p += 4; // central dir size
        v.setUint32(p, localSize, true);           p += 4; // central dir offset
        v.setUint16(p, 0, true);                            // comment length

        return zip.buffer;
    }

    static _crc32(data) {
        if (!ZipHelper._table) {
            const t = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
                t[i] = c;
            }
            ZipHelper._table = t;
        }
        let crc = 0xffffffff;
        for (let i = 0; i < data.length; i++) crc = ZipHelper._table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
    }
}
