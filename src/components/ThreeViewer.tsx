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
import { processTileColors } from '../utils/tiles';
import storylinesData from '../assets/storylines.json';

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
    const [skipStoryline, setSkipStoryline] = useState(false);
    const [isStorylineComplete, setIsStorylineComplete] = useState(false);
    
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
                varying float vConstructionYear;
                ${shader.fragmentShader}
            `.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                if (vConstructionYear > currentYear && vConstructionYear > 0.0) discard;
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
            needsRerender.current = 1;
        }
    }, [currentYear]);

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
        
        // Zoom in position
        const dist = 600; 
        const camPos = target.clone().add(new THREE.Vector3(dist, dist, dist));

        new TWEEN.Tween(cameraRef.current.position)
            .to({ x: camPos.x, y: camPos.y, z: camPos.z }, 4000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(controlsRef.current.target)
            .to({ x: target.x, y: target.y, z: target.z }, 4000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                controlsRef.current?.update();
                needsRerender.current = 1;
            })
            .onComplete(() => {
                if (onComplete) onComplete();
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
            .to({ x: endPos.x, y: endPos.y, z: endPos.z }, 10000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                 controlsRef.current?.update();
                 needsRerender.current = 1;
            })
            .start();
            
        new TWEEN.Tween(controlsRef.current.target)
            .to({ x: target.x, y: target.y, z: target.z }, 10000)
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

    // Playback Loop
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying) {
            interval = setInterval(() => {
                if (isRewindingRef.current) return;

                setCurrentYear(prev => {
                    const next = prev + 1; 
                    
                    // Check for storyline events if not skipped
                    if (!skipStoryline) {
                        const nextEvent = storylinesData[storylineIndex];
                        if (nextEvent && next >= nextEvent.year) {
                            setIsPlaying(false);
                            animateCameraToStoryline(nextEvent.coordinate, () => {
                                setStorylineMode('focus');
                            });
                            isOrbitingRef.current = true;
                            return nextEvent.year;
                        }
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
                }
            } else {
                stableFramesRef.current = 0;
                if (!isFinishingLoadRef.current) {
                    setLoadingProgress((prev: number) => {
                        const target = 90;
                        const next = prev + (target - prev) * 0.01;
                        if (next - prev < 0.1) return prev;
                        return next;
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
        const overviewDist = 15000;
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
                onStart={(skip) => {
                    setShowIntro(false);
                    setSkipStoryline(skip);
                    if (skip) {
                        setCurrentYear(2026);
                        setIsPlaying(false);
                        setIsStorylineComplete(true);
                    } else {
                        // Wait for fade out
                        setTimeout(() => {
                            // Reset zoom out flag
                            hasZoomedOutRef.current = false;
                            
                            // Rewind animation
                            const yearObj = { year: 2026 };
                            new TWEEN.Tween(yearObj)
                                .to({ year: 1400 }, 1500)
                                .easing(TWEEN.Easing.Quadratic.InOut)
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .onComplete(() => {
                                    setIsPlaying(true);
                                })
                                .start();
                        }, 1500);
                    }
                }} 
                isLoading={isLoading}
                progress={loadingProgress}
            />
            <LoadingOverlay isLoading={isLoading} showIntro={showIntro} progress={loadingProgress} />
            {storylineMode === 'focus' && storylinesData[storylineIndex] && (
                <StorylineOverlay 
                    event={storylinesData[storylineIndex]} 
                    onNext={handleNextStoryline} 
                />
            )}
            {!showIntro && !isLoading && (
                <TimelineOverlay
                    minYear={1400}
                    maxYear={2026}
                    currentYear={currentYear}
                    onYearChange={setCurrentYear}
                    isPlaying={isPlaying}
                    onPlayPause={setIsPlaying}
                    isStorylineActive={storylineMode === 'focus'}
                    isStorylineComplete={isStorylineComplete}
                />
            )}
        </>
    );
};
