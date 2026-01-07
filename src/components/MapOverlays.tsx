import React from 'react';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

import { IntroOverlay } from './overlays/IntroOverlay';
import { TimelineOverlay } from './overlays/TimelineOverlay';
import { StorylineOverlay } from './overlays/StorylineOverlay';
import { StorylineProgress } from './overlays/StorylineProgress';
import { InnovationList } from './overlays/InnovationList';
import { MapControlsGuide } from './overlays/MapControlsGuide';
import { AboutMap } from './overlays/AboutMap';
import { MapControls } from './overlays/MapControls';

import { wgs84ToRd } from '../utils/coords';
import storylinesDataRaw from '../assets/storylines.json';
import innovationProjects from '../assets/innovation_projects.json';

// Handle parsing of "current" year in storylines
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storylinesData = storylinesDataRaw.map((s: any) => ({
    ...s,
    year: (s.year === "current") ? new Date().getFullYear() : s.year
}));

interface MapOverlaysProps {
    isLoading: boolean;
    loadingProgress: number;
    showIntro: boolean;
    setShowIntro: (v: boolean) => void;
    setSkipStoryline: (v: boolean) => void;
    setStorylineIndex: (v: number) => void;
    setStorylineMode: (v: 'overview' | 'focus') => void;
    setCurrentYear: (v: number) => void;
    setIsPlaying: (v: boolean) => void;
    setIsStorylineComplete: (v: boolean) => void;
    setInnovationEvent: (v: any) => void;
    setControlsGuideDismissed: (v: boolean) => void;
    controlsGuideDismissed: boolean;
    innovationEvent: any;
    storylineMode: 'overview' | 'focus';
    storylineIndex: number;
    currentYear: number;
    minYear: number;
    isPlaying: boolean;
    isStorylineComplete: boolean;
    userHasPanned: boolean;
    userHasRotated: boolean;
    onShowLocationBox?: (text: string) => void;
    controlsRef: React.RefObject<any>;
    cameraRef: React.RefObject<any>;
    tilesRef: React.RefObject<any>;
    animateCameraToStoryline: (target: { x: number, y: number }, cb?: () => void) => void;
    animateCameraToOverview: () => void;
    placeMarkerOnPoint: (pos: THREE.Vector3) => void;
    handleNextStoryline: () => void;
    handlePlayPause: (play: boolean) => void;
    hasZoomedOutRef: React.MutableRefObject<boolean>;
    isOrbitingRef: React.MutableRefObject<boolean>;
    needsRerender: React.MutableRefObject<number>;
    initialCameraStateRef: React.MutableRefObject<any>;
}

export const MapOverlays: React.FC<MapOverlaysProps> = ({
    isLoading,
    loadingProgress,
    showIntro,
    setShowIntro,
    setSkipStoryline,
    setStorylineIndex,
    setStorylineMode,
    setCurrentYear,
    setIsPlaying,
    setIsStorylineComplete,
    setInnovationEvent,
    setControlsGuideDismissed,
    controlsGuideDismissed,
    innovationEvent,
    storylineMode,
    storylineIndex,
    currentYear,
    minYear,
    isPlaying,
    isStorylineComplete,
    userHasPanned,
    userHasRotated,
    onShowLocationBox,
    controlsRef,
    cameraRef,
    tilesRef,
    animateCameraToStoryline,
    animateCameraToOverview,
    placeMarkerOnPoint,
    handleNextStoryline,
    handlePlayPause,
    hasZoomedOutRef,
    isOrbitingRef,
    needsRerender,
    initialCameraStateRef
}) => {
    return (
        <>
            <div 
                id="canvas-overlay"
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 0
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
                        setCurrentYear(new Date().getFullYear());
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
                            const yearObj = { year: new Date().getFullYear() };
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
                        
                        setIsPlaying(true);
                        if (!controlsGuideDismissed) setControlsGuideDismissed(true);
                    }}
                    mode={storylineMode}
                    currentYear={currentYear}
                />
            )}
            
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
                        
                        // Smoothly animate year to PRESENT_YEAR
                        const yearObj = { year: currentYear };
                        const PRESENT_YEAR = new Date().getFullYear();
                        new TWEEN.Tween(yearObj)
                            .to({ year: PRESENT_YEAR }, 2500) 
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
                        maxYear={new Date().getFullYear()}
                        currentYear={currentYear}
                        onYearChange={(targetYear) => {
                             if (isPlaying) setIsPlaying(false);

                             const yearObj = { year: currentYear };
                             new TWEEN.Tween(yearObj)
                                .to({ year: targetYear }, 500)
                                .easing(TWEEN.Easing.Cubic.Out)
                                .onUpdate(() => {
                                    setCurrentYear(Math.round(yearObj.year));
                                })
                                .start();

                             if (storylineMode !== 'focus') {
                                setStorylineMode('focus');
                             }
                        }}
                        isPlaying={isPlaying}
                        onPlayPause={(playing) => {
                             if (storylineMode === 'focus') return; 
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
                            isOrbitingRef.current = false;
                            
                            if (controlsRef.current && cameraRef.current) {
                                const currentPos = cameraRef.current.position.clone();
                                const target = controlsRef.current.target.clone();
                                const dist = currentPos.distanceTo(target);
                                
                                const endPos = target.clone().add(new THREE.Vector3(0, dist * 0.7, dist * 0.7)); 

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
                                    
                                    const { x: rdX, y: rdY } = wgs84ToRd(latitude, longitude);

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
