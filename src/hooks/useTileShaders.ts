import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createPaletteTexture } from '../utils/colors'; 
import storylinesData from '../assets/storylines.json';

export const useTileShaders = (
    currentYear: number,
    storylineIndex: number,
    storylineMode: 'overview' | 'focus',
    needsRerender: React.MutableRefObject<number>
) => {
    const coloredMaterialRef = useRef<THREE.Material>(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));

    // Palettes state
    const [palettes] = useState(() => ({
        default: createPaletteTexture('default'),
        grayscale: createPaletteTexture('grayscale'),
        technical: createPaletteTexture('technical')
    }));

    useEffect(() => {
        coloredMaterialRef.current.onBeforeCompile = (shader) => {
            shader.uniforms.currentYear = { value: 2026 };
            shader.uniforms.saturation = { value: 1.0 };
            
            // Add palette texture uniform
            shader.uniforms.paletteTexture = { value: palettes.default };

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
                varying float vConstructionYear;
                ${shader.fragmentShader}
            `.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                // Override vertex color with palette lookup
                // Map years 1200...2030 to 0..1 texture coordinates
                if (vConstructionYear > 10.0) {
                    float normYear = clamp((vConstructionYear - 1200.0) / (2030.0 - 1200.0), 0.0, 1.0);
                    vec4 paletteColor = texture2D(paletteTexture, vec2(normYear, 0.5));
                    diffuseColor.rgb = paletteColor.rgb;
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
                shader.uniforms.currentYear.value = typeof currentYear === 'number' ? currentYear : 2026;
            }
            
            let sat = 1.0;
            if (shader.uniforms.saturation) {
                shader.uniforms.saturation.value = sat;
            }

            // Update Palette based on Storyline Data
            if (shader.uniforms.paletteTexture) {
                const currentChapter = storylinesData[storylineIndex] as any;
                const paletteName = storylineMode === 'focus' && currentChapter?.palette 
                    ? currentChapter.palette 
                    : 'default';
                
                shader.uniforms.paletteTexture.value = palettes[paletteName as keyof typeof palettes] || palettes.default;
            }

            needsRerender.current = 1;
        }
    }, [currentYear, storylineIndex, storylineMode, palettes, needsRerender]);

    return coloredMaterialRef;
};
