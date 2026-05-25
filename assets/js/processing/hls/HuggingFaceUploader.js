import { Logger } from '../../shared/utils/Logger.js';
import { createRepo, uploadFilesWithProgress } from '@huggingface/hub';

/**
 * Convert a user-friendly repoId + type into the string format expected by @huggingface/hub.
 * - model:   "owner/repo"          → "owner/repo"
 * - dataset: "owner/repo"          → "datasets/owner/repo"
 * - bucket:  "owner/repo"          → "buckets/owner/repo"
 */
function toHfRepoString(repoId, type) {
    if (type === 'dataset') return `datasets/${repoId}`;
    if (type === 'bucket') return `buckets/${repoId}`;
    return repoId; // model (default)
}

/**
 * Public URL of a file in the repo after upload.
 * - model:   https://huggingface.co/{repoId}/resolve/{branch}/{path}
 * - dataset: https://huggingface.co/datasets/{repoId}/resolve/{branch}/{path}
 * - bucket:  https://huggingface.co/buckets/{repoId}/resolve/{path}  (no branch)
 */
function resolveUrl(repoId, type, branch, filePath) {
    if (type === 'bucket') return `https://huggingface.co/buckets/${repoId}/resolve/${filePath}`;
    if (type === 'model') return `https://huggingface.co/${repoId}/resolve/${branch}/${filePath}`;
    return `https://huggingface.co/datasets/${repoId}/resolve/${branch}/${filePath}`;
}

/**
 * Upload HLS files to a Hugging Face repository.
 * Supports model, dataset, and bucket repo types.
 * Uses the official @huggingface/hub SDK — handles NDJSON, XET (bucket), and LFS automatically.
 *
 * @param {Object} opts
 * @param {Map<string, ArrayBuffer>} opts.files - HLS file map from HlsService
 * @param {string} opts.token - HF API token (hf_...)
 * @param {string} opts.repoId - "owner/repo-name"
 * @param {string} [opts.folder=''] - Optional subfolder inside the repo
 * @param {'model'|'dataset'|'bucket'} [opts.type='bucket']
 * @param {string} [opts.branch='main']
 * @param {Function} [opts.onProgress] - Called with 0..1 progress
 * @returns {Promise<string>} Public URL of master.m3u8
 */
export async function uploadToHuggingFace({ files, token, repoId, folder = '', type = 'bucket', branch = 'main', onProgress }) {
    if (!token?.startsWith('hf_')) throw new Error('Token must start with hf_');
    if (!repoId?.includes('/')) throw new Error('Repo ID must be "owner/repo-name"');

    const hfRepo = toHfRepoString(repoId, type);
    const credentials = { accessToken: token };

    Logger.log(`[HFUpload] Creating/verifying repo: ${hfRepo}`);
    try {
        await createRepo({ repo: hfRepo, credentials, private: false });
    } catch (e) {
        if (!e.message?.includes('409') && !e.message?.toLowerCase().includes('already exist')) throw e;
    }

    const hfFiles = [];
    for (const [path, buffer] of files) {
        hfFiles.push({
            path: folder ? `${folder}/${path}` : path,
            content: new Blob([buffer]),
        });
    }

    Logger.log(`[HFUpload] Uploading ${hfFiles.length} files to ${hfRepo}`);
    const total = hfFiles.length;
    const done = new Set();

    for await (const event of uploadFilesWithProgress({
        repo: hfRepo,
        credentials,
        files: hfFiles,
        commitTitle: `Upload HLS stream (${total} files)`,
        branch,
        useXet: type === 'bucket' ? true : undefined,
    })) {
        if (event.event === 'fileProgress' && event.progress === 1 && event.path) {
            done.add(event.path);
            onProgress?.(Math.min(done.size / total, 1));
        }
    }

    const masterPath = folder ? `${folder}/master.m3u8` : 'master.m3u8';
    const url = resolveUrl(repoId, type, branch, masterPath);
    Logger.log(`[HFUpload] Done — ${url}`);
    return url;
}
