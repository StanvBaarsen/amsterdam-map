import { useEffect, useRef } from 'react';
import storylinesDataRaw from '../assets/storylines.json';
import TWEEN from '@tweenjs/tween.js';

// Parse "current" year
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storylinesData = storylinesDataRaw.map((s: any) => ({
    ...s,
    year: (s.year === "current") ? new Date().getFullYear() : s.year
}));

interface UseStorylineLogicProps {
    isPlaying: boolean;
    storylineIndex: number;
    skipStoryline: boolean;
    isStorylineComplete: boolean;
    currentYear: number;
    setCurrentYear: React.Dispatch<React.SetStateAction<number>>;
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setStorylineMode: React.Dispatch<React.SetStateAction<'overview' | 'focus'>>;
    setStorylineIndex: React.Dispatch<React.SetStateAction<number>>;
    setIsStorylineComplete: React.Dispatch<React.SetStateAction<boolean>>;
    animateCameraToStoryline: (coordinate: { x: number, y: number } | { lat: number, lng: number }, onComplete?: () => void, cameraAngle?: number, cameraDistance?: number) => void;
    zoomOutToMax: () => void;
    isTransitioning: boolean;
}

export const useStorylineLogic = ({
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
    zoomOutToMax,
    isTransitioning
}: UseStorylineLogicProps) => {

    const hasZoomedOutRef = useRef(false);
    const isRewindingRef = useRef(false);
    const isOrbitingRef = useRef(false);

    // Reset zoom out flag when restarting storyline (index 0) OR if we are in a chapter before 1850
    useEffect(() => {
        if (storylineIndex === 0 || (storylinesData[storylineIndex] && storylinesData[storylineIndex].year < 1850)) {
            hasZoomedOutRef.current = false;
        }
    }, [storylineIndex]);

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

                    // Trigger zoom out at 1850 directly in the loop to avoid timing issues
                    if (prev < 1850 && next >= 1850 && !hasZoomedOutRef.current) {
                        hasZoomedOutRef.current = true;
                        isOrbitingRef.current = false;
                        zoomOutToMax();
                    }

                    if (nextEvent && next >= nextEvent.year) {
                        setIsPlaying(false);
                        animateCameraToStoryline(
                            nextEvent.coordinate, 
                            () => {
                                setStorylineMode('focus');
                            },
                            nextEvent.cameraAngle,
                            nextEvent.cameraDistance
                        );
                        isOrbitingRef.current = true;
                        return nextEvent.year;
                    }

                    if (next >= new Date().getFullYear()) {
                        setIsPlaying(false);
                        setIsStorylineComplete(true);
                        return new Date().getFullYear();
                    }
                    return next;
                });
            }, 50);
        }
        return () => clearInterval(interval);
    }, [isPlaying, storylineIndex, skipStoryline, animateCameraToStoryline, zoomOutToMax]);

    // Independent zoom out check (Removed as it is now handled in the loop for better sync)
    // Kept ONLY as a fallback for non-playback scenarios if needed, but for now removing to prevent double triggers
    // or race conditions.

    const handleNextStoryline = () => {
        isOrbitingRef.current = false;
        
        // Ensure we stop at the next chapter, not skip ahead
        const nextIdx = storylineIndex + 1;
        
        // If next chapter exists
        if (storylinesData[nextIdx]) {
            setStorylineMode('overview'); // Temporarily hide overlay to show map transition
            
            // Smoothly animate year
            const nextEvent = storylinesData[nextIdx];
            const yearObj = { year: currentYear };
            new TWEEN.Tween(yearObj)
                .to({ year: nextEvent.year }, 2000) // 2s duration matches camera move approx
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    setCurrentYear(Math.round(yearObj.year));
                })
                .start();

            setTimeout(() => {
                 setStorylineIndex(nextIdx); // This will update state
                 
                 animateCameraToStoryline(
                    nextEvent.coordinate, 
                    () => {
                        // Pause briefly
                        setTimeout(() => {
                            setStorylineMode('focus');
                            setIsPlaying(true); 
                        }, 500);
                    },
                    nextEvent.cameraAngle,
                    nextEvent.cameraDistance
                 );
                 
            }, 500);
        } else {
             // End of story
             setStorylineIndex(storylinesData.length - 1); // Keep it at last
             setStorylineMode('focus'); 
        }
    };

    return {
        handleNextStoryline,
        hasZoomedOutRef,
        isRewindingRef,
        isOrbitingRef
    };
};
