
import os

content = """import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { useLocation } from 'react-router-dom';

import { useThreeScene } from '../hooks/useThreeScene';
import { useTilesLoader } from '../hooks/useTilesLoader';
import { useBasemap } from '../hooks/useBasemap';
import { useTileShaders } from '../hooks/useTileShaders';
import { useMarkers } from '../hooks/useMarkers';
import { useStorylineLogic } from '../hooks/useStorylineLogic';
import { useInputEvents } from '../hooks/useInputEvents';
import { useMapControls } from '../hooks/useMapControls';
import * as CameraAnims from '../utils/cameraAnimations';

import { MapOverlays } from './MapOverlays';

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
    onShowLocationBox,
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

    // Save/Load progress
    useEffect(() => {
        const savedIndex = localStorage.getItem('amsterdam_map_storyline_index');
        if (savedIndex) {
            const index = parseInt(savedIndex, 10);
            if (index > 0 && index < storylinesData.length) {
                setStorylineIndex(index);
            }
        }
    }, []);

    useEffect(() => {
         localStorage.setItem('amsterdam_map_storyline_index', storylineIndex.toString());
    }, [storylineIndex]);
    
    // Track user interaction
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
    const [minYear] = useState(1275);
    
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

    const requestRef = useRef<number>(0);
    const streetLevelCameraPositionRef = useRef<{ position: THREE.Vector3, target: THREE.Vector3 } | null>(null);
    const location = useLocation();

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

    useEffect(() => {
        reinitBasemapRef.current = reinitBasemap;
    }, [reinitBasemap]);

    const animateCameraToStoryline = useCallback((targetRD: { x: number, y: number }, onComplete?: () => void) => {
        if (!tilesRef.current || !controlsRef.current || !cameraRef.current) return;
        setUserHasPanned(false);
        setUserHasRotated(false);
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
        handleNextStoryline: _ignoredHandleNextStoryline, 
        hasZoomedOutRef, 
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
        isOrbitingRef.current = false;
        const nextIdx = storylineIndex + 1;
        if (storylinesData[nextIdx]) {
            setStorylineMode('overview'); // Show timeline
            if (cameraRef.current && controlsRef.current) {
                const currentPos = cameraRef.current.position.clone();
                const zoomOutY = Math.max(2500, currentPos.y + 1000);
                const zoomOutTarget = currentPos.clone().setY(zoomOutY);
                new TWEEN.Tween(cameraRef.current.position)
                    .to({ x: zoomOutTarget.x, y: zoomOutTarget.y, z: zoomOutTarget.z }, 1200)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .start();
            }
            const nextEvent = storylinesData[nextIdx];
            const yearObj = { year: currentYear };
            new TWEEN.Tween(yearObj)
                .to({ year: nextEvent.year }, 2500) 
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    setCurrentYear(Math.round(yearObj.year));
                })
                .start();
            setTimeout(() => {
                 setStorylineIndex(nextIdx); 
                 animateCameraToStoryline(nextEvent.coordinate, () => {
                     setTimeout(() => {
                        setStorylineMode('focus');
                        setIsPlaying(true); 
                         if (controlsRef.current) {
                             isOrbitingRef.current = true;
                             controlsRef.current.autoRotate = true;
                             controlsRef.current.autoRotateSpeed = -1.5;
                         }
                     }, 300);
                 });
            }, 1200); 
        } else {
             setStorylineIndex(storylinesData.length - 1);
             setStorylineMode('focus'); 
        }
    };

    const onUserInteraction = useCallback(() => {
        if (isOrbitingRef.current) {
            isOrbitingRef.current = false;
        }
    }, [isOrbitingRef]);

    useInputEvents({
        containerRef,
        cameraRef,
        rendererRef,
        tilesRef,
        terrainTilesRef,
        sceneRef,
        controlsRef,
        dummyCameraRef,
        needsRerender,
        isReady,
        onObjectPicked,
        onUserInteraction
    });

    useMapControls({
        controlsRef,
        tilesRef,
        cameraRef,
        needsRerender,
        tilesCentered,
        isPlaying,
        isStorylineComplete,
        skipStoryline,
        setUserHasPanned,
        setUserHasRotated
    });

    const handlePlayPause = useCallback((shouldPlay: boolean) => {
        if (!shouldPlay) {
            setIsPlaying(false);
            return;
        }
        setIsPlaying(false);
        hasZoomedOutRef.current = false;
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

    const updateLoadingState = () => {
        if (isLoadingRef.current && tilesRef.current) {
            const stats = tilesRef.current.stats;
            const isStable = stats.downloading === 0 && stats.parsing === 0;
            if (tilesRef.current.root && isStable) {
                stableFramesRef.current++;
                if (stableFramesRef.current > 60 && !isFinishingLoadRef.current) {
                    isFinishingLoadRef.current = true;
                    setLoadingProgress(100);
                    setTimeout(() => {
                        setIsLoading(false);
                        isLoadingRef.current = false;
                    }, 500);
                } else if (!isFinishingLoadRef.current) {
                   setLoadingProgress((prev: number) => {
                        const target = 99;
                        const step = (target - prev) * 0.1; 
                        return prev + Math.max(0.1, step);
                   });
                }
            } else {
                stableFramesRef.current = 0;
                if (!isFinishingLoadRef.current) {
                    setLoadingProgress((prev: number) => {
                        const target = 80;
                        const step = (target - prev) * 0.08; 
                        return prev + Math.max(0.2, step); 
                    });
                }
            }
        }
    };

    const updateTilesAndMaterials = () => {
        if (tilesRef.current) {
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
        const overviewDist = 8000;
        const overviewPos = target.clone().add(new THREE.Vector3(0, overviewDist, 100));
        if (cameraRef.current && controlsRef.current && dummyCameraRef.current) {
            cameraRef.current.position.copy(overviewPos);
            controlsRef.current.target.copy(target);
            controlsRef.current.update();
            dummyCameraRef.current.position.copy(overviewPos);
            dummyCameraRef.current.lookAt(target);
            dummyCameraRef.current.updateMatrixWorld();
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

    const checkCentering = () => {
        if (tilesRef.current && !tilesCentered.current && tilesRef.current.root) {
            const root = tilesRef.current.root;
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
        needsRerender.current = 1;
        animate();
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

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
            
            <MapOverlays
                isLoading={isLoading}
                loadingProgress={loadingProgress}
                showIntro={showIntro}
                setShowIntro={setShowIntro}
                setSkipStoryline={setSkipStoryline}
                setStorylineIndex={setStorylineIndex}
                setStorylineMode={setStorylineMode}
                setCurrentYear={setCurrentYear}
                setIsPlaying={setIsPlaying}
                setIsStorylineComplete={setIsStorylineComplete}
                setInnovationEvent={setInnovationEvent}
                setControlsGuideDismissed={setControlsGuideDismissed}
                controlsGuideDismissed={controlsGuideDismissed}
                innovationEvent={innovationEvent}
                storylineMode={storylineMode}
                storylineIndex={storylineIndex}
                currentYear={currentYear}
                minYear={minYear}
                isPlaying={isPlaying}
                isStorylineComplete={isStorylineComplete}
                userHasPanned={userHasPanned}
                userHasRotated={userHasRotated}
                onShowLocationBox={onShowLocationBox}
                controlsRef={controlsRef}
                cameraRef={cameraRef}
                tilesRef={tilesRef}
                animateCameraToStoryline={animateCameraToStoryline}
                animateCameraToOverview={animateCameraToOverview}
                placeMarkerOnPoint={placeMarkerOnPoint}
                handleNextStoryline={handleNextStoryline}
                handlePlayPause={handlePlayPause}
                hasZoomedOutRef={hasZoomedOutRef}
                isOrbitingRef={isOrbitingRef}
                needsRerender={needsRerender}
                initialCameraStateRef={initialCameraStateRef}
            />
        </>
    );
};
"""
with open('src/components/ThreeViewer.tsx', 'w') as f:
    f.write(content)
