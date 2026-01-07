// src/utils/coords.ts

/**
 * Converts WGS84 coordinates (Latitude, Longitude) to Dutch RD coordinates (Rijksdriehoeksstelsel).
 * Based on the official approximation formula.
 * 
 * @param latitude Latitude in decimal degrees
 * @param longitude Longitude in decimal degrees
 * @returns Object containing x and y in RD coordinates (meters)
 */
export function wgs84ToRd(latitude: number, longitude: number): { x: number, y: number } {
    const referenceLat = 52.15517440;
    const referenceLon = 5.38720621;
    const referenceX = 155000;
    const referenceY = 463000;

    const dLat = 0.36 * (latitude - referenceLat);
    const dLon = 0.36 * (longitude - referenceLon);

    const x = referenceX
        + 190094.945 * dLon
        - 11832.228 * dLat * dLon
        - 114.221 * Math.pow(dLat, 2) * dLon
        - 32.391 * Math.pow(dLon, 3)
        - 0.705 * dLat
        - 2.340 * Math.pow(dLat, 3) * dLon
        - 0.608 * dLat * Math.pow(dLon, 3);

    const y = referenceY
        + 309056.544 * dLat
        + 3638.893 * Math.pow(dLon, 2)
        - 157.984 * dLat * Math.pow(dLon, 2)
        + 72.971 * Math.pow(dLat, 2)
        + 59.797 * Math.pow(dLat, 3)
        - 6.434 * Math.pow(dLat, 2) * Math.pow(dLon, 2)
        + 0.093 * Math.pow(dLon, 4);

    return { x: x, y: y };
}
