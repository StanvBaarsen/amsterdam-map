import * as THREE from 'three';
import { getBuildingColor } from './colors';

export const processTileColors = (scene: THREE.Object3D | THREE.Group, tile: any, coloredMaterial: THREE.Material, defaultMaterial: THREE.Material) => {
    // Check if we've already processed this tile
    // Removed caching check to ensure re-loaded tiles get colored correctly
    // if (tile._colorsProcessed) return;

    // Try to find batch table in various locations
    const batchTable = tile.batchTable ||
        tile.content?.batchTable ||
        // @ts-ignore
        scene.batchTable ||
        // @ts-ignore
        tile.cached?.batchTable;

    let constructionYears: any = null;

    if (batchTable) {
        // Helper to get data with fallback for deprecated API
        const getData = (key: string) => {
            // 3d-tiles-renderer v0.3+ uses getPropertyArray
            if (batchTable.getPropertyArray) return batchTable.getPropertyArray(key);
            // Fallback for older versions
            if (batchTable.getData) return batchTable.getData(key);
            return null;
        };

        // Parse construction years
        // 1. Try direct access
        constructionYears = getData('bouwjaar') ||
            getData('construction_year') ||
            getData('oorspronkelijkbouwjaar');

        // 2. If not found, check for 'attributes'
        if (!constructionYears) {
            let attributes = getData('attributes');
            if (!attributes && batchTable.json && batchTable.json.attributes) {
                attributes = batchTable.json.attributes;
            }

            if (attributes) {
                constructionYears = attributes.map((attr: any) => {
                    let data = attr;
                    if (typeof attr === 'string') {
                        try {
                            data = JSON.parse(attr);
                        } catch (e) { return 0; }
                    }
                    return data?.oorspronkelijkbouwjaar || data?.bouwjaar || 0;
                });
            }
        }
    }

    if (constructionYears) {
        scene.traverse((c: any) => {
            if (c.isMesh) {
                let geometry = c.geometry;

                // CRITICAL MEMORY FIX:
                // Dispose of the original material AND its textures.
                // GLTFLoader typically creates unique materials/textures for tiles. 
                // Since we replace them, all these textures become orphaned in GPU memory if not disposed.
                if (c.material && c.material !== coloredMaterial && c.material !== defaultMaterial) {
                    const mat = c.material;
                    // Dispose textures
                    if (mat.map) mat.map.dispose();
                    if (mat.emissiveMap) mat.emissiveMap.dispose();
                    if (mat.roughnessMap) mat.roughnessMap.dispose();
                    if (mat.metalnessMap) mat.metalnessMap.dispose();
                    if (mat.normalMap) mat.normalMap.dispose();
                    if (mat.aoMap) mat.aoMap.dispose();
                    
                    mat.dispose();
                }

                // Ensure geometry is non-indexed to support per-face coloring (hard edges)
                if (geometry.index) {
                    const oldGeometry = geometry;
                    geometry = geometry.toNonIndexed();
                    c.geometry = geometry;
                    // Dispose of the original indexed geometry
                    oldGeometry.dispose();
                }

                const batchIdAttr = geometry.getAttribute('_batchid');
                if (batchIdAttr) {
                    const count = geometry.attributes.position.count;
                    const colors = new Float32Array(count * 3);
                    const years = new Float32Array(count);
                    const batchIds = batchIdAttr.array;

                    for (let i = 0; i < count; i++) {
                        const batchId = Math.round(batchIds[i]);
                        const year = (batchId >= 0 && batchId < constructionYears.length) ? constructionYears[batchId] : 0;

                        const color = getBuildingColor(year);
                        colors[i * 3] = color.r;
                        colors[i * 3 + 1] = color.g;
                        colors[i * 3 + 2] = color.b;
                        
                        years[i] = year;
                    }
                    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    geometry.setAttribute('constructionYear', new THREE.BufferAttribute(years, 1));
                    // Remove existing normals to ensure flat shading works correctly
                    geometry.deleteAttribute('normal');
                    
                    // Reverted: Use shared material without cloning.
                    // This is essential for draw call batching and performance ("slideshow" fix).
                    // The potential crashing issue due to shared material disposal is mitigated
                    // by ensuring 3d-tiles-renderer does not own this material instance.
                    c.material = coloredMaterial;
                }
            }
        });
        // Only mark processed if we successfully applied colors
        // @ts-ignore
        tile._colorsProcessed = true;
    } else {
        // Fallback for meshes without data
        scene.traverse((c: any) => {
            if (c.isMesh &&
                c.material !== defaultMaterial &&
                c.material !== coloredMaterial) {
                
                // Dispose old material AND textures
                if (c.material) {
                    const mat = c.material;
                    if (mat.map) mat.map.dispose();
                    if (mat.emissiveMap) mat.emissiveMap.dispose();
                    if (mat.roughnessMap) mat.roughnessMap.dispose();
                    if (mat.metalnessMap) mat.metalnessMap.dispose();
                    if (mat.normalMap) mat.normalMap.dispose();
                    if (mat.aoMap) mat.aoMap.dispose();
                    mat.dispose();
                }
                
                c.material = defaultMaterial;
            }
        });
        // @ts-ignore
        tile._colorsProcessed = true; // Mark as processed even if no data found to avoid retrying
    }
};
