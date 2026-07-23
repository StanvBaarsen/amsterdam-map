// @ts-ignore
import { tileCache } from '../terrain-tiles/base/TileCache.js';

// EPSG:28992 (Dutch RD New) tile matrix set used by PDOK BRT WMTS.
// Values mirror /data/basemap/capabilities.xml.
const TOP_LEFT_X = -285401.92;
const TOP_LEFT_Y = 903401.92;
const TILE_SIZE = 256;

interface MatrixDef {
    level: number;
    scaleDenominator: number;
    matrixWidth: number;
    matrixHeight: number;
}

const TILE_MATRIX_SET: MatrixDef[] = [
    { level: 0, scaleDenominator: 12288000, matrixWidth: 1, matrixHeight: 1 },
    { level: 1, scaleDenominator: 6144000, matrixWidth: 2, matrixHeight: 2 },
    { level: 2, scaleDenominator: 3072000, matrixWidth: 4, matrixHeight: 4 },
    { level: 3, scaleDenominator: 1536000, matrixWidth: 8, matrixHeight: 8 },
    { level: 4, scaleDenominator: 768000, matrixWidth: 16, matrixHeight: 16 },
    { level: 5, scaleDenominator: 384000, matrixWidth: 32, matrixHeight: 32 },
    { level: 6, scaleDenominator: 192000, matrixWidth: 64, matrixHeight: 64 },
    { level: 7, scaleDenominator: 96000, matrixWidth: 128, matrixHeight: 128 },
    { level: 8, scaleDenominator: 48000, matrixWidth: 256, matrixHeight: 256 },
    { level: 9, scaleDenominator: 24000, matrixWidth: 512, matrixHeight: 512 },
    { level: 10, scaleDenominator: 12000, matrixWidth: 1024, matrixHeight: 1024 },
    { level: 11, scaleDenominator: 6000, matrixWidth: 2048, matrixHeight: 2048 },
    { level: 12, scaleDenominator: 3000, matrixWidth: 4096, matrixHeight: 4096 },
];

interface BBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

// Amsterdam viewing area in RD New (EPSG:28992) coords. Camera target is clamped
// to roughly 119000-124000 x 484500-488000 (see ThreeViewer onChange handler);
// we pad to cover what the camera frustum can see from the allowed distances.
const WIDE_BBOX: BBox = { minX: 113000, maxX: 130000, minY: 478000, maxY: 494000 };
const TIGHT_BBOX: BBox = { minX: 117500, maxX: 126500, minY: 482500, maxY: 490000 };

const bboxForLevel = (level: number): BBox => (level >= 10 ? TIGHT_BBOX : WIDE_BBOX);

const formatLevel = (level: number) => (level < 10 ? `0${level}` : `${level}`);

const buildUrlsForMatrix = (template: string, matrix: MatrixDef): string[] => {
    const pixelSpan = matrix.scaleDenominator * 0.00028;
    const tileSpan = TILE_SIZE * pixelSpan;
    const bbox = bboxForLevel(matrix.level);

    const minCol = Math.max(0, Math.floor((bbox.minX - TOP_LEFT_X) / tileSpan));
    const maxCol = Math.min(matrix.matrixWidth - 1, Math.floor((bbox.maxX - TOP_LEFT_X) / tileSpan));
    const minRow = Math.max(0, Math.floor((TOP_LEFT_Y - bbox.maxY) / tileSpan));
    const maxRow = Math.min(matrix.matrixHeight - 1, Math.floor((TOP_LEFT_Y - bbox.minY) / tileSpan));

    const levelStr = formatLevel(matrix.level);
    const urls: string[] = [];
    for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
            urls.push(
                template
                    .replace('{TileMatrix}', levelStr)
                    .replace('{TileCol}', String(col))
                    .replace('{TileRow}', String(row))
            );
        }
    }
    return urls;
};

interface PrefetchOptions {
    template: string;
    concurrency?: number;
    onProgress?: (loaded: number, total: number) => void;
    /** Called once every tile up to CRITICAL_MAX_LEVEL is fetched. */
    onCriticalDone?: () => void;
    signal?: AbortSignal;
}

// Levels up to this one block the loading screen; deeper levels (the bulk of
// the data) keep prefetching in the background after the map opens. The map
// opens on a wide view, so only coarse levels are visible immediately —
// deeper tiles either arrive before the user zooms in or stream on demand.
const CRITICAL_MAX_LEVEL = 10;

const fetchUrls = async (
    urls: string[],
    concurrency: number,
    signal: AbortSignal | undefined,
    onTileDone: () => void,
): Promise<void> => {
    let index = 0;
    const worker = async () => {
        while (index < urls.length) {
            if (signal?.aborted) return;
            const url = urls[index++];
            if (!tileCache.has(url)) {
                try {
                    const res = await fetch(url, { signal });
                    if (res.ok) {
                        const buffer = await res.arrayBuffer();
                        tileCache.set(url, buffer);
                    }
                } catch {
                    // Individual tile failures (404 on edge tiles, aborts, etc.) are non-fatal.
                }
            }
            onTileDone();
        }
    };
    const workerCount = Math.max(1, Math.min(concurrency, urls.length));
    await Promise.all(Array.from({ length: workerCount }, worker));
};

export const prefetchBasemap = async ({
    template,
    concurrency = 12,
    onProgress,
    onCriticalDone,
    signal,
}: PrefetchOptions): Promise<void> => {
    const criticalUrls: string[] = [];
    const backgroundUrls: string[] = [];
    for (const matrix of TILE_MATRIX_SET) {
        const target = matrix.level <= CRITICAL_MAX_LEVEL ? criticalUrls : backgroundUrls;
        target.push(...buildUrlsForMatrix(template, matrix));
    }

    // Progress only tracks the critical phase — it drives the loading bar.
    const total = criticalUrls.length;
    let loaded = 0;
    onProgress?.(0, total);

    await fetchUrls(criticalUrls, concurrency, signal, () => {
        loaded++;
        onProgress?.(loaded, total);
    });
    if (signal?.aborted) return;
    onCriticalDone?.();

    // Deep levels: lower concurrency so we don't starve the 3D tiles the user
    // is actually looking at once the map is open.
    await fetchUrls(backgroundUrls, 4, signal, () => {});
};
