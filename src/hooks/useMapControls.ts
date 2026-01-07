import { useEffect } from 'react';

interface UseMapControlsProps {
    controlsRef: React.RefObject<any>;
    tilesRef: React.RefObject<any>;
    cameraRef: React.RefObject<any>;
    needsRerender: React.MutableRefObject<number>;
    tilesCentered: React.MutableRefObject<boolean>;
    isPlaying: boolean;
    isStorylineComplete: boolean;
    skipStoryline: boolean;
    setUserHasPanned: (v: boolean) => void;
    setUserHasRotated: (v: boolean) => void;
}

export const useMapControls = ({
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
}: UseMapControlsProps) => {

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
    }, [controlsRef.current, setUserHasPanned, setUserHasRotated]);

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
};
