import * as THREE from 'three';

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
                    // REMOVED: Redundant 'colors' buffer. The shader calculates color based on constructionYear.
                    // This saves 12 bytes per vertex (approx 75% of our custom data overhead).
                    // const colors = new Float32Array(count * 3);
                    const years = new Float32Array(count);
                    const batchIds = batchIdAttr.array;

                    for (let i = 0; i < count; i++) {
                        const batchId = Math.round(batchIds[i]);
                        const year = (batchId >= 0 && batchId < constructionYears.length) ? constructionYears[batchId] : 0;

                        // const color = getBuildingColor(year);
                        // colors[i * 3] = color.r;
                        // colors[i * 3 + 1] = color.g;
                        // colors[i * 3 + 2] = color.b;
                        
                        years[i] = year;
                    }
                    // geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    geometry.setAttribute('constructionYear', new THREE.BufferAttribute(years, 1));
                    // Remove existing normals to ensure flat shading works correctly
                    geometry.deleteAttribute('normal');
                    // Ensure vertexColors is false to avoid warnings or unexpected behavior since we removed the attr
                    // Actually, the material is shared and has vertexColors: true. 
                    // But since we override the shader, it doesn't matter if the attribute is missing 
                    // AS LONG AS the shader doesn't crash trying to read it in the #include <color_vertex> block.
                    // The standard <color_vertex> usually guards with #ifdef USE_COLOR.
                    // We need to ensure USE_COLOR is FALSE for this geometry if we don't provide the attribute.
                    // c.material is coloredMaterial which has vertexColors: true.
                    // This forces USE_COLOR to be defined in the shader.
                    // If USE_COLOR is defined, Three.js EXPECTS a 'color' attribute.
                    // If we remove it, we might get a WebGL warning or crash on some drivers.
                    
                    // SOLUTION: We must EITHER provide the attribute OR set vertexColors: false.
                    // But we share the material. We validly want "custom shader logic" which we are injecting.
                    // The shader injection uses 'constructionYear'.
                    
                    // Let's create a dummy color attribute of size 0? No that crashes.
                    // We can clone the material? No, that increases draw calls (breaks batching).
                    
                    // ALTERNATIVE: Keep vertexColors: true, but provide a tiny dummy attribute? 
                    // No, attribute must match vertex count.
                    
                    // WAIT. If we really want to save memory, we should fix the MATERIAL.
                    // The material is defined in useTileShaders.ts:
                    // new THREE.MeshLambertMaterial({ vertexColors: true ... })
                    
                    // If we change that to vertexColors: false, Three.js won't look for the 'color' attribute.
                    // Our custom shader injection happens in onBeforeCompile.
                    // Does onBeforeCompile still get the <color_fragment> include if vertexColors is false?
                    // THREE.MeshLambertMaterial shaders definitely include common chunks.
                    // But <color_fragment> usually looks like:
                    // #ifdef USE_COLOR
                    //     diffuseColor.rgb *= vColor;
                    // #endif
                    
                    // If vertexColors is false, USE_COLOR is undefined. The block is skipped.
                    // Our injection is: `.replace('#include <color_fragment>', '... our logic ...')`
                    // If the string '#include <color_fragment>' is present in the source, we can replace it.
                    // It IS present in the template regardless of defines.
                    // So we can safely turn off vertexColors in the material, and remove the attribute here!
                    
                    // Clone the material to ensure it is unique for this tile.
                    // This is SAFER than sharing, as 3d-tiles-renderer may dispose materials on unload.
                    // Cloning a material is cheap (JS object), and Three.js will reuse the Program (Shader) if
                    // parameters are identical, so GPU overhead is negligible and stability is improved.
                    c.material = coloredMaterial.clone();
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
