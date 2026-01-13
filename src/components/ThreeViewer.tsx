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
import { wgs84ToRd } from '../utils/coords';

import { IntroOverlay } from './overlays/IntroOverlay';
import { TimelineOverlay } from './overlays/TimelineOverlay';
import { StorylineOverlay } from './overlays/StorylineOverlay';
// import { ChapterNavigation } from './overlays/ChapterNavigation';
import { StorylineProgress } from './overlays/StorylineProgress';
import { InnovationList } from './overlays/InnovationList';
import { MapControlsGuide } from './overlays/MapControlsGuide';
import { AboutMap } from './overlays/AboutMap';
import { MapControls } from './overlays/MapControls';
import { PopulationChart } from './overlays/PopulationChart';

import { processTileColors } from '../utils/tiles';
// import { createPaletteTexture } from '../utils/colors'; // Now in useTileShaders
import storylinesDataRaw from '../assets/storylines.json';
import innovationProjects from '../assets/innovation_projects.json';

// Handle parsing of "current" year in storylines
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storylinesData = storylinesDataRaw.map((s: any) => ({
    ...s,
    year: (s.year === "current") ? new Date().getFullYear() : Number(s.year), // Force Number() here
    cameraAngle: s.cameraAngle, // Ensure this property is passed through if present
    cameraDistance: s.cameraDistance
}));

const parsedStorylinesData = storylinesData; 


interface ThreeViewerProps {
    tilesUrl?: string;
    basemapOptions?: any;
    onObjectPicked?: (obj: any) => void;
    onCamOffset?: (offset: any) => void;
    onCamRotationZ?: (rot: number) => void;
    onShowLocationBox?: (text: string) => void;
    onHideLocationBox?: () => void;
    onStorylineToggle?: (active: boolean) => void;
    onInnovationToggle?: (active: boolean) => void;
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
    onStorylineToggle,
    onInnovationToggle
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [, setAreImagesPreloaded] = useState(false);
    const areImagesPreloadedRef = useRef(false);
    const [showIntro, setShowIntro] = useState(true);
    const PRESENT_YEAR = new Date().getFullYear();
    const [currentYear, setCurrentYear] = useState(PRESENT_YEAR);
    const [isPlaying, setIsPlaying] = useState(false);
    const [storylineIndex, setStorylineIndex] = useState(0);
    const [storylineMode, setStorylineMode] = useState<'overview' | 'focus'>('overview');
    const [innovationEvent, setInnovationEvent] = useState<any>(null);
    const [controlsGuideDismissed, setControlsGuideDismissed] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [activeOverlay, setActiveOverlay] = useState<'chapter' | 'innovation' | 'about' | null>(null);

    // Load saved progress on mount
    useEffect(() => {
        const savedIndex = localStorage.getItem('amsterdam_map_storyline_index');
        if (savedIndex) {
            const index = parseInt(savedIndex, 10);
            if (index > 0 && index < parsedStorylinesData.length) {
                setStorylineIndex(index);
                // Ensure initial year is correct if resuming
                // setCurrentYear(parsedStorylinesData[index].year); // Optional: depends on desired startup behavior
            }
        }
    }, []);

    // Preload images
    useEffect(() => {
        const imageUrls = [
            ...parsedStorylinesData.map(s => s.image).filter(Boolean),
            ...innovationProjects.map(p => p.image).filter(Boolean)
        ];
        
        const uniqueUrls = [...new Set(imageUrls)];
        
        let loadedCount = 0;
        const total = uniqueUrls.length;
        
        if (total === 0) {
            setAreImagesPreloaded(true);
            areImagesPreloadedRef.current = true;
            return;
        }

        uniqueUrls.forEach(url => {
            const img = new Image();
            img.src = url;
            img.onload = () => {
                loadedCount++;
                if (loadedCount === total) {
                    setAreImagesPreloaded(true);
                    areImagesPreloadedRef.current = true;
                }
            };
            img.onerror = () => {
                console.warn(`Failed to preload image: ${url}`);
                loadedCount++;
                if (loadedCount === total) {
                    setAreImagesPreloaded(true);
                    areImagesPreloadedRef.current = true;
                }
            }
        });
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
        // Clear old storage if exists
        localStorage.removeItem('amsterdam_map_controls_learned');
    }, []);

