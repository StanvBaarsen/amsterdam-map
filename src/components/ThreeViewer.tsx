import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { useLocation } from 'react-router-dom';

import { useThreeScene } from '../hooks/useThreeScene';
import { useTilesLoader } from '../hooks/useTilesLoader';
import { useBasemap } from '../hooks/useBasemap';
import { IntroOverlay } from './overlays/IntroOverlay';
import { LoadingOverlay } from './overlays/LoadingOverlay';
import { TimelineOverlay } from './overlays/TimelineOverlay';
import { StorylineOverlay } from './overlays/StorylineOverlay';
import { ChapterNavigation } from './overlays/ChapterNavigation';
import { InnovationList } from './overlays/InnovationList';
import { MapControlsGuide } from './overlays/MapControlsGuide';
import { AboutMap } from './overlays/AboutMap';

import { processTileColors } from '../utils/tiles';
import storylinesData from '../assets/storylines.json';
import innovationProjects from '../assets/innovation_projects.json';

interface ThreeViewerProps {
    tilesUrl?: string;
    basemapOptions?: any;
    onObjectPicked?: (obj: any) => void;
    onCamOffset?: (offset: any) => void;
    onCamRotationZ?: (rot: number) => void;
    onShowLocationBox?: (text: string) => void;
    onHideLocationBox?: () => void;
    onStorylineToggle?: (active: boolean) => void;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({
    tilesUrl = '/amsterdam_3dtiles_lod12/tileset.json',
    basemapOptions = {
        type: "wmts",
        options: {
            url: '/basemap/capabilities.xml',
            template: '/basemap/tiles/grijs/{TileMatrix}/{TileCol}/{TileRow}.png',
            layer: 'pastel',
            style: 'default',
            tileMatrixSet: "EPSG:28992",
            service: "WMTS",
            request: "GetTile",
            version: "1.0.0",
            format: "image/png"
        }
    },
    onObjectPicked,
    onCamRotationZ,
    onStorylineToggle
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [showIntro, setShowIntro] = useState(true);
    const [currentYear, setCurrentYear] = useState(2026);
    const [isPlaying, setIsPlaying] = useState(false);
    const [storylineIndex, setStorylineIndex] = useState(0);
    const [storylineMode, setStorylineMode] = useState<'overview' | 'focus'>('overview');
    const [innovationEvent, setInnovationEvent] = useState<any>(null);
    const [chapterNavOpen, setChapterNavOpen] = useState(false);
    const [controlsGuideDismissed, setControlsGuideDismissed] = useState(false);

    // Load saved progress on mount
    useEffect(() => {
        const savedIndex = localStorage.getItem('amsterdam_map_storyline_index');
        if (savedIndex) {
            const index = parseInt(savedIndex, 10);
            if (index > 0 && index < storylinesData.length) {
                setStorylineIndex(index);
            }
        }
    }, []);

    // Save progress when index changes
    useEffect(() => {
         localStorage.setItem('amsterdam_map_storyline_index', storylineIndex.toString());
    }, [storylineIndex]);
    
    // NEW STATE: Track user interaction for persistence
    const [userHasPanned, setUserHasPanned] = useState(false);
    const [userHasRotated, setUserHasRotated] = useState(false);
    const controlsLearnedRef = useRef(false);

    useEffect(() => {
        const learnedDate = localStorage.getItem('amsterdam_map_controls_learned');
        if (learnedDate) {
            const timestamp = parseInt(learnedDate, 10);
            const daysSince = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
            if (daysSince < 60) {
                setControlsGuideDismissed(true);
                controlsLearnedRef.current = true;
            }
        }
    }, []);

    useEffect(() => {
        if (!controlsLearnedRef.current && userHasPanned && userHasRotated) {
             localStorage.setItem('amsterdam_map_controls_learned', Date.now().toString());
             controlsLearnedRef.current = true;
        }
    }, [userHasPanned, userHasRotated]);

    const [skipStoryline, setSkipStoryline] = useState(false);
    const [isStorylineComplete, setIsStorylineComplete] = useState(false);
    const [minYear, ] = useState(1275);
    
    useEffect(() => {
        if (onStorylineToggle) {
            onStorylineToggle(storylineMode === 'focus');
        }
    }, [storylineMode, onStorylineToggle]);

    const containerRef = useRef<HTMLDivElement>(null);
    const { rendererRef, sceneRef, cameraRef, dummyCameraRef, controlsRef, offsetParentRef, isReady } = useThreeScene(containerRef);
    
    const needsRerender = useRef(0);
    const tilesCentered = useRef(false);
    const cameraPositionedRef = useRef(false);
    const initialCameraStateRef = useRef<{ position: THREE.Vector3, target: THREE.Vector3 } | null>(null);
    const sceneTransformRef = useRef<THREE.Vector3 | null>(null);
    const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
    const pointerCasterRef = useRef({ startClientX: 0, startClientY: 0 });
    const requestRef = useRef<number>(0);
    const streetLevelCameraPositionRef = useRef<{ position: THREE.Vector3, target: THREE.Vector3 } | null>(null);
    const hasZoomedOutRef = useRef(false);

    const location = useLocation();

    // Materials
    const materialRef = useRef<THREE.Material>(new THREE.MeshLambertMaterial({ color: 0xff4444, flatShading: true }));
    const coloredMaterialRef = useRef<THREE.Material>(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));

    useEffect(() => {
        coloredMaterialRef.current.onBeforeCompile = (shader) => {
            shader.uniforms.currentYear = { value: 2026 };
            shader.uniforms.saturation = { value: 1.0 };
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
                varying float vConstructionYear;
                ${shader.fragmentShader}
            `.replace(
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
    }, []);

    useEffect(() => {
        // @ts-ignore
        if (coloredMaterialRef.current && coloredMaterialRef.current.userData.shader) {
            // @ts-ignore
            coloredMaterialRef.current.userData.shader.uniforms.currentYear.value = currentYear;
            
            let sat = 1.0;
            if (storylineMode === 'focus' && storylineIndex === 2) {
                sat = 0.0; // Grayscale for Chapter 3
            } else if (storylineMode === 'focus' && storylineIndex === 3) {
                 // Ensure last chapter is full color
                 sat = 1.0;
            }

            // @ts-ignore
            if (coloredMaterialRef.current.userData.shader.uniforms.saturation) {
                // @ts-ignore
                coloredMaterialRef.current.userData.shader.uniforms.saturation.value = sat;
            }

            needsRerender.current = 1;
        }
    }, [currentYear, storylineIndex, storylineMode]);

    const reinitBasemapRef = useRef<() => void>(() => {});

    const { tilesRef, isLoadingRef, stableFramesRef, isFinishingLoadRef, keepAliveFrames } = useTilesLoader({
        tilesUrl,
        cameraRef,
        rendererRef,
        offsetParentRef,
        coloredMaterialRef,
        materialRef,
        setLoadingProgress,
        setIsLoading,
        needsRerender,
        tilesCentered,
        onLoadCallback: () => reinitBasemapRef.current(),
        isReady
    });

    const { terrainTilesRef, reinitBasemap } = useBasemap({
        basemapOptions,
        offsetParentRef,
        tilesRef,
        tilesCentered,
        sceneTransformRef,
        needsRerender
    });

    // Double click to zoom
    useEffect(() => {
        if (!isReady || !rendererRef.current) return;

        const onDoubleClick = (event: MouseEvent) => {
            if (!cameraRef.current || !sceneRef.current || !tilesRef.current) return;

            const rect = rendererRef.current!.domElement.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

            const objects: THREE.Object3D[] = [];
            if (tilesRef.current.group) objects.push(tilesRef.current.group);
            if (terrainTilesRef.current) objects.push(terrainTilesRef.current);

            const intersects = raycaster.intersectObjects(objects, true);

            if (intersects.length > 0) {
                const point = intersects[0].point;
                const controls = controlsRef.current!;

                const startTarget = controls.target.clone();
                const startPos = cameraRef.current.position.clone();

                const direction = startPos.clone().sub(point).normalize();
                const dist = startPos.distanceTo(point);
                const newDist = Math.max(dist * 0.5, 50); // Zoom in by 50%, min 50m
                
                const endPos = point.clone().add(direction.multiplyScalar(newDist));
                const endTarget = point;

                new TWEEN.Tween({ t: 0 })
                    .to({ t: 1 }, 1000)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onUpdate(({ t }) => {
                        controls.target.lerpVectors(startTarget, endTarget, t);
                        cameraRef.current!.position.lerpVectors(startPos, endPos, t);
                        needsRerender.current = 1;
                    })
                    .start();
            }
        };

        const canvas = rendererRef.current.domElement;
        canvas.addEventListener('dblclick', onDoubleClick);
        return () => canvas.removeEventListener('dblclick', onDoubleClick);
    }, [isReady, rendererRef, cameraRef, tilesRef, terrainTilesRef]);

    useEffect(() => {
        reinitBasemapRef.current = reinitBasemap;
    }, [reinitBasemap]);

    const isRewindingRef = useRef(false);
    const isOrbitingRef = useRef(false);

    const animateCameraToStoryline = (targetRD: { x: number, y: number }, onComplete?: () => void) => {
        if (!tilesRef.current || !controlsRef.current || !cameraRef.current) return;

        const groupPos = tilesRef.current.group.position;
        const local_x = targetRD.x + groupPos.x;
        const local_y = targetRD.y + groupPos.y;
        
        // Convert to World Space (Y-up, rotated parent)
        const world_x = local_x;
        const world_y = 0 + groupPos.z; 
        const world_z = -local_y;

        const target = new THREE.Vector3(world_x, world_y, world_z);
        
        // Final Zoom in position
        const dist = 600; 
        const finalCamPos = target.clone().add(new THREE.Vector3(dist, dist, dist));

        // Let's use a single duration for the combined movement to keep it snappy but smooth
        const duration = 2500; 

        // Animate X and Z (Pan/Rotate)
        new TWEEN.Tween(cameraRef.current.position)
            .to({ x: finalCamPos.x, z: finalCamPos.z }, duration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();

        // Animate Y (Zoom) with delay
        new TWEEN.Tween(cameraRef.current.position)
            .to({ y: finalCamPos.y }, duration)
            .delay(200) // Delay zoom slightly
            .easing(TWEEN.Easing.Quadratic.InOut)
             .onUpdate(() => {
                controlsRef.current?.update();
                needsRerender.current = 1;
            })
            .onComplete(() => {
                if (onComplete) onComplete();
            })
            .start();

        // Animate Target (LookAt)
        new TWEEN.Tween(controlsRef.current.target)
            .to({ x: target.x, y: target.y, z: target.z }, duration)
            .easing(TWEEN.Easing.Quadratic.InOut) 
            .onUpdate(() => {
                controlsRef.current?.update();
                needsRerender.current = 1;
            })
            .start();
    };

    const animateCameraToOverview = () => {
        if (!controlsRef.current || !cameraRef.current || !initialCameraStateRef.current) return;

        const { position, target } = initialCameraStateRef.current;

        new TWEEN.Tween(cameraRef.current.position)
            .to({ x: position.x, y: position.y, z: position.z }, 2000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(controlsRef.current.target)
            .to({ x: target.x, y: target.y, z: target.z }, 2000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                controlsRef.current?.update();
                needsRerender.current = 1;
            })
            .start();
    };

    const zoomOutToMax = () => {
        if (!controlsRef.current || !cameraRef.current || !initialCameraStateRef.current) return;

        const { target } = initialCameraStateRef.current;
        const initialPos = initialCameraStateRef.current.position;
        const direction = new THREE.Vector3().subVectors(initialPos, target).normalize();
        
        const dist = 6000;
        const endPos = target.clone().add(direction.multiplyScalar(dist));

        new TWEEN.Tween(cameraRef.current.position)
            .to({ x: endPos.x, y: endPos.y, z: endPos.z }, 4000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                 controlsRef.current?.update();
                 needsRerender.current = 1;
            })
            .start();
            
        new TWEEN.Tween(controlsRef.current.target)
            .to({ x: target.x, y: target.y, z: target.z }, 4000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
    };

    const handleNextStoryline = () => {
        isOrbitingRef.current = false;
        setStorylineMode('overview');
        
        // Wait for timeline to slide up (approx 1s)
        setTimeout(() => {
            animateCameraToOverview();
            
            // Wait for camera to move a bit before playing
            setTimeout(() => {
                setStorylineIndex(prev => prev + 1);
                setIsPlaying(true);
            }, 2000);
        }, 1000);
    };

    const onUserInteraction = () => {
        if (isOrbitingRef.current) {
            isOrbitingRef.current = false;
        }
    };

    const handlePlayPause = (shouldPlay: boolean) => {
        if (!shouldPlay) {
            setIsPlaying(false);
            return;
        }

        setIsPlaying(false);
        // Reset zoom out flag so it triggers again at 1850
        hasZoomedOutRef.current = false;

        // 1. Rewind/Zoom Animation
        if (cameraRef.current && controlsRef.current && initialCameraStateRef.current) {
            const { target } = initialCameraStateRef.current;
            // "Normal, mid-close height"
            const height = 2200;
            const offset = 2600;
            const startPos = target.clone().add(new THREE.Vector3(0, height, offset));
            
            // Animate Camera Position
            new TWEEN.Tween(cameraRef.current.position)
                .to({ x: startPos.x, y: startPos.y, z: startPos.z }, 1000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    controlsRef.current?.update();
                    needsRerender.current = 1;
                })
                .start();

            // Animate Controls Target (Reset to center)
            new TWEEN.Tween(controlsRef.current.target)
                .to({ x: target.x, y: target.y, z: target.z }, 1000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    controlsRef.current?.update();
                    needsRerender.current = 1;
                })
                .start();
        }

        const yearObj = { year: currentYear };
        new TWEEN.Tween(yearObj)
            .to({ year: minYear }, 1000)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                setCurrentYear(Math.round(yearObj.year));
            })
            .onComplete(() => {
                setIsPlaying(true);
            })
            .start();
    };

    // Playback Loop
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying) {
            interval = setInterval(() => {
                if (isRewindingRef.current) return;

                setCurrentYear(prev => {
                    let increment = 1;
                    
                    // Logic to speed up early years (before 1600)
                    if (prev < 1600) {
                        increment = 2.5; // Faster in early history
                    }

                    // Ease out speed near storyline events
                    let nextEvent = null;
                    if (!skipStoryline && !isStorylineComplete) {
                        nextEvent = storylinesData[storylineIndex];
                    }

                    const next = prev + increment;

                    if (nextEvent && next >= nextEvent.year) {
                        setIsPlaying(false);
                        animateCameraToStoryline(nextEvent.coordinate, () => {
                            setStorylineMode('focus');
                        });
                        isOrbitingRef.current = true;
                        return nextEvent.year;
                    }

                    if (next >= 1850 && !hasZoomedOutRef.current) {
                        hasZoomedOutRef.current = true;
                        zoomOutToMax();
                    }

                    if (next >= 2026) {
                        setIsPlaying(false);
                        setIsStorylineComplete(true);
                        return 2026;
                    }
                    return next;
                });
            }, 50);
        }
        return () => clearInterval(interval);
    }, [isPlaying, storylineIndex, skipStoryline]);


    const markerName = "LocationMarker";

    const placeMarkerOnPoint = (position: THREE.Vector3) => {
        if (!sceneRef.current) return;

        const existingMarker = sceneRef.current.getObjectByName(markerName);
        if (existingMarker) sceneRef.current.remove(existingMarker);

        // Placeholder for marker texture loading
        // const map = textureLoader.load('');
        const material = new THREE.SpriteMaterial({ color: 0xff0000 }); // Fallback color
        const sprite = new THREE.Sprite(material);

        material.depthWrite = false;
        material.depthTest = false;
        material.sizeAttenuation = false;

        sprite.position.set(position.x, position.y, position.z);
        sprite.scale.set(0.04, 0.10, 1);
        sprite.name = markerName;

        sceneRef.current.add(sprite);
        needsRerender.current = 1;
    };

    const setCameraPosFromRoute = (q: URLSearchParams) => {
        if (!tilesRef.current || !tilesRef.current.root || !controlsRef.current || !cameraRef.current) return;

        const rdx = parseFloat(q.get("rdx") || "0");
        const rdy = parseFloat(q.get("rdy") || "0");
        const ox = parseFloat(q.get("ox") || "400");
        const oy = parseFloat(q.get("oy") || "400");
        const oz = parseFloat(q.get("oz") || "400");

        if (isNaN(rdx)) return;

        const groupPos = tilesRef.current.group.position;
        const local_x = rdx + groupPos.x;
        const local_y = rdy + groupPos.y;
        const local_z = 0 + groupPos.z;

        // Convert to World Space (Y-up, rotated parent)
        const world_x = local_x;
        const world_y = local_z;
        const world_z = -local_y;

        controlsRef.current.target.x = world_x;
        controlsRef.current.target.y = world_y;
        controlsRef.current.target.z = world_z;

        cameraRef.current.position.x = world_x + ox;
        cameraRef.current.position.y = world_y + oy;
        cameraRef.current.position.z = world_z + oz;

        cameraRef.current.updateMatrixWorld();
        controlsRef.current.update();
        needsRerender.current = 1;

        if (q.get("placeMarker") === "true") {
            placeMarkerOnPoint(new THREE.Vector3(world_x, world_y, world_z));
        }
    };

    const onWindowResize = () => {
        if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
        cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);

        if (dummyCameraRef.current) {
            dummyCameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            dummyCameraRef.current.updateProjectionMatrix();
        }

        if (tilesRef.current) {
            tilesRef.current.setResolutionFromRenderer(cameraRef.current, rendererRef.current);
        }
        needsRerender.current = 1;
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!containerRef.current) return;
        const bounds = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((e.clientX - bounds.left) / containerRef.current.clientWidth) * 2 - 1;
        mouseRef.current.y = - ((e.clientY - bounds.top) / containerRef.current.clientHeight) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
        pointerCasterRef.current.startClientX = e.clientX;
        pointerCasterRef.current.startClientY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
        if (Math.abs(pointerCasterRef.current.startClientX - e.clientX) < 2 &&
            Math.abs(pointerCasterRef.current.startClientY - e.clientY) < 2) {
            if (onObjectPicked) {
                // Implement raycasting logic here
            }
        }
    };

    const updateLoadingState = () => {
        if (isLoadingRef.current && tilesRef.current) {
            const stats = tilesRef.current.stats;
            const isStable = stats.downloading === 0 && stats.parsing === 0;
            
            if (tilesRef.current.root && isStable) {
                stableFramesRef.current++;
                // Wait for 60 frames (approx 1 sec) of stability to ensure everything is truly loaded
                if (stableFramesRef.current > 60 && !isFinishingLoadRef.current) {
                    isFinishingLoadRef.current = true;
                    setLoadingProgress(100);
                    setTimeout(() => {
                        setIsLoading(false);
                        isLoadingRef.current = false;
                    }, 500);
                } else if (!isFinishingLoadRef.current) {
                   // Continue inching towards 100 while verifying stability
                   setLoadingProgress((prev: number) => {
                        const target = 99;
                        const step = (target - prev) * 0.1; // Faster approach
                        return prev + Math.max(0.1, step);
                   });
                }
            } else {
                stableFramesRef.current = 0;
                if (!isFinishingLoadRef.current) {
                    setLoadingProgress((prev: number) => {
                        // While downloading/parsing, move towards 80%
                        const target = 80;
                        const step = (target - prev) * 0.08; // Significantly faster than 0.01
                         // Ensure we always move at least a little bit if we are far from target
                        return prev + Math.max(0.2, step); 
                    });
                }
            }
        }
    };

    const updateTilesAndMaterials = () => {
        if (tilesRef.current) {
            // While loading, force high detail loading even if far away
            if (isLoadingRef.current) {
                tilesRef.current.errorTarget = 1;
            } else {
                tilesRef.current.errorTarget = 10;
            }

            if (tilesRef.current.update()) {
                needsRerender.current = Math.max(needsRerender.current, 1);
            }

            tilesRef.current.forEachLoadedModel((scene: THREE.Object3D, tile: any) => {
                if (coloredMaterialRef.current && materialRef.current) {
                    processTileColors(scene, tile, coloredMaterialRef.current, materialRef.current);
                }
            });
        }
    };

    const positionCameraDefault = (center: THREE.Vector3, _radius: number) => {
        const amsterdamRDX = 121500;
        const amsterdamRDY = 486500;
        const dX = amsterdamRDX - center.x;
        const dY = amsterdamRDY - center.y;
        const localTarget = new THREE.Vector3(dX, dY, 0);
        localTarget.applyEuler(new THREE.Euler(-Math.PI/2, 0, 0));
        
        const target = new THREE.Vector3();
        target.copy(localTarget);
        
        const dist = 2000;
        const streetPos = target.clone().add(new THREE.Vector3(0, dist * 1.0, dist * 0.8));
        
        // Calculate overview position (high up)
        // Use a large distance to see the whole city
        const overviewDist = 8000;
        const overviewPos = target.clone().add(new THREE.Vector3(0, overviewDist, 100)); // Almost top-down

        if (cameraRef.current && controlsRef.current && dummyCameraRef.current) {
            // Start at overview position
            cameraRef.current.position.copy(overviewPos);
            controlsRef.current.target.copy(target);
            controlsRef.current.update();
            
            dummyCameraRef.current.position.copy(overviewPos);
            dummyCameraRef.current.lookAt(target);
            dummyCameraRef.current.updateMatrixWorld();

            // Store street position for later animation
            streetLevelCameraPositionRef.current = {
                position: streetPos.clone(),
                target: target.clone()
            };

            initialCameraStateRef.current = {
                position: streetPos.clone(),
                target: target.clone()
            };
        }
        cameraPositionedRef.current = true;
    };

    // const handleStart = () => {
    //     setShowIntro(false);
        
    //     if (cameraRef.current && controlsRef.current && streetLevelCameraPositionRef.current) {
    //         const { position, target } = streetLevelCameraPositionRef.current;

    //         new TWEEN.Tween(cameraRef.current.position)
    //             .to({ x: position.x, y: position.y, z: position.z }, 3000)
    //             .easing(TWEEN.Easing.Quadratic.InOut)
    //             .start();

    //         new TWEEN.Tween(controlsRef.current.target)
    //             .to({ x: target.x, y: target.y, z: target.z }, 3000)
    //             .easing(TWEEN.Easing.Quadratic.InOut)
    //             .onUpdate(() => {
    //                 controlsRef.current?.update();
    //                 needsRerender.current = 1;
    //             })
    //             .start();
    //     }
    // };

    const checkCentering = () => {
        if (tilesRef.current && !tilesCentered.current && tilesRef.current.root) {
            const root = tilesRef.current.root;

            // Ensure cached sphere exists so renderer can work
            // @ts-ignore
            if (!root.cached.sphere && root.boundingVolume && root.boundingVolume.box) {
                const box = root.boundingVolume.box;
                const center = new THREE.Vector3(box[0], box[1], box[2]);
                const xVector = new THREE.Vector3(box[3], box[4], box[5]);
                const yVector = new THREE.Vector3(box[6], box[7], box[8]);
                const zVector = new THREE.Vector3(box[9], box[10], box[11]);
                const radius = Math.max(xVector.length(), yVector.length(), zVector.length());
                // @ts-ignore
                root.cached.sphere = new THREE.Sphere(center, radius);
            }

            // @ts-ignore
            if (root.cached && root.cached.sphere) {
                // @ts-ignore
                const sphere = root.cached.sphere;
                const center = sphere.center.clone();
                if (root.transform) {
                    const transform = new THREE.Matrix4().fromArray(root.transform);
                    center.applyMatrix4(transform);
                } else if (root.cached.transform) {
                    const t = root.cached.transform;
                    if (t.elements) {
                        center.applyMatrix4(t);
                    } else if (t.length === 16) {
                        const transform = new THREE.Matrix4().fromArray(t);
                        center.applyMatrix4(transform);
                    }
                }

                tilesRef.current.group.position.copy(center).multiplyScalar(-1);
                tilesRef.current.group.updateMatrixWorld(true);
                tilesCentered.current = true;
                needsRerender.current = 1;
                keepAliveFrames.current = 60;

                if (!cameraPositionedRef.current) {
                    const q = new URLSearchParams(location.search);
                    if (q.has("rdx") && q.has("rdy")) {
                        setCameraPosFromRoute(q);
                        cameraPositionedRef.current = true;
                    } else {
                        positionCameraDefault(center, sphere.radius);
                    }
                }
                reinitBasemap();
            }
        }
    };

    const animate = () => {
        requestRef.current = requestAnimationFrame(animate);

        if (offsetParentRef.current) {
            offsetParentRef.current.updateMatrixWorld(true);
        }

        if (controlsRef.current) {
            if (isOrbitingRef.current) {
                controlsRef.current.autoRotate = true;
                controlsRef.current.autoRotateSpeed = 1.5;
            } else {
                controlsRef.current.autoRotate = false;
            }
            controlsRef.current.update();
        }
        TWEEN.update();

        if (cameraRef.current && dummyCameraRef.current) {
            dummyCameraRef.current.matrixWorld.copy(cameraRef.current.matrixWorld);
            dummyCameraRef.current.position.copy(cameraRef.current.position);
            dummyCameraRef.current.quaternion.copy(cameraRef.current.quaternion);
            dummyCameraRef.current.scale.copy(cameraRef.current.scale);
            dummyCameraRef.current.updateMatrixWorld();
        }

        updateTilesAndMaterials();
        updateLoadingState();
        checkCentering();

        if (terrainTilesRef.current && sceneTransformRef.current && cameraRef.current) {
            terrainTilesRef.current.update(sceneTransformRef.current, cameraRef.current);
        }

        if (needsRerender.current > 0 || keepAliveFrames.current > 0) {
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
            if (needsRerender.current > 0) needsRerender.current--;
            if (keepAliveFrames.current > 0) keepAliveFrames.current--;
        }

        if (onCamRotationZ && cameraRef.current) {
            onCamRotationZ(cameraRef.current.rotation.z);
        }
    };

    useEffect(() => {
        window.addEventListener('resize', onWindowResize, false);
        if (rendererRef.current) {
            rendererRef.current.domElement.addEventListener('pointermove', onPointerMove, false);
            rendererRef.current.domElement.addEventListener('pointerdown', (e) => {
                onPointerDown(e);
                onUserInteraction();
            }, false);
            rendererRef.current.domElement.addEventListener('pointerup', onPointerUp, false);
            rendererRef.current.domElement.addEventListener('wheel', onUserInteraction, false);
            rendererRef.current.domElement.addEventListener('touchstart', onUserInteraction, false);
        }

        needsRerender.current = 1;
        animate();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            window.removeEventListener('resize', onWindowResize);
            if (rendererRef.current) {
                rendererRef.current.domElement.removeEventListener('pointermove', onPointerMove);
                rendererRef.current.domElement.removeEventListener('pointerdown', onPointerDown);
                rendererRef.current.domElement.removeEventListener('pointerup', onPointerUp);
                rendererRef.current.domElement.removeEventListener('wheel', onUserInteraction);
                rendererRef.current.domElement.removeEventListener('touchstart', onUserInteraction);
            }
        };
    }, [rendererRef.current]);

// removed this since we have a new state above
//    const [userHasPanned, setUserHasPanned] = useState(false);
//    const [userHasRotated, setUserHasRotated] = useState(false);

    useEffect(() => {
        if (!controlsRef.current) return;
        // @ts-ignore - access orbit controls
        const controls = controlsRef.current;
        
        const onStart = () => {
             // Access internal state to detect action
             // ROTATE = 0, PAN = 2 (standard OrbitControls)
             // @ts-ignore
             const state = controls.state;
             if (state === 0) { // Rotate
                setUserHasRotated(true);
             } else if (state === 2) { // Pan
                setUserHasPanned(true);
             }
        };

        controls.addEventListener('start', onStart);
        return () => {
            controls.removeEventListener('start', onStart);
        };
    }, [controlsRef.current]);

    useEffect(() => {
        if (!controlsRef.current) return;
        
        // Lock controls ONLY when automatically playing through the storyline
        // If paused, controls are free.
        const isAutoPlayingStoryline = isPlaying && !isStorylineComplete && !skipStoryline;

        controlsRef.current.enabled = !isAutoPlayingStoryline;

    }, [isPlaying, isStorylineComplete, skipStoryline, controlsRef]);

    useEffect(() => {
        if (!controlsRef.current) return;
        
        const onChange = () => {
            needsRerender.current = 1;
            if (tilesCentered.current && tilesRef.current) {
                const groupPos = tilesRef.current.group.position;
                const target = controlsRef.current!.target;

                const minRDX = 119000;
                const maxRDX = 124000;
                const minRDY = 484500;
                const maxRDY = 488000;

                const currentRDX = target.x - groupPos.x;
                const currentRDY = -target.z - groupPos.y;

                let clampedRDX = Math.max(minRDX, Math.min(maxRDX, currentRDX));
                let clampedRDY = Math.max(minRDY, Math.min(maxRDY, currentRDY));

                if (clampedRDX !== currentRDX || clampedRDY !== currentRDY) {
                    const diffRDX = clampedRDX - currentRDX;
                    const diffRDY = clampedRDY - currentRDY;

                    const diffWorldX = diffRDX;
                    const diffWorldZ = -diffRDY;

                    controlsRef.current!.target.x += diffWorldX;
                    controlsRef.current!.target.z += diffWorldZ;

                    cameraRef.current!.position.x += diffWorldX;
                    cameraRef.current!.position.z += diffWorldZ;
                }
            }
        };

        controlsRef.current.addEventListener('change', onChange);
        return () => {
            controlsRef.current?.removeEventListener('change', onChange);
        };
    }, [controlsRef.current]);

    return (
        <>
            <div 
                id="canvas" 
                ref={containerRef} 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    zIndex: 0,
                    opacity: isLoading ? 0 : 1,
                    filter: isLoading ? 'blur(10px)' : 'blur(0px)',
                    transition: 'opacity 1.5s ease-in-out, filter 1.5s ease-in-out'
                }} 
            />
            <IntroOverlay 
                show={showIntro} 
                onStart={(skip, resume) => {
                    setShowIntro(false);
                    setSkipStoryline(skip);
                    
                    if (skip) {
                        setCurrentYear(2026);
                        setIsPlaying(false);
                        setIsStorylineComplete(true);
                        animateCameraToOverview();
                    } else if (resume) { 
                        // Resume logic
                        const savedIndex = parseInt(localStorage.getItem('amsterdam_map_storyline_index') || '0', 10);
                        setStorylineIndex(savedIndex);
                        setStorylineMode('focus');
                        
                        // Set correct year instantly
                        const year = storylinesData[savedIndex].year;
                        setCurrentYear(year);

                        // Animate to position
                        const coord = storylinesData[savedIndex].coordinate;
                        // Convert RD to local if needed, but animateCameraToStoryline takes RD
                        animateCameraToStoryline(coord);
                        setIsPlaying(true);
                    } else {
                        // Start fresh logic (existing rewind logic)
                        setStorylineIndex(0); // Ensure start at 0
                        // Wait for fade out
                        setTimeout(() => {
                            // Reset zoom out flag
                            hasZoomedOutRef.current = false;
                            
                            // Mildly tilt the camera while rewinding
                            if (cameraRef.current && controlsRef.current && initialCameraStateRef.current) {
                                const { target } = initialCameraStateRef.current;
                                // Tilt camera: Lower height, move back in Z
                                // Must respect maxPolarAngle of 0.8 (approx 45 degrees)
                                // To avoid jitter, we ensure height >= offset roughly
                                const tiltHeight = 2800;
                                const tiltOffset = 2800;
                                
                                const endPos = target.clone().add(new THREE.Vector3(0, tiltHeight, tiltOffset));

                                new TWEEN.Tween(cameraRef.current.position)
                                    .to({ x: endPos.x, y: endPos.y, z: endPos.z }, 1600)
                                    .easing(TWEEN.Easing.Quadratic.InOut)
                                    .onUpdate(() => {
                                        if (controlsRef.current) controlsRef.current.update();
                                        needsRerender.current = 1;
                                    })
                                    .start();
                            }

                            // Rewind animation
                            const yearObj = { year: 2026 };
                            new TWEEN.Tween(yearObj)
                                .to({ year: minYear }, 4000)
                                .delay(1750)
                                .easing(TWEEN.Easing.Quadratic.In) // Start slow (at 2026), speed up towards 1275
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .onComplete(() => {
                                    setTimeout(() => {
                                        setIsPlaying(true);
                                    }, 500);
                                })
                                .start();
                        }, 1500);
                    }
                }} 
                isLoading={isLoading}
                progress={loadingProgress}
            />
            <LoadingOverlay isLoading={isLoading} showIntro={showIntro} progress={loadingProgress} />
            
            {innovationEvent && (
                <StorylineOverlay
                    event={innovationEvent}
                    onNext={() => {
                        setInnovationEvent(null);
                        animateCameraToOverview();
                    }}
                    onSkip={() => {
                        setInnovationEvent(null);
                        animateCameraToOverview();
                    }}
                    variant="innovation"
                />
            )}

            {storylineMode === 'focus' && !innovationEvent && storylinesData[storylineIndex] && (
                <StorylineOverlay 
                    event={storylinesData[storylineIndex]} 
                    onNext={handleNextStoryline} 
                    onPrev={() => {
                        const prev = storylineIndex - 1;
                        if (prev >= 0) {
                            setStorylineIndex(prev);
                            const prevEvent = storylinesData[prev];
                            setCurrentYear(prevEvent.year);
                            animateCameraToStoryline(prevEvent.coordinate);
                        }
                    }}
                    onSkip={() => {
                        isOrbitingRef.current = false;
                        setSkipStoryline(true);
                        setStorylineMode('overview');
                        setIsPlaying(false);
                        setIsStorylineComplete(true);
                        
                        // Smoothly animate year to 2026
                        const yearObj = { year: currentYear };
                        new TWEEN.Tween(yearObj)
                            .to({ year: 2026 }, 2500) // 2.5s duration for smoother transition
                            .easing(TWEEN.Easing.Quadratic.InOut)
                            .onUpdate(() => {
                                setCurrentYear(Math.round(yearObj.year));
                            })
                            .start();

                        animateCameraToOverview(); 
                    }}
                    onJump={(index) => {
                        if (index >= 0 && index < storylinesData.length) {
                             setStorylineIndex(index);
                             const event = storylinesData[index];
                             setCurrentYear(event.year);
                             setStorylineMode('focus');
                             animateCameraToStoryline(event.coordinate);
                        }
                    }}
                    currentIndex={storylineIndex}
                    totalEvents={storylinesData.length}
                    allEvents={storylinesData}
                />
            )}
            {!showIntro && !isLoading && (
                <>
                    {!isPlaying && storylineMode !== 'focus' &&  (
                        <>
                            <ChapterNavigation
                                chapters={storylinesData}
                                activeIndex={-1}
                                isOpen={chapterNavOpen}
                                onToggle={() => setChapterNavOpen(!chapterNavOpen)}
                                onSelectChapter={(index) => {
                                    setStorylineIndex(index);
                                    setStorylineMode('focus');
                                    setIsPlaying(false);
                                    setInnovationEvent(null);
                                    if (!controlsGuideDismissed) setControlsGuideDismissed(true);

                                    const targetYear = storylinesData[index].year;
                                    const diff = Math.abs(targetYear - currentYear);
                                    const duration = Math.max(200, diff * 2); // 2ms per year, min 200ms

                                    const yearObj = { year: currentYear };
                                    new TWEEN.Tween(yearObj)
                                        .to({ year: targetYear }, duration)
                                        .easing(TWEEN.Easing.Quadratic.Out)
                                        .onUpdate(() => {
                                            setCurrentYear(Math.round(yearObj.year));
                                        })
                                        .onComplete(() => {
                                            animateCameraToStoryline(storylinesData[index].coordinate);
                                        })
                                        .start();
                                }}
                            />
                            {storylineMode === 'overview' && !innovationEvent && (
                                <InnovationList
                                    projects={innovationProjects}
                                    onSelectProject={(project) => {
                                        setStorylineMode('overview'); // Exit story mode
                                        setInnovationEvent({
                                            year: project.year,
                                            description: `# ${project.name}\n\n${project.description}`,
                                            coordinate: project.coordinate,
                                            image: '/amsterdam-2026.webp'
                                        });
                                        setIsPlaying(false);
                                        setCurrentYear(project.year);
                                        animateCameraToStoryline(project.coordinate);
                                        if (!controlsGuideDismissed) setControlsGuideDismissed(true);
                                    }}
                                />
                            )}
                        </>
                    )}
                    <TimelineOverlay
                        minYear={minYear}
                        maxYear={2026}
                        currentYear={currentYear}
                        onYearChange={setCurrentYear}
                        isPlaying={isPlaying}
                        onPlayPause={handlePlayPause}
                        isStorylineActive={storylineMode === 'focus' || !!innovationEvent}
                        isStorylineComplete={isStorylineComplete}
                    />
                    <MapControlsGuide 
                        visible={isStorylineComplete && !controlsGuideDismissed} 
                        hasPanned={userHasPanned}
                        hasRotated={userHasRotated}
                    />
                    <AboutMap />

                </>
            )}
        </>
    );
};
