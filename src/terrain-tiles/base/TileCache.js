// Shared in-memory cache of basemap tile responses keyed by request URL.
// Populated by the prefetch utility during the loading screen so the
// WMTSTilesRenderer can serve tiles without a network round-trip once the
// user opens the map.
export const tileCache = new Map();
