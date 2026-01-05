import React, { useRef } from 'react';

interface TimelineOverlayProps {
    minYear: number;
    maxYear: number;
    currentYear: number;
    onYearChange: React.Dispatch<React.SetStateAction<number>>;
    isPlaying: boolean;
    onPlayPause: (playing: boolean) => void;
}

export const TimelineOverlay: React.FC<TimelineOverlayProps> = ({
    minYear,
    maxYear,
    currentYear,
    onYearChange,
    isPlaying,
    onPlayPause
}) => {
    const requestRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | null>(null);
    
    // Animation loop for smooth playback
    const animate = (time: number) => {
        if (lastTimeRef.current !== null) {
            const deltaTime = time - lastTimeRef.current;
            // Speed: 10 years per second?
            // Adjust speed as needed
            const yearsPerSecond = 20; 
            const deltaYears = (deltaTime / 1000) * yearsPerSecond;
            
            let nextYear = currentYear + deltaYears;
            if (nextYear > maxYear) {
                nextYear = minYear; // Loop or stop? Let's loop for now or stop.
                // onPlayPause(false); // Stop at end
                // nextYear = maxYear;
            }
            
            // We need to call onYearChange, but we can't rely on 'currentYear' prop being updated instantly in this loop closure if we used it directly without ref or dependency.
            // Actually, since we re-render on prop change, we might just use useEffect for the interval.
            // But requestAnimationFrame is smoother.
            // Let's use a simple interval in useEffect for simplicity and React state updates.
        }
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(animate);
    };

    // Using a simpler interval approach for the "Play" functionality to avoid complex state/ref sync issues in this simple component
    /* 
       Logic moved to ThreeViewer to handle complex rewind/camera animations.
       This component is now purely UI.
    */
    /*
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying) {
            interval = setInterval(() => {
                onYearChange(prev => {
                    const next = prev + 5; // 5 years per tick (approx 60fps -> too fast, 100ms interval -> 50 years/sec)
                    // Let's do 100ms interval.
                    if (next >= maxYear) {
                        onPlayPause(false);
                        return maxYear;
                    }
                    return next;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, maxYear, minYear, onYearChange, onPlayPause]);
    */

    return (
        <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            maxWidth: '600px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '15px 25px',
            borderRadius: '30px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            zIndex: 100,
            backdropFilter: 'blur(10px)',
            opacity: 0,
            animation: 'fadeInSlideUp 1s ease-out 800ms forwards'
        }}>
            <button
                onClick={() => onPlayPause(!isPlaying)}
                style={{
                    background: '#ff4444',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '16px',
                    transition: 'background 0.2s'
                }}
            >
                {isPlaying ? '⏸' : '▶'}
            </button>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', fontWeight: 500 }}>
                    <span>{minYear}</span>
                    <span style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '16px' }}>{Math.floor(currentYear)}</span>
                    <span>{maxYear}</span>
                </div>
                <input
                    type="range"
                    min={minYear}
                    max={maxYear}
                    value={currentYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    style={{
                        width: '100%',
                        cursor: 'pointer',
                        accentColor: '#ff4444'
                    }}
                />
            </div>
        </div>
    );
};
