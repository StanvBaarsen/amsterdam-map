import * as THREE from 'three';

export const getBuildingColor = (year: number) => {
    if (!year) return new THREE.Color(0xeeeeee); // Unknown: Light Grey

    if (year < 1400) return new THREE.Color(0x550000); // < 1400: Dark Red
    if (year < 1500) return new THREE.Color(0x770000); // 1400-1500: Medium Dark Red
    if (year < 1600) return new THREE.Color(0x990000); // 1500-1600: Red
    if (year < 1700) return new THREE.Color(0xbb1100); // 1600-1700: Bright Red
    if (year < 1800) return new THREE.Color(0xdd3300); // 1700-1800: Red-Orange
    if (year < 1900) return new THREE.Color(0xff5500); // 1800-1900: Orange-Red
    if (year < 2000) return new THREE.Color(0xff7700); // 1900-2000: Orange
    return new THREE.Color(0xff9900); // > 2000: Light Orange
};
