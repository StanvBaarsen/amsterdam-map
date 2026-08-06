// Caching front end for the R2 bucket that hosts the map tiles, running on
// tiles.stanvanbaarsen.nl.
//
// Tiles are read straight off the bucket through the TILES binding. This
// replaced an earlier setup that proxied the bucket's public r2.dev URL: that
// endpoint is rate-limited, never CDN-cached, and serves everything
// uncompressed, which made cold loads painfully slow. Reads still go through
// Cloudflare's edge cache with long-lived headers, so a warm tile costs no R2
// operation at all.

// Tile data changes rarely (only on a full re-upload). If you replace the
// dataset, purge the cache for tiles.stanvanbaarsen.nl in the Cloudflare
// dashboard afterwards.
const CACHE_HEADER = 'public, max-age=604800, s-maxage=2592000, immutable';

export default {
    async fetch(request, env, ctx) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method not allowed', { status: 405 });
        }

        const url = new URL(request.url);
        const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
        const cache = caches.default;

        let response = await cache.match(cacheKey);
        if (!response) {
            const object = await env.TILES.get(url.pathname.replace(/^\//, ''));
            if (object === null) {
                // Edge tiles legitimately 404; don't cache errors.
                return new Response('Not found', {
                    status: 404,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                });
            }
            const headers = new Headers();
            const contentType = object.httpMetadata?.contentType;
            if (contentType) headers.set('Content-Type', contentType);
            headers.set('Cache-Control', CACHE_HEADER);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('ETag', object.httpEtag);
            response = new Response(object.body, { status: 200, headers });
            ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }

        return request.method === 'HEAD'
            ? new Response(null, { status: response.status, headers: response.headers })
            : response;
    },
};