    useEffect(() => {
        if (!controlsLearnedRef.current && userHasPanned && userHasRotated) {
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

    useEffect(() => {
        if (onInnovationToggle) {
            onInnovationToggle(!!innovationEvent);
        }
    }, [innovationEvent, onInnovationToggle]);

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

    // Adjust rotation speed on mobile during storyline mode
    useEffect(() => {
        if (controlsRef.current) {
            const isMobile = window.innerWidth < 768;
            if (isMobile && storylineMode === 'focus') {
                 controlsRef.current.rotateSpeed = 0.25; 
            } else {
                 controlsRef.current.rotateSpeed = isMobile ? 0.6 : 1.0; 
            }
        }
    }, [storylineMode]);

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

    // Loading Rotation
    useEffect(() => {
        if (isLoading && controlsRef.current && isReady) {
            const interval = setInterval(() => {
                if (controlsRef.current) {
                    controlsRef.current.autoRotate = true;
                    controlsRef.current.autoRotateSpeed = 2.0;
                    // Lower the angle to look more towards horizon (respecting the limit)
                    const currentPolar = controlsRef.current.getPolarAngle();
                    const targetPolar = controlsRef.current.maxPolarAngle; 
                    
                    if (currentPolar < targetPolar - 0.05 && cameraRef.current) {
                        // Drift phi towards target maxPolarAngle
                         const offset = new THREE.Vector3().subVectors(cameraRef.current.position, controlsRef.current.target);
                         const spherical = new THREE.Spherical().setFromVector3(offset);
                         
                         // Slowly increase phi (downwards)
                         spherical.phi = THREE.MathUtils.lerp(spherical.phi, targetPolar, 0.05);
                         spherical.makeSafe();
                         
                         offset.setFromSpherical(spherical);
                         cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                         cameraRef.current.lookAt(controlsRef.current.target);
                         controlsRef.current.update();
                         needsRerender.current = 1;
                    }
                }
            }, 50);
            return () => clearInterval(interval);
        } else if (!isLoading && controlsRef.current && !isOrbitingRef.current) {
             controlsRef.current.autoRotate = false;
        }
    }, [isLoading, isReady]);

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



    const animateCameraToStoryline = useCallback((targetIn: { x: number, y: number } | { lat: number, lng: number }, onComplete?: () => void, cameraAngle?: number, cameraDistance?: number) => {
        if (!tilesRef.current || !controlsRef.current || !cameraRef.current) return;
        
        // Reset interaction flags so markers/UI reset their "user interacted" state
        setUserHasPanned(false);
        setUserHasRotated(false);

        // Convert Lat/Long to RD
        let targetRD = { x: 0, y: 0 };
        
        if ('lat' in targetIn && 'lng' in targetIn) {
            targetRD = wgs84ToRd((targetIn as any).lat, (targetIn as any).lng);
        } else {
            targetRD = targetIn as { x: number, y: number };
            
            // Legacy rough check: RD coords are > 10000. WGS84 are < 180.
            // If someone passed lat/long as x/y
            if (Math.abs(targetRD.x) < 1000 && Math.abs(targetRD.y) < 1000) {
                 // Determine Lat vs Lon based on Netherlands context
                 // Lat ~ 50-53, Lon ~ 4-7
                 if (targetRD.x > 40 && targetRD.y < 20) {
                     targetRD = wgs84ToRd(targetRD.x, targetRD.y);
                 } else {
                     targetRD = wgs84ToRd(targetRD.y, targetRD.x);
                 }
            }
        }

        // Apply Responsive Offset logic
        const isMobile = window.innerWidth < 768; // Mobile
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1100; // Tablet/Narrow Desktop

        let offsetX = 0;
        let offsetY = 0;

        if (isMobile) {
            // Bottom 50% is UI. Target should be higher up (centered in top 50%).
            // Look South (lower Y) so map moves up.
            offsetY = -150; 
        } else if (isTablet) {
            // Side UI. Target should be East (centered in left/right available space).
            // Look East (higher X) so map moves Left.
            offsetX = 100;
        }

        CameraAnims.animateCameraToLocation(
            cameraRef.current,
            controlsRef.current,
            { x: targetRD.x + offsetX, y: targetRD.y + offsetY },
            tilesRef.current.group.position,
            () => { needsRerender.current = 1; },
            onComplete,
            cameraAngle,
            cameraDistance
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

    const zoomOutToMax = useCallback((customDistance?: number) => {
        if (!controlsRef.current || !cameraRef.current || !initialCameraStateRef.current) return;
        
        // Use the new reset-aware zoom out
        CameraAnims.animateZoomOutToDefault(
            cameraRef.current,
            controlsRef.current,
            initialCameraStateRef.current,
            () => { needsRerender.current = 1; },
            customDistance
        );
    }, [cameraRef, controlsRef, initialCameraStateRef, needsRerender]);

    const { 
        handleNextStoryline: _ignoredHandleNextStoryline, 
        hasZoomedOutRef, 
        isRewindingRef, 
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

    const handleNextStoryline = () => {
        if (isTransitioning) return;

        // If currently viewing an innovation project
        if (innovationEvent) {
            const currentIdx = innovationProjects.findIndex(p => p.id === innovationEvent.id);
            const nextProj = innovationProjects[currentIdx + 1];
            
            if (nextProj) {
                 setInnovationEvent({
                    ...nextProj,
                    year: 2030,
                    description: `# ${nextProj.name}\n\n${nextProj.description}`,
                    coordinate: nextProj.coordinate,
                    image: nextProj.image || '/amsterdam-2026.webp'
                });
                // Update year if needed (though likely all 2030)
                // if (nextProj.year) setCurrentYear(nextProj.year);
                
                animateCameraToStoryline(nextProj.coordinate);
            } else {
                // No more projects: Transition to ending text if available
                setInnovationEvent(null);
                
                const nextIdx = storylineIndex + 1;
                const endingEvent = parsedStorylinesData[nextIdx];

                if (endingEvent && endingEvent.ending_text) {
                    setStorylineIndex(nextIdx);
                    setStorylineMode('focus');
                    setIsStorylineComplete(true);
                    
                    animateCameraToOverview();
                } else {
                    setStorylineMode('overview');
                    animateCameraToOverview();
                }
            }
            return;
        }
        
        isOrbitingRef.current = false;
        
        const nextIdx = storylineIndex + 1;
        
        // If next chapter exists

        if (parsedStorylinesData[nextIdx]) {
            // Check if next item is the ending text. If so, we want to show innovation projects FIRST.
            if (parsedStorylinesData[nextIdx].ending_text) {
                 setStorylineMode('overview');
                 setIsPlaying(false);
                 // Don't mark complete yet, as we have the ending text to come back to?
                 // or maybe we do. Text says "it should go ... to innovation ... then to ending text".
                 // So we are not "done-done".
                 
                 // 1. Zoom Out first
                 animateCameraToOverview();
                 setIsTransitioning(true);

                 // 2. Animate Year to 2030
                 const yearObj = { year: currentYear };
                 new TWEEN.Tween(yearObj)
                    .to({ year: 2030 }, 2500)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        setCurrentYear(Math.round(yearObj.year));
                    })
                    .onComplete(() => {
                         // 3. Open First Innovation Project
                         setIsTransitioning(false);
                         if (innovationProjects.length > 0) {
                            const p = innovationProjects[0];
                            setInnovationEvent({
                               ...p,
                               year: 2030,
                               description: `# ${p.name}\n\n${p.description}`,
                               coordinate: p.coordinate,
                               image: p.image || '/amsterdam-2026.webp'
                           });
                           animateCameraToStoryline(p.coordinate);
                         }
                    })
                    .start();
                return;
            }

            setStorylineMode('overview'); // Show timeline
            setIsTransitioning(true);
            
            const nextEvent = parsedStorylinesData[nextIdx];
            const isModern = nextEvent.year > 1850;

            // 1. Zoom Out to Overview
            let zoomTime = 2000;
            
            if (isModern) {
                // "Even-more-zoomed-out view" for modern era targets
                zoomOutToMax(6000);
                zoomTime = 4000; // From CameraAnims.animateZoomOut duration
            } else {
                // Standard City Center view for historical targets
                animateCameraToOverview();
            }

            // Wait for zoom out to finish before starting year animation
            setTimeout(() => {
                const yearObj = { year: currentYear };
                // Year animation duration
                const yearDuration = 2500;
                
                new TWEEN.Tween(yearObj)
                    .to({ year: nextEvent.year }, yearDuration) 
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        setCurrentYear(Math.round(yearObj.year));
                    })
                    .onComplete(() => {
                        // After timeline finishes, update index & zoom in
                        setStorylineIndex(nextIdx); 

                        animateCameraToStoryline(
                            nextEvent.coordinate,
                            () => {
                                // 3. Arrived
                                setTimeout(() => {
                                    setStorylineMode('focus');
                                    // setIsPlaying(true); // Don't auto-play immediately when arriving at a chapter
                                    setIsTransitioning(false);
                                    
                                    if (controlsRef.current) {
                                        // Auto-rotate only if no cameraAngle specified and NOT ending text
                                        if (nextEvent.cameraAngle === undefined && !nextEvent.ending_text) {
                                            isOrbitingRef.current = true;
                                            controlsRef.current.autoRotate = true;
                                            controlsRef.current.autoRotateSpeed = -1.5;
                                        }
                                    }
                                }, 300);
                            },
                            nextEvent.cameraAngle,
                            nextEvent.cameraDistance
                        );
                    })
                    .start();
            }, zoomTime); 
        } else {
             // Reached the end of the storyline (after ending text)
             setStorylineMode('overview');
             setIsPlaying(false);
             setIsStorylineComplete(true);
             animateCameraToOverview();
        }
    };

    const onUserInteraction = useCallback(() => {
        if (isOrbitingRef.current) {
            isOrbitingRef.current = false;
        }
    }, [isOrbitingRef]);

    const handlePlayPause = useCallback((shouldPlay: boolean) => {
        if (!shouldPlay) {
            setIsPlaying(false);
            isRewindingRef.current = false;
            return;
        }

        setIsPlaying(true);
        isRewindingRef.current = true;
        setIsTransitioning(true);
        // Reset zoom out flag so it triggers again at 1850
        hasZoomedOutRef.current = false;

        // Force reset isStorylineComplete just in case, though play button usually only appears at end
        // But if user manually scrubbed to 2030 then hit play, we need this flow.

        // 1. Rewind/Zoom Animation
        if (cameraRef.current && controlsRef.current) {
             const targetCam = streetLevelCameraPositionRef.current || initialCameraStateRef.current;
             if (targetCam) {
                CameraAnims.animateResetToStart(
                    cameraRef.current,
                    controlsRef.current,
                    targetCam,
                    () => { needsRerender.current = 1; }
                );
             }
        }

        // Wait for rewind (1000ms) before starting year animation
        setTimeout(() => {
            const yearObj = { year: currentYear };
            new TWEEN.Tween(yearObj)
                .to({ year: minYear }, 2000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    const y = Math.round(yearObj.year);
                    setCurrentYear(y);
                })
                .onComplete(() => {
                    isRewindingRef.current = false;
                    setIsTransitioning(false);
                })
                .start();
        }, 1000);
    }, [cameraRef, controlsRef, initialCameraStateRef, currentYear, minYear, setIsPlaying, hasZoomedOutRef, isRewindingRef, needsRerender, zoomOutToMax]);


    const { placeMarkerOnPoint } = useMarkers(sceneRef, needsRerender, userHasPanned);

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
                // Wait for 15 frames (approx 0.25 sec) of stability to ensure everything is truly loaded
                if (stableFramesRef.current > 15 && !isFinishingLoadRef.current) {
                    // Also wait for images to load
                    if (areImagesPreloadedRef.current) {
                        isFinishingLoadRef.current = true;
                        setLoadingProgress(100);
                        setTimeout(() => {
                            setIsLoading(false);
                            isLoadingRef.current = false;
                        }, 200);
                    }
                } else if (!isFinishingLoadRef.current) {
                   // Continue inching towards 100 while verifying stability
                   setLoadingProgress((prev: number) => {
                        const target = 99;
                        const step = (target - prev) * 0.05; // Slower approach to 99 so it doesn't sit there as long
                        return prev + Math.max(0.05, step);
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
        const isAutoPlayingStoryline = (isPlaying || isTransitioning) && !isStorylineComplete && !skipStoryline;

        controlsRef.current.enabled = !isAutoPlayingStoryline;

    }, [isPlaying, isStorylineComplete, skipStoryline, controlsRef, isTransitioning]);

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
                    backgroundColor: storylineMode === 'focus' && parsedStorylinesData[storylineIndex] && (parsedStorylinesData[storylineIndex] as any).colorFilter 
                        ? (parsedStorylinesData[storylineIndex] as any).colorFilter 
                        : 'transparent',
                    pointerEvents: 'none',
                    zIndex: 1,
                    transition: 'background-color 1.5s ease-in-out',
                    mixBlendMode: 'multiply'
                }}
            />

            <IntroOverlay 
                show={showIntro} 
                onStart={(skip, resume, goToInnovation) => {
                    setShowIntro(false);
                    setSkipStoryline(skip);
                    
                    if (skip) {
                        setIsPlaying(false);
                        setIsStorylineComplete(true);

                        if (goToInnovation) {
                            // Immediately go to 2030 and open first project
                            setIsTransitioning(true); // Don't show controls tooltip
                            animateCameraToOverview(); // Start from overview for transition
                            
                            const yearObj = { year: PRESENT_YEAR }; // Start from now
                            setCurrentYear(PRESENT_YEAR);
                            
                            new TWEEN.Tween(yearObj)
                                .to({ year: 2030 }, 2000)
                                .easing(TWEEN.Easing.Quadratic.InOut)
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .onComplete(() => {
                                     setIsTransitioning(false);
                                     if (innovationProjects.length > 0) {
                                         const p = innovationProjects[0];
                                         setInnovationEvent({
                                            ...p,
                                            year: 2030,
                                            description: `# ${p.name}\n\n${p.description}`,
                                            coordinate: p.coordinate,
                                            image: p.image || '/amsterdam-2026.webp'
                                        });
                                        animateCameraToStoryline(p.coordinate, undefined, p.cameraAngle, p.cameraDistance);
                                     }
                                })
                                .start();
                            
                        } else {
                            // Free explore
                            setCurrentYear(2030);
                            animateCameraToOverview();
                        }
                    } else if (resume) { 
                        // Resume logic
                        const savedIndex = parseInt(localStorage.getItem('amsterdam_map_storyline_index') || '0', 10);
                        setStorylineIndex(savedIndex);
                        setStorylineMode('focus');
                        
                        // Set correct year instantly
                        const year = parsedStorylinesData[savedIndex].year;
                        setCurrentYear(year);

                        // Animate to position
                        const coord = parsedStorylinesData[savedIndex].coordinate;
                        // Convert RD to local if needed, but animateCameraToStoryline takes RD
                        animateCameraToStoryline(coord);
                        setIsPlaying(true);
                    } else {
                        // Start fresh logic (existing rewind logic)
                        setStorylineIndex(0); // Ensure start at 0
                        setIsTransitioning(true);
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
                            const yearObj = { year: PRESENT_YEAR };
                            new TWEEN.Tween(yearObj)
                                .to({ year: minYear }, 4000)
                                .delay(1750)
                                .easing(TWEEN.Easing.Quadratic.In) // Start slow (at present), speed up towards 1275
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .onComplete(() => {
                                    setTimeout(() => {
                                        setIsPlaying(true);
                                        setIsTransitioning(false);
                                    }, 500);
                                })
                                .start();
                        }, 1500);
                    }
                }} 
                isLoading={isLoading}
                progress={loadingProgress}
            />
            
            {innovationEvent && (
                <StorylineOverlay
                    event={innovationEvent}
                    onNext={() => {
                        const currentIdx = innovationProjects.findIndex(p => p.name === innovationEvent.name);
                        const nextIdx = currentIdx + 1;
                        if (nextIdx < innovationProjects.length) {
                             const nextProject = innovationProjects[nextIdx];
                             const year = 2030;
                             setInnovationEvent({
                                ...nextProject,
                                 year: year,
                                 description: `# ${nextProject.name}\n\n${nextProject.description}`,
                                 coordinate: nextProject.coordinate,
                                 image: nextProject.image || '/amsterdam-2026.webp'
                            });
                            
                            // Also jump timeline to project year (2030+)
                            const yearObj = { year: currentYear };
                            new TWEEN.Tween(yearObj)
                                .to({ year: year }, 1500)
                                .easing(TWEEN.Easing.Quadratic.InOut)
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .start();

                            animateCameraToStoryline(nextProject.coordinate, () => {
                                 if (controlsRef.current && nextProject.cameraAngle === undefined) {
                                         isOrbitingRef.current = true;
                                         controlsRef.current.autoRotate = true;
                                         controlsRef.current.autoRotateSpeed = -1.5;
                                 }
                            }, nextProject.cameraAngle, nextProject.cameraDistance);
                        } else {
                            // Finished innovation projects
                            setInnovationEvent(null);
                            
                            // Check for ending text
                            const endingIndex = parsedStorylinesData.findIndex((s: any) => s.ending_text);
                            
                            if (endingIndex !== -1) {
                                const endingEvent = parsedStorylinesData[endingIndex];
                                setStorylineIndex(endingIndex);
                                setStorylineMode('focus');
                                setIsStorylineComplete(true);
                                
                                animateCameraToStoryline(
                                    endingEvent.coordinate,
                                    () => {
                                        // Ensure rotation is STOPPED for ending text
                                        isOrbitingRef.current = false;
                                        if (controlsRef.current) {
                                            controlsRef.current.autoRotate = false;
                                        }
                                    },
                                    endingEvent.cameraAngle,
                                    endingEvent.cameraDistance
                                );
                            } else {
                                setStorylineMode('overview');
                                animateCameraToOverview();
                            }
                        }
                    }}
                    onSkip={() => {
                        setInnovationEvent(null);
                        animateCameraToOverview();
                    }}
                    variant="innovation"
                    // Pass next project name for button text
                    currentIndex={innovationProjects.findIndex(p => p.name === innovationEvent.name)}
                    totalEvents={innovationProjects.length}
                />
            )}

            {/* Persistent Progress Pill in Both Modes (shows different content) */}
            {!isLoading && !showIntro && !innovationEvent && (
                <StorylineProgress
                    chapters={parsedStorylinesData}
                    activeIndex={storylineIndex}
                    isProjectCompleted={isStorylineComplete}
                    isOpen={activeOverlay === 'chapter'}
                    onToggle={(isOpen) => setActiveOverlay(isOpen ? 'chapter' : null)}
                    onJump={(index) => {
                        setIsPlaying(false); // Pause on manual jump

                        const event = parsedStorylinesData[index];
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
                        if (event.ending_text) {
                            animateCameraToOverview();
                        } else {
                            animateCameraToStoryline(event.coordinate, () => {
                                 if (controlsRef.current) {
                                         isOrbitingRef.current = true;
                                         controlsRef.current.autoRotate = true;
                                         controlsRef.current.autoRotateSpeed = -1.5;
                                 }
                            });
                        }
                        if (!controlsGuideDismissed) setControlsGuideDismissed(true);
                    }}
                    onSkipToFuture={async () => {
                        isOrbitingRef.current = false;
                        setStorylineMode('overview'); 
                        setIsPlaying(false);
                        
                        // 1. Zoom out first
                        const overviewPromise = new Promise<void>((resolve) => {
                             if (cameraRef.current && controlsRef.current && initialCameraStateRef.current) {
                                CameraAnims.animateCameraToOverview(
                                    cameraRef.current,
                                    controlsRef.current,
                                    initialCameraStateRef.current,
                                    () => { needsRerender.current = 1; }
                                );
                                // Wait for visible zoom out
                                setTimeout(resolve, 1000);
                             } else {
                                 resolve();
                             }
                        });

                        await overviewPromise;
                        await new Promise(r => setTimeout(r, 400));
                        
                        setIsStorylineComplete(true);
                        
                        // Go to first innovation project
                        if (innovationProjects.length > 0) {
                             const firstProj = innovationProjects[0];

                             // Smoothly animate year to project year
                             const yearObj = { year: currentYear };
                             new TWEEN.Tween(yearObj)
                                .to({ year: 2030 }, 2000)
                                .easing(TWEEN.Easing.Quadratic.InOut)
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .onComplete(() => {
                                     setInnovationEvent({
                                        ...firstProj,
                                         year: 2030,
                                         description: `# ${firstProj.name}\n\n${firstProj.description}`,
                                         coordinate: firstProj.coordinate,
                                         image: firstProj.image || '/amsterdam-2026.webp'
                                     });
                                     animateCameraToStoryline(firstProj.coordinate, undefined, firstProj.cameraAngle, firstProj.cameraDistance);
                                })
                                .start();
                         }
                    }}
                    onStartStoryline={() => {
                        // Immediately snap to start context
                        const startEvent = parsedStorylinesData[0];
                        setStorylineMode('focus');
                        setStorylineIndex(0); // Ensure index is 0
                        setCurrentYear(startEvent.year); // Force year to match chapter 1
                        
                        // Animate camera and start playing
                        animateCameraToStoryline(
                            startEvent.coordinate,
                            () => {
                                // Only auto-rotate if no specific angle was set
                                if (startEvent.cameraAngle === undefined && controlsRef.current) {
                                    isOrbitingRef.current = true;
                                    controlsRef.current.autoRotate = true;
                                    controlsRef.current.autoRotateSpeed = -1.5;
                                }
                            },
                            startEvent.cameraAngle,
                            startEvent.cameraDistance
                        );
                        
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
            
            {storylineMode === 'focus' && !innovationEvent && parsedStorylinesData[storylineIndex] && (
                <StorylineOverlay 
                    event={parsedStorylinesData[storylineIndex]} 
                    isStorylineComplete={isStorylineComplete}
                    onNext={handleNextStoryline}
                    onPrev={() => {
                        const prevIdx = storylineIndex - 1;
                        if (prevIdx >= 0) {
                            // 1. Zoom Out
                            isOrbitingRef.current = false;
                            setStorylineMode('overview'); 
                            setIsTransitioning(true);
                            animateCameraToOverview(); 

                            const prevEvent = parsedStorylinesData[prevIdx];

                            // 2. Wait for zoom out, then animate year
                            setTimeout(() => {
                                const yearObj = { year: currentYear };
                                new TWEEN.Tween(yearObj)
                                    .to({ year: prevEvent.year }, 2000)
                                    .easing(TWEEN.Easing.Quadratic.InOut) 
                                    .onUpdate(() => {
                                        setCurrentYear(Math.round(yearObj.year));
                                    })
                                    .onComplete(() => {
                                        // 3. Zoom In
                                        setStorylineIndex(prevIdx); 
                                        animateCameraToStoryline(
                                            prevEvent.coordinate,
                                            () => {
                                                // 4. Arrived
                                                setTimeout(() => {
                                                    setStorylineMode('focus');
                                                    setIsTransitioning(false);
                                                    
                                                    if (controlsRef.current && prevEvent.cameraAngle === undefined) {
                                                        isOrbitingRef.current = true;
                                                        controlsRef.current.autoRotate = true;
                                                        controlsRef.current.autoRotateSpeed = -1.5;
                                                    }
                                                }, 300);
                                            },
                                            prevEvent.cameraAngle,
                                            prevEvent.cameraDistance
                                        );
                                    })
                                    .start();
                            }, 2000); 
                        }
                    }}
                    onSkip={() => {
                        isOrbitingRef.current = false;
                        setSkipStoryline(true);
                        setStorylineMode('overview');
                        setIsPlaying(false);
                        setIsStorylineComplete(true);
                        
                        // Smoothly animate year to PRESENT_YEAR
                        const yearObj = { year: currentYear };
                        new TWEEN.Tween(yearObj)
                            .to({ year: PRESENT_YEAR }, 2500) // 2.5s duration for smoother transition
                            .easing(TWEEN.Easing.Quadratic.InOut)
                            .onUpdate(() => {
                                setCurrentYear(Math.round(yearObj.year));
                            })
                            .start();

                        animateCameraToOverview(); 
                    }}
                    onJump={(index) => {
                        if (index >= 0 && index < parsedStorylinesData.length) {
                             setIsPlaying(false);
                             setStorylineIndex(index);
                             const event = parsedStorylinesData[index];
                             setCurrentYear(event.year);
                             setStorylineMode('focus');
                             
                             if (event.ending_text) {
                                 animateCameraToOverview();
                             } else {
                                 animateCameraToStoryline(
                                     event.coordinate, 
                                     () => {
                                         // Enable rotation after arriving ONLY if no fixed angle
                                         if (event.cameraAngle === undefined && controlsRef.current) {
                                             isOrbitingRef.current = true;
                                             controlsRef.current.autoRotate = true;
                                             controlsRef.current.autoRotateSpeed = -1.5;
                                         }
                                     },
                                     event.cameraAngle,
                                     event.cameraDistance
                                 );
                             }
                        }
                    }}
                    nextProjectName={innovationProjects[0]?.name}
                    currentIndex={storylineIndex}
                    totalEvents={parsedStorylinesData.length}
                    allEvents={parsedStorylinesData}
                />
            )}

            {!showIntro && !isLoading && (
                <>
                    {storylineMode !== 'focus' &&  (
                        <>
                            {storylineMode === 'overview' && !innovationEvent && (
                                <InnovationList
                                    projects={innovationProjects}
                                    isOpen={activeOverlay === 'innovation'}
                                    onToggle={(isOpen) => {
                                        setActiveOverlay(isOpen ? 'innovation' : null);
                                        if (onInnovationToggle) onInnovationToggle(isOpen);
                                    }}
                                    onSelectProject={(project) => {
                                        setStorylineMode('overview'); // Exit story mode
                                        setInnovationEvent({
                                            ...project, // Keep all props including name
                                            year: 2030,
                                            description: `# ${project.name}\n\n${project.description}`,
                                            coordinate: project.coordinate,
                                            image: project.image || '/amsterdam-2026.webp'
                                        });
                                        setIsPlaying(false);
                                        // Animate year to 2030 if not already close
                                        if (currentYear < 2030) {
                                             const yearObj = { year: currentYear };
                                             new TWEEN.Tween(yearObj)
                                                .to({ year: 2030 }, 1000)
                                                .easing(TWEEN.Easing.Quadratic.Out)
                                                .onUpdate(() => {
                                                    setCurrentYear(Math.round(yearObj.year));
                                                })
                                                .start();
                                        } else {
                                            setCurrentYear(2030);
                                        }
                                        
                                        animateCameraToStoryline(project.coordinate);
                                        if (!controlsGuideDismissed) setControlsGuideDismissed(true);
                                    }}
                                />
                            )}
                        </>
                    )}
                    <TimelineOverlay
                        minYear={minYear}
                        maxYear={2030} // Extends to 2030 for innovation
                        presentYear={PRESENT_YEAR}
                        currentYear={currentYear}
                        isTransitioning={isTransitioning}
                        onYearChange={(targetYear, isDragging) => {
                             // Cancel explicit playing if manually scrubbing
                             if (isPlaying) setIsPlaying(false);

                             // Update current year
                             // If dragging, always update directly (dragging is the animation)
                             // If jumping (click) and diff is large, tween.
                             if (isDragging || Math.abs(targetYear - currentYear) <= 2) {
                                 setCurrentYear(targetYear);
                             } else {
                                 const yearObj = { year: currentYear };
                                 new TWEEN.Tween(yearObj)
                                    .to({ year: targetYear }, 500)
                                    .easing(TWEEN.Easing.Cubic.Out)
                                    .onUpdate(() => {
                                        setCurrentYear(Math.round(yearObj.year));
                                    })
                                    .start();
                             }

                             if (storylineMode !== 'focus') {
                                // If target year is 2030 zone
                                if (false) {
                                     // Jump to innovation if not already there
                                     if (!innovationEvent) {
                                         // Pick first one
                                         const p = innovationProjects[0];
                                         setInnovationEvent({
                                            ...p,
                                            year: 2030,
                                            description: `# ${p.name}\n\n${p.description}`,
                                            coordinate: p.coordinate,
                                            image: p.image || '/amsterdam-2026.webp'
                                        });
                                        animateCameraToStoryline(p.coordinate);
                                        
                                        // Also ensure button shows close icon
                                     }
                                } else if (innovationEvent) {
                                    // If dragging back from 2030 to normal history, exit innovation mode
                                    if (targetYear <= PRESENT_YEAR) {
                                        setInnovationEvent(null);
                                        animateCameraToOverview(); 
                                        // This snaps back to overview cam
                                    }
                                }
                                
                                // setStorylineMode('focus'); // REMOVED: Don't force focus mode when scrubbing timeline
                                // Logic: If scrubbing, user is exploring time, maybe keep in overview unless they stop?
                                // For now, let's just update year.
                                
                                // Find closest chapter logic...
                             }
                        }}
                        isPlaying={isPlaying}
                        onPlayPause={(playing) => {
                             // If user hits play while at end year (PRESENT_YEAR or 2030)
                             if (playing && currentYear >= PRESENT_YEAR) {
                                 // Reset to start
                                 const yearObj = { year: currentYear };
                                 setIsPlaying(false);
                                 
                                 // Rewind effect
                                 new TWEEN.Tween(yearObj)
                                    .to({ year: minYear }, 2000)
                                    .easing(TWEEN.Easing.Quadratic.InOut)
                                    .onUpdate(() => {
                                        setCurrentYear(Math.round(yearObj.year));
                                    })
                                    .onComplete(() => {
                                        setIsPlaying(true);
                                    })
                                    .start();
                                return;
                             }
                             
                             if (storylineMode === 'focus') return; // Disable play in focus mode
                             handlePlayPause(playing);
                        }}
                        isStorylineActive={storylineMode === 'focus' || !!innovationEvent}
                        isStorylineComplete={isStorylineComplete}
                    />
                    <MapControlsGuide 
                        visible={isStorylineComplete && !controlsGuideDismissed && !innovationEvent && storylineMode === 'overview' && !isTransitioning} 
                        hasPanned={userHasPanned}
                        hasRotated={userHasRotated}
                    />
                    <MapControls 
                        visible={isStorylineComplete && !isLoading && !showIntro && !innovationEvent && storylineMode === 'overview' && storylineIndex < parsedStorylinesData.length}
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
                                    // Using camera bounds: X: 119000 - 124000, Y: 484500 - 488000
                                    if (rdX < 119000 || rdX > 124000 || rdY < 484500 || rdY > 488000) {
                                        if (onShowLocationBox) onShowLocationBox("Locatie niet binnen het kaartgebied");
                                        return;
                                    }

                                    animateCameraToStoryline({ x: rdX, y: rdY }, () => {
                                        placeMarkerOnPoint(new THREE.Vector3(
                                            controlsRef.current?.target.x || 0,
                                            controlsRef.current?.target.y || 0,
                                            controlsRef.current?.target.z || 0
                                        ));
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
                    <AboutMap 
                        isOpen={activeOverlay === 'about'} 
                        onClose={() => setActiveOverlay(null)} 
                        onToggle={() => setActiveOverlay(prev => prev === 'about' ? null : 'about')}
                    />
                    <PopulationChart 
                        currentYear={currentYear} 
                        onOpenAbout={() => setActiveOverlay('about')}
                    />

                </>
            )}
        </>
    );
};
