import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createPaletteTexture } from '../utils/colors'; 

export const useTileShaders = (
    currentYear: number,
    needsRerender: React.MutableRefObject<number>
) => {
    const coloredMaterialRef = useRef<THREE.Material>(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));

    // Palettes state
    const [palettes] = useState(() => ({
        default: createPaletteTexture('default'),
        grayscale: createPaletteTexture('grayscale'),
        technical: createPaletteTexture('technical'),
        future: createPaletteTexture('future')
    }));

    useEffect(() => {
        coloredMaterialRef.current.onBeforeCompile = (shader) => {
            shader.uniforms.currentYear = { value: new Date().getFullYear() };
            shader.uniforms.saturation = { value: 1.0 };
            
            // Add palette texture uniforms
            shader.uniforms.paletteTexture = { value: palettes.default };
            shader.uniforms.paletteTextureNext = { value: palettes.default };
            shader.uniforms.paletteMix = { value: 0.0 };

            shader.vertexShader = `
                attribute float constructionYear;
                varying float vConstructionYear;
                ${shader.vertexShader}
            `.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vConstructionYear = constructionYear;
                `
            );
            shader.fragmentShader = `
                uniform float currentYear;
                uniform float saturation;
                uniform sampler2D paletteTexture;
                uniform sampler2D paletteTextureNext;
                uniform float paletteMix;
                varying float vConstructionYear;
                ${shader.fragmentShader}
            `.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                // Override vertex color with palette lookup
                // Map years 1200...2026 to 0..1 texture coordinates
                if (vConstructionYear > 10.0) {
                    float normYear = clamp((vConstructionYear - 1200.0) / (2026.0 - 1200.0), 0.0, 1.0);
                    vec4 colorA = texture2D(paletteTexture, vec2(normYear, 0.5));
                    vec4 colorB = texture2D(paletteTextureNext, vec2(normYear, 0.5));
                    diffuseColor.rgb = mix(colorA.rgb, colorB.rgb, paletteMix);
                } else {
                    // Unknown year (0) -> Light Grey
                    diffuseColor.rgb = vec3(0.933, 0.933, 0.933); 
                }
                `
            ).replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                if (vConstructionYear > currentYear && vConstructionYear > 0.0) discard;

                const vec3 grayWeights = vec3(0.299, 0.587, 0.114);
                vec3 gray = vec3(dot(gl_FragColor.rgb, grayWeights));
                gl_FragColor.rgb = mix(gray, gl_FragColor.rgb, saturation);
                `
            );
            // @ts-ignore
            coloredMaterialRef.current.userData.shader = shader;
        };
        coloredMaterialRef.current.needsUpdate = true;
    }, [palettes]);

    useEffect(() => {
        // @ts-ignore
        const shader = coloredMaterialRef.current?.userData?.shader;
        if (shader) {
            if (shader.uniforms.currentYear) {
                // Ensure currentYear is a number to prevent GLSL uniform type mismatch
                shader.uniforms.currentYear.value = Number(currentYear) || new Date().getFullYear();
            }
            
            let sat = 1.0;
            if (shader.uniforms.saturation) {
                shader.uniforms.saturation.value = sat;
            }

            // The map-only experience uses the default palette.
            if (shader.uniforms.paletteTexture && shader.uniforms.paletteTextureNext) {
                shader.uniforms.paletteTexture.value = palettes.default;
                shader.uniforms.paletteTextureNext.value = palettes.default;
                shader.uniforms.paletteMix.value = 0;
            }

            needsRerender.current = 1;
        }
    }, [currentYear, palettes, needsRerender]);

    return coloredMaterialRef;
};
