import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { useLocation } from 'react-router-dom';

import { useThreeScene } from '../hooks/useThreeScene';
import { useTilesLoader } from '../hooks/useTilesLoader';
import { useBasemap } from '../hooks/useBasemap';
import { useTileShaders } from '../hooks/useTileShaders';
import { useMarkers } from '../hooks/useMarkers';
import { useStorylineLogic } from '../hooks/useStorylineLogic';
import * as CameraAnims from '../utils/cameraAnimations';

import { IntroOverlay } from './overlays/IntroOverlay';
import { LoadingOverlay } from './overlays/LoadingOverlay';
import { TimelineOverlay } from './overlays/TimelineOverlay';
import { StorylineOverlay } from './overlays/StorylineOverlay';
// import { ChapterNavigation } from './overlays/ChapterNavigation';
import { StorylineProgress } from './overlays/StorylineProgress';
import { InnovationList } from './overlays/InnovationList';
import { MapControlsGuide } from './overlays/MapControlsGuide';
import { AboutMap } from './overlays/AboutMap';
import { MapControls } from './overlays/MapControls';

import { processTileColors } from '../utils/tiles';
import { wgs84ToRd } from '../utils/coords';
// import { createPaletteTexture } from '../utils/colors'; // Now in useTileShaders
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
    onShowLocationBox,
    // onHideLocationBox,
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


    const location = useLocation();

    // Materials
    const materialRef = useRef<THREE.Material>(new THREE.MeshLambertMaterial({ color: 0xff4444, flatShading: true }));
    const coloredMaterialRef = useTileShaders(currentYear, storylineIndex, storylineMode, needsRerender);





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



    const animateCameraToStoryline = useCallback((targetRD: { x: number, y: number }, onComplete?: () => void) => {
        if (!tilesRef.current || !controlsRef.current || !cameraRef.current) return;
        
        CameraAnims.animateCameraToLocation(
            cameraRef.current,
            controlsRef.current,
            targetRD,
            tilesRef.current.group.position,
            () => { needsRerender.current = 1; },
            onComplete
        );
    }, [cameraRef, controlsRef, tilesRef, needsRerender]);

    const animateCameraToOverview = useCallback(() => {
        if (!controlsRef.current || !cameraRef.current || !initialCameraStateRef.current) return;

        CameraAnims.animateCameraToOverview(
            cameraRef.current,
            controlsRef.current,
            initialCameraStateRef.current,
            () => { needsRerender.current = 1; }
        );
    }, [cameraRef, controlsRef, initialCameraStateRef, needsRerender]);

    const zoomOutToMax = useCallback(() => {
        if (!controlsRef.current || !cameraRef.current || !initialCameraStateRef.current) return;
        
        CameraAnims.animateZoomOut(
            cameraRef.current,
            controlsRef.current,
            initialCameraStateRef.current,
            () => { needsRerender.current = 1; }
        );
    }, [cameraRef, controlsRef, initialCameraStateRef, needsRerender]);

    const { 
        handleNextStoryline, 
        hasZoomedOutRef, 
        // isRewindingRef, 
        isOrbitingRef 
    } = useStorylineLogic({
        isPlaying,
        storylineIndex,
        skipStoryline,
        isStorylineComplete,
        currentYear,
        setCurrentYear,
        setIsPlaying,
        setStorylineMode,
        setStorylineIndex,
        setIsStorylineComplete,
        animateCameraToStoryline,
        zoomOutToMax
    });

    const onUserInteraction = useCallback(() => {
        if (isOrbitingRef.current) {
            isOrbitingRef.current = false;
        }
    }, [isOrbitingRef]);

    const handlePlayPause = useCallback((shouldPlay: boolean) => {
        if (!shouldPlay) {
            setIsPlaying(false);
            return;
        }

        setIsPlaying(false);
        // Reset zoom out flag so it triggers again at 1850
        hasZoomedOutRef.current = false;

        // 1. Rewind/Zoom Animation
        if (cameraRef.current && controlsRef.current && initialCameraStateRef.current) {
             CameraAnims.animateResetToStart(
                cameraRef.current,
                controlsRef.current,
                initialCameraStateRef.current,
                () => { needsRerender.current = 1; }
            );
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
    }, [cameraRef, controlsRef, initialCameraStateRef, currentYear, minYear, setIsPlaying, hasZoomedOutRef, needsRerender]);


    const { placeMarkerOnPoint } = useMarkers(sceneRef, needsRerender, userHasPanned, userHasRotated);

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
        // Blur any focused element (like play button/timeline inputs) when clicking the map
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
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
                controlsRef.current.autoRotateSpeed = -1.5;
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

            {/* Color Filter Overlay */}
            <div 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: storylineMode === 'focus' && storylinesData[storylineIndex] && (storylinesData[storylineIndex] as any).colorFilter 
                        ? (storylinesData[storylineIndex] as any).colorFilter 
                        : 'transparent',
                    pointerEvents: 'none',
                    zIndex: 1,
                    transition: 'background-color 1.5s ease-in-out',
                    mixBlendMode: 'multiply'
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
                        // Find current index
                        const idx = innovationProjects.findIndex(p => p.name === innovationEvent.name);
                        const nextIdx = (idx + 1) % innovationProjects.length;
                        const nextProject = innovationProjects[nextIdx];
                        
                        setInnovationEvent({
                            ...nextProject,
                             year: nextProject.year,
                             description: `# ${nextProject.name}\n\n${nextProject.description}`,
                             coordinate: nextProject.coordinate,
                             image: '/amsterdam-2026.webp'
                        });
                        animateCameraToStoryline(nextProject.coordinate);
                    }}
                    onSkip={() => {
                        setInnovationEvent(null);
                        animateCameraToOverview();
                    }}
                    variant="innovation"
                    // Pass next project name for button text
                    currentIndex={innovationProjects.findIndex(p => p.name === innovationEvent.name)}
                    totalEvents={innovationProjects.length}
                    // Hack to pass next name
                    allEvents={innovationProjects.map(p => ({...p, image: ''})) as any}
                />
            )}

            {/* Persistent Progress Pill in Both Modes (shows different content) */}
            {!isLoading && !showIntro && !innovationEvent && (
                <StorylineProgress
                    chapters={storylinesData}
                    activeIndex={storylineIndex}
                    onJump={(index) => {
                        setIsPlaying(false); // Pause on manual jump

                        const event = storylinesData[index];
                        const yearObj = { year: currentYear };
                        new TWEEN.Tween(yearObj)
                            .to({ year: event.year }, 1500)
                            .easing(TWEEN.Easing.Cubic.Out)
                            .onUpdate(() => {
                                setCurrentYear(Math.round(yearObj.year));
                            })
                            .start();

                        setStorylineIndex(index);
                        setStorylineMode('focus');
                        animateCameraToStoryline(event.coordinate, () => {
                             if (controlsRef.current) {
                                     isOrbitingRef.current = true;
                                     controlsRef.current.autoRotate = true;
                                     controlsRef.current.autoRotateSpeed = -1.5;
                             }
                        });
                        if (!controlsGuideDismissed) setControlsGuideDismissed(true);
                    }}
                    onSkipToFuture={async () => {
                        isOrbitingRef.current = false;
                        setStorylineMode('overview'); 
                        setIsPlaying(false);
                        setIsStorylineComplete(true);
                        
                        // Go to first innovation project
                        if (innovationProjects.length > 0) {
                             const firstProj = innovationProjects[0];
                             setInnovationEvent({
                                ...firstProj,
                                 year: firstProj.year,
                                 description: `# ${firstProj.name}\n\n${firstProj.description}`,
                                 coordinate: firstProj.coordinate,
                                 image: '/amsterdam-2026.webp'
                             });
                             
                             // Smoothly animate year to project year
                             const yearObj = { year: currentYear };
                             new TWEEN.Tween(yearObj)
                                .to({ year: firstProj.year }, 2000)
                                .easing(TWEEN.Easing.Quadratic.InOut)
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .start();

                             animateCameraToStoryline(firstProj.coordinate);
                        } else {
                            // Fallback if no projects
                            animateCameraToOverview(); 
                        }
                    }}
                    onStartStoryline={() => {
                        // Immediately snap to start context
                        const startEvent = storylinesData[0];
                        setStorylineMode('focus');
                        setStorylineIndex(0); // Ensure index is 0
                        setCurrentYear(startEvent.year); // Force year to match chapter 1
                        
                        // Animate camera and start playing
                        animateCameraToStoryline(startEvent.coordinate);
                        
                        // Force active index update in progress component by ensuring state is consistent across render cycle
                        // The component uses 'activeIndex' prop passed from 'storylinesData[storylineIndex]' equivalent logic?
                        // No, StorylineProgress uses activeIndex prop.
                        // We are passing: activeIndex={storylineMode === 'focus' ? storylineIndex : -1} below.
                        
                        setIsPlaying(true);
                        if (!controlsGuideDismissed) setControlsGuideDismissed(true);
                    }}
                    mode={storylineMode}
                    currentYear={currentYear}
                />
            )}
            
            {/* REMOVED OLD CHAPTER NAV */}
            
            {storylineMode === 'focus' && !innovationEvent && storylinesData[storylineIndex] && (
                <StorylineOverlay 
                    event={storylinesData[storylineIndex]} 
                    isStorylineComplete={isStorylineComplete}
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
                             setIsPlaying(false);
                             setStorylineIndex(index);
                             const event = storylinesData[index];
                             setCurrentYear(event.year);
                             setStorylineMode('focus');
                             animateCameraToStoryline(event.coordinate, () => {
                                 // Enable rotation after arriving
                                 if (controlsRef.current) {
                                     isOrbitingRef.current = true;
                                     controlsRef.current.autoRotate = true;
                                     controlsRef.current.autoRotateSpeed = -1.5;
                                 }
                             });
                        }
                    }}
                    nextProjectName={innovationProjects[0]?.name}
                    currentIndex={storylineIndex}
                    totalEvents={storylinesData.length}
                    allEvents={storylinesData}
                />
            )}
            {!showIntro && !isLoading && (
                <>
                    {storylineMode !== 'focus' &&  (
                        <>
                            {storylineMode === 'overview' && !innovationEvent && (
                                <InnovationList
                                    projects={innovationProjects}
                                    onSelectProject={(project) => {
                                        setStorylineMode('overview'); // Exit story mode
                                        setInnovationEvent({
                                            ...project, // Keep all props including name
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
                        onYearChange={(targetYear) => {
                             // Smooth scroll year if timeline clicked
                             // setCurrentYear(year); 

                             // Cancel explicit playing if manually scrubbing
                             if (isPlaying) setIsPlaying(false);

                             const yearObj = { year: currentYear };
                             // Use faster tween for scrub feeling
                             new TWEEN.Tween(yearObj)
                                .to({ year: targetYear }, 500)
                                .easing(TWEEN.Easing.Cubic.Out)
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .start();

                             if (storylineMode !== 'focus') {
                                setStorylineMode('focus');
                                // Find closest chapter
                                // let closestIndex = 0;
                                let minDiff = Infinity;
                                storylinesData.forEach((ch) => {
                                    // @ts-ignore
                                    const diff = Math.abs(ch.year - targetYear);
                                    if (diff < minDiff) {
                                        minDiff = diff;
                                        // closestIndex = idx;
                                    }
                                });
                                // Don't snap logic index yet, just let user explore
                                // setStorylineIndex(closestIndex);
                                // animateCameraToStoryline(storylinesData[closestIndex].coordinate);
                             }
                        }}
                        isPlaying={isPlaying}
                        onPlayPause={(playing) => {
                             if (storylineMode === 'focus') return; // Disable play in focus mode
                             handlePlayPause(playing);
                        }}
                        isStorylineActive={storylineMode === 'focus' || !!innovationEvent}
                        isStorylineComplete={isStorylineComplete}
                    />
                    <MapControlsGuide 
                        visible={isStorylineComplete && !controlsGuideDismissed} 
                        hasPanned={userHasPanned}
                        hasRotated={userHasRotated}
                    />
                    <MapControls 
                        visible={!isLoading && !showIntro && !innovationEvent && storylineMode === 'overview' && storylineIndex < storylinesData.length}
                        onResetNorth={() => {
                            // Stop auto-rotation
                            isOrbitingRef.current = false;
                            
                            if (controlsRef.current && cameraRef.current) {
                                // Reset to North (0 rotation) and 60 degree angle
                                const currentPos = cameraRef.current.position.clone();
                                const target = controlsRef.current.target.clone();
                                const dist = currentPos.distanceTo(target);
                                
                                // Standard view angle ~60 deg
                                // const angle = 60 * (Math.PI / 180);
                                // const newY = Math.sin(angle) * dist;
                                // const newZ = groundDist; 
                                
                                const endPos = target.clone().add(new THREE.Vector3(0, dist * 0.7, dist * 0.7)); // Approx 45-50 deg

                                new TWEEN.Tween(cameraRef.current.position)
                                    .to({ x: endPos.x, y: endPos.y, z: endPos.z }, 1500)
                                    .easing(TWEEN.Easing.Cubic.Out)
                                    .onUpdate(() => {
                                        if (controlsRef.current) controlsRef.current.update();
                                        needsRerender.current = 1;
                                    })
                                    .start();
                            }
                        }}
                        onLocateMe={() => {
                            if (navigator.geolocation && tilesRef.current) {
                                navigator.geolocation.getCurrentPosition((pos) => {
                                    const { latitude, longitude } = pos.coords;
                                    
                                    // Convert WGS84 to RD
                                    const { x: rdX, y: rdY } = wgs84ToRd(latitude, longitude);

                                    // Check if within bounds (Amsterdam approx)
                                    // X: 110000 - 135000, Y: 475000 - 500000 (roughly)
                                    if (rdX < 100000 || rdX > 140000 || rdY < 460000 || rdY > 510000) {
                                        if (onShowLocationBox) onShowLocationBox("Je bent buiten Amsterdam.");
                                        return;
                                    }

                                    animateCameraToStoryline({ x: rdX, y: rdY }, () => {
                                        placeMarkerOnPoint(new THREE.Vector3(
                                            controlsRef.current?.target.x || 0,
                                            controlsRef.current?.target.y || 0,
                                            controlsRef.current?.target.z || 0
                                        ));
                                        // Location found msg removed
                                    });

                                }, (err) => {
                                    console.error("Geolocation error:", err);
                                    if (onShowLocationBox) onShowLocationBox("Locatie onbepaalbaar.");
                                });
                            } else {
                                if (onShowLocationBox) onShowLocationBox("Locatie niet ondersteund.");
                            }
                        }}
                    />
                    <AboutMap />

                </>
            )}
        </>
    );
};
