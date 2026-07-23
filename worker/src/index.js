// Caching proxy in front of the R2 public bucket that hosts the map tiles.
//
// The r2.dev public endpoint is rate-limited, never CDN-cached, and serves
// everything uncompressed, which made cold loads painfully slow. This Worker
// runs on tiles.stanvanbaarsen.nl and serves the same objects through
// Cloudflare's edge cache with long-lived cache headers.

const ORIGIN = 'https://pub-b7e9f888ec4543df94637d8bae9ce3c5.r2.dev';

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
            const originResponse = await fetch(`${ORIGIN}${url.pathname}`);
            if (!originResponse.ok) {
                // Edge tiles legitimately 404; don't cache errors.
                return new Response(originResponse.body, {
                    status: originResponse.status,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                });
            }
            const headers = new Headers();
            const contentType = originResponse.headers.get('Content-Type');
            if (contentType) headers.set('Content-Type', contentType);
            headers.set('Cache-Control', CACHE_HEADER);
            headers.set('Access-Control-Allow-Origin', '*');
            response = new Response(originResponse.body, { status: 200, headers });
            ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }

        return request.method === 'HEAD'
            ? new Response(null, { status: response.status, headers: response.headers })
            : response;
    },
};
