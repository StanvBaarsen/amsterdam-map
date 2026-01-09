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
    zoomOutToMax: (distance?: number) => void;
    // isTransitioning: boolean; // Removed unused prop requirement
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
    zoomOutToMax
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
                        
                        // Condition: if we are heading to a date past 1850, use 5000 distance
                        // Wait, this IS the trigger at 1850. 
                        // The user said: "if the target-date is past 1850, please make the cam distance like 5000"
                        // I assume this means the intermediate zoom out should be closer (5000) instead of default (6000)
                        // because modern Amsterdam is bigger? Or smaller? 
                        // Actually, if we are crossing 1850, we are definitely passing 1850.
                        zoomOutToMax(5000);
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
            // Check if this new chapter is the ending text. If so, we DON'T show it yet.
            // Instead, we trigger the innovation flow.
            // The ending text should only be shown AFTER innovation projects.
            if (storylinesData[nextIdx].ending_text) {
                 // Trigger innovation flow here (handled in parent or via callback)
                 // But wait, the parent `handleNextStoryline` just calls this. 
                 // We need to signal that we are entering innovation mode.
                 
                 // Since `useStorylineLogic` is somewhat generic, let's keep it simple:
                 // We WON'T auto-advance to ending_text. We'll stop at the chapter bEFORE it.
                 // The "Innovation" button in the UI will trigger the innovation flow.
                 // Then, after innovations, we'll manually jump to ending_text.
                 
                 // So: if nextIdx points to ending_text, DO NOTHING (or just set mode to focus on current to be safe)
                 return; 
            }

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
