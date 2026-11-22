/**
 * Edited and converted copies, kept on disk (ARCHITECTURE_PLAN.md, G4).
 *
 * In the browser a tool's result is stored in IndexedDB. The desktop app had
 * nowhere to put one: it stayed in memory, so it was gone after a restart
 * and the edit panel could not keep its Undo history (BUG-6 was the worst of
 * it). Now each copy is a file in the app's data folder, named after the
 * playlist item it belongs to (`<id>__<name>`; ids are UUIDs, which have
 * dashes), and the playlist reads it
 * back by path like any other file.
 *
 * The window writes a copy in chunks (a long video is too big for one
 * message) and asks for one by item id, never by path: deleting or reading
 * can only ever reach this folder, not the user's own files.
 */
const fs = require('fs');
const path = require('path');

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** @param {string} name */
function safeName(name) {
    const base = path.basename(String(name || 'copy')).replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
    return base || 'copy';
}

/** @param {{dir: string}} options */
function createCopies({ dir }) {
    /** @type {Map<string, {handle: import('fs').promises.FileHandle, temp: string, final: string}>} */
    const writing = new Map();

    function checkId(id) {
        if (typeof id !== 'string' || !ID.test(id)) throw new Error('Invalid copy id');
        return id;
    }

    async function find(id) {
        checkId(id);
        let names;
        try { names = await fs.promises.readdir(dir); } catch { return null; }
        const name = names.find((n) => n.startsWith(`${id}__`) && !n.endsWith('.part'));
        return name ? path.join(dir, name) : null;
    }

    return {
        dir,

        /** Whether a resolved path is a copy in this folder. */
        contains(p) {
            return path.dirname(p) === dir && !p.endsWith('.part');
        },

        async begin(id, name) {
            checkId(id);
            await fs.promises.mkdir(dir, { recursive: true });
            const final = path.join(dir, `${id}__${safeName(name)}`);
            const temp = `${final}.part`;
            await writing.get(id)?.handle.close().catch(() => {});
            writing.set(id, { handle: await fs.promises.open(temp, 'w'), temp, final });
        },

        async write(id, chunk) {
            const entry = writing.get(checkId(id));
            if (!entry) throw new Error('No copy is being written for that id');
            await entry.handle.write(Buffer.from(chunk));
        },

        /** @returns {Promise<string>} the copy's path */
        async finish(id) {
            const entry = writing.get(checkId(id));
            if (!entry) throw new Error('No copy is being written for that id');
            writing.delete(id);
            await entry.handle.close();
            // Only a whole file takes the name: a copy cut short stays .part.
            const old = await find(id);
            if (old && old !== entry.final) await fs.promises.unlink(old).catch(() => {});
            await fs.promises.rename(entry.temp, entry.final);
            return entry.final;
        },

        async abort(id) {
            const entry = writing.get(checkId(id));
            writing.delete(id);
            if (!entry) return;
            await entry.handle.close().catch(() => {});
            await fs.promises.unlink(entry.temp).catch(() => {});
        },

        find,

        async remove(id) {
            const file = await find(id);
            if (file) await fs.promises.unlink(file).catch(() => {});
            return !!file;
        },

        /** The ids of the copies there are. */
        async ids() {
            let names;
            try { names = await fs.promises.readdir(dir); } catch { return []; }
            return names.filter((n) => !n.endsWith('.part')).map((n) => n.split('__')[0]).filter((id) => ID.test(id));
        },

        /** Leftovers of copies a crash cut short. */
        async sweepPartial() {
            let names;
            try { names = await fs.promises.readdir(dir); } catch { return; }
            for (const n of names) if (n.endsWith('.part')) await fs.promises.unlink(path.join(dir, n)).catch(() => {});
        },
    };
}

module.exports = { createCopies };
