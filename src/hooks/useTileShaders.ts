import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
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
        technical: createPaletteTexture('technical'),
        future: createPaletteTexture('future')
    }));

    // Animation State
    const animState = useRef({
        fromPalette: 'default',
        toPalette: 'default',
        mix: 0
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tweenRef = useRef<any>(null);

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
                // Map years 1200...2030 to 0..1 texture coordinates
                if (vConstructionYear > 10.0) {
                    float normYear = clamp((vConstructionYear - 1200.0) / (2030.0 - 1200.0), 0.0, 1.0);
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

            // Determine Target Palette
            let targetPaletteName = 'default';
            if (currentYear >= 2029) {
                targetPaletteName = 'future';
            } else {
                const currentChapter = storylinesData[storylineIndex] as any;
                if (storylineMode === 'focus' && currentChapter?.palette) {
                    targetPaletteName = currentChapter.palette;
                }
            }

            // Handle Palette Transition
            if (shader.uniforms.paletteTexture && shader.uniforms.paletteTextureNext) {
                
                const s = animState.current;

                if (targetPaletteName !== s.toPalette) {
                    // Change detected
                    
                    if (targetPaletteName === s.fromPalette) {
                        // Reversing: Going back to where we started
                        // E.g. A -> B (at 0.5), now target is A.
                        // We continue with textures as is (A, B) but animate mix back to 0.
                        s.toPalette = targetPaletteName; // = A
                        // s.fromPalette is already A
                        
                        if (tweenRef.current) tweenRef.current.stop();
                        
                        const startM = s.mix;
                        tweenRef.current = new TWEEN.Tween({ m: startM })
                            .to({ m: 0 }, 1000 * (startM)) // faster if closer
                            .easing(TWEEN.Easing.Quadratic.Out)
                            .onUpdate((obj) => {
                                s.mix = obj.m;
                                shader.uniforms.paletteMix.value = obj.m;
                                needsRerender.current = 1;
                            })
                            .start();

                    } else {
                        // New Target C (or B from A)
                        // If we were already at B (Mix=1), then From=B.
                        // If we were at A (Mix=0), From=A.
                        
                        // Hard set Start to current visual endpoint if settled
                        if (s.mix >= 0.99) {
                            s.fromPalette = s.toPalette;
                            s.mix = 0;
                        } 
                        else if (s.mix <= 0.01) {
                            // s.fromPalette is correct
                            s.mix = 0;
                        } else {
                            // Interrupted A->B. Now -> C.
                            // Hard jump: Assume From=B (destination of prev) ?? 
                            // Or From=A (source of prev).
                            // Let's reset to "From = Current To" to minimize perceived error if we were close? 
                            // No, safer to just reset mixing.
                            // JUMP: From = Old "To" (because we probably want to chain?)
                            // Let's just set From = s.toPalette (the one we were transitioning TO). 
                            // And mix = 0. (So we act like we finished).
                            s.fromPalette = s.toPalette;
                            s.mix = 0;
                        }

                        s.fromPalette = s.toPalette; // The old "To" becomes the new "Start"
                        s.toPalette = targetPaletteName;
                        s.mix = 0;

                         // Set Uniforms
                         shader.uniforms.paletteTexture.value = palettes[s.fromPalette as keyof typeof palettes] || palettes.default;
                         shader.uniforms.paletteTextureNext.value = palettes[s.toPalette as keyof typeof palettes] || palettes.default;
                         shader.uniforms.paletteMix.value = 0;

                         if (tweenRef.current) tweenRef.current.stop();

                         tweenRef.current = new TWEEN.Tween({ m: 0 })
                            .to({ m: 1 }, 1000)
                            .easing(TWEEN.Easing.Quadratic.Out)
                            .onUpdate((obj) => {
                                s.mix = obj.m;
                                shader.uniforms.paletteMix.value = obj.m;
                                needsRerender.current = 1;
                            })
                            .onComplete(() => {
                                // Optimization: Lock to final
                                // s.fromPalette could become target, mix=0? 
                                // Or just leave at 1.
                            })
                            .start();
                    }
                }
            }

            needsRerender.current = 1;
        }
    }, [currentYear, storylineIndex, storylineMode, palettes, needsRerender]);

    return coloredMaterialRef;
};
