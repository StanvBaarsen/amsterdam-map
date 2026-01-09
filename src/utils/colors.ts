import * as THREE from 'three';

export const getBuildingColor = (year: number) => {
    if (!year) return new THREE.Color(0xeeeeee); // Unknown: Light Grey

    if (year < 1400) return new THREE.Color(0x902020); // < 1400: Lighter Dark Red (was 550000)
    if (year < 1500) return new THREE.Color(0xa03030); // 1400-1500: Lighter Medium Dark Red (was 770000)
    if (year < 1600) return new THREE.Color(0xb04040); // 1500-1600: Lighter Red (was 990000)
    if (year < 1700) return new THREE.Color(0xbb1100); // 1600-1700: Bright Red
    if (year < 1800) return new THREE.Color(0xdd3300); // 1700-1800: Red-Orange
    if (year < 1900) return new THREE.Color(0xff5500); // 1800-1900: Orange-Red
    if (year < 2000) return new THREE.Color(0xff7700); // 1900-2000: Orange
    return new THREE.Color(0xff9900); // > 2000: Light Orange
};

type ColorStop = { year: number; color: string };

export const PALETTES: Record<string, ColorStop[]> = {
    default: [
        { year: 0, color: '#902020' },     // Lighter Dark Red (matches getBuildingColor < 1400)
        { year: 1400, color: '#8f1f1f' },  // Red
        { year: 1500, color: '#bf2c2c' },  // Bright Red
        { year: 1600, color: '#d95d5d' },  // Light Red
        { year: 1700, color: '#9e79a1' },  // Purple Transition
        { year: 1800, color: '#6889ba' },  // Blue Transition
        { year: 1900, color: '#4473ad' },  // Blue
        { year: 2000, color: '#244f7d' }   // Dark Blue
    ],
    grayscale: [
        { year: 0, color: '#333333' },
        { year: 1600, color: '#666666' },
        { year: 1800, color: '#999999' },
        { year: 1900, color: '#cccccc' },
        { year: 2000, color: '#ffffff' }
    ],
    future: [
        { year: 0, color: '#224477' },
        { year: 1600, color: '#335588' },
        { year: 1800, color: '#005599' },
        { year: 1900, color: '#0077cc' },
        { year: 2000, color: '#0099ff' }
    ]
};

export const createPaletteTexture = (paletteName: string = 'default'): THREE.DataTexture => {
    const stops = PALETTES[paletteName] || PALETTES['default'];
    // Create a texture that maps years 1200 to 2030 to colors
    // Width can be 1024 to give year-level precision or 256 for interpolation
    const width = 1024;
    const data = new Uint8Array(4 * width);
    const minYear = 1200;
    const maxYear = 2030;

    const getColorForYear = (y: number) => {
        // Find applicable stop
        // Stops are defined as "starting at year X, use color Y"
        // Or "up to year X"? Current getBuildingColor Logic:
        // year < 1400 -> Dark Red. So 0..1399 -> Dark Red.
        // The structure above: 0->DarkRed, 1400->MedDarkRed.
        // This means [0, 1400) uses index 0.
        
        let colorHex = stops[0].color;
        for (let i = 0; i < stops.length; i++) {
            if (y >= stops[i].year) {
                colorHex = stops[i].color;
            } else {
                break;
            }
        }
        return new THREE.Color(colorHex);
    };

    for (let i = 0; i < width; i++) {
        const t = i / (width - 1);
        const year = minYear + t * (maxYear - minYear);
        const color = getColorForYear(year);
        
        data[i * 4] = Math.floor(color.r * 255);
        data[i * 4 + 1] = Math.floor(color.g * 255);
        data[i * 4 + 2] = Math.floor(color.b * 255);
        data[i * 4 + 3] = 255; // Alpha
    }

    const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    return texture;
};
