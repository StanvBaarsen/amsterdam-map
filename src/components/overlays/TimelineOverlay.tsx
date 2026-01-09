import React from 'react';
import { MdPlayArrow, MdPause } from 'react-icons/md';
import './TimelineOverlay.css';

interface TimelineOverlayProps {
    minYear: number;
    maxYear: number;
    presentYear?: number;
    currentYear: number;
    onYearChange: (year: number) => void;
    isPlaying: boolean;
    onPlayPause: (playing: boolean) => void;
    isStorylineActive?: boolean;
    isStorylineComplete?: boolean;
    isTransitioning?: boolean;
}

export const TimelineOverlay: React.FC<TimelineOverlayProps> = ({
    minYear,
    maxYear,
    presentYear = new Date().getFullYear(),
    currentYear,
    onYearChange,
    isPlaying,
    onPlayPause,
    isStorylineActive = false,
    isStorylineComplete = false,
    isTransitioning = false
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleYearClick = () => {
        if (!isInteractive) return;
        if (isPlaying) {
            onPlayPause(false);
        }
        setIsEditing(true);
        setEditValue(Math.floor(currentYear).toString());
    };

    const handleYearSubmit = () => {
        setIsEditing(false);
        const newYear = parseInt(editValue);
        if (!isNaN(newYear)) {
            // Clamp value between min and max
            const clampedYear = Math.max(minYear, Math.min(newYear, maxYear));
            onYearChange(clampedYear);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleYearSubmit();
        }
    };

    // If storyline is active or if we are showing innovation, interactivity is removed
    // We also disable interaction while playing (auto-scrolling), as per user request
    const isInteractive = !isStorylineActive && !isTransitioning && !isPlaying;

    // Gap size matches distance to act as a buffer. 
    // We want the visual gap to be substantial.
    const GAP_SIZE = 50;
    const sliderMax = presentYear + GAP_SIZE;

    // Determine visual slider position from current year
    const getSliderValue = (year: number) => {
        if (year >= maxYear) return sliderMax;
        return Math.min(year, presentYear);
    };

    const [internalValue, setInternalValue] = React.useState(getSliderValue(currentYear));
    const [isDragging, setIsDragging] = React.useState(false);
    // Track if we are in a 'large jump' transition state to prevent slider jitter
    const [isJumping, setIsJumping] = React.useState(false);

    // Sync internal value when external props change (e.g. playback), but ONLY if not dragging
    React.useEffect(() => {
        if (!isDragging) {
            const newValue = getSliderValue(currentYear);
            
            // If we were jumping, and the value is now close to our internal value (or target),
            // or if the jump is "done" (assuming ThreeViewer tweens correctly), we sync.
            // But actually, we ALWAYS want to sync if not dragging, because that provides the animation.
            setInternalValue(newValue);
            
            // Simple heuristic: if we synced and the value matches, we aren't jumping anymore
            setIsJumping(false);
        }
    }, [currentYear, isDragging, maxYear, presentYear]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // NOTE: We do NOT use this standard onChange for user interactions anymore
        // because we handle pointer events directly to allow smooth clicking (preventing instant jump).
        // However, we leave it hooked up just in case, but we might want to ignore it if we're hijacking.
        
        // Actually, if we hijack PointerDown, focus usually shifts. 
        // We will implement logic in handlePointerDown/Move/Up instead.
    };

    // New custom interaction handler
    const sliderRef = React.useRef<HTMLInputElement>(null);

    const updateSliderFromPointer = (e: React.PointerEvent | PointerEvent, isClick: boolean) => {
        if (!sliderRef.current || !isInteractive) return;

        const rect = sliderRef.current.getBoundingClientRect();
        const clientX = e.clientX;
        
        // Calculate value based on position
        // Input range logic: 
        // 0 position is left + 9px (thumb radius)
        // 100% position is right - 9px
        // Effective width = rect.width - 18px
        
        const padding = 9;
        const effectiveWidth = rect.width - (padding * 2);
        const relativeX = Math.min(Math.max(clientX - rect.left - padding, 0), effectiveWidth);
        const ratio = relativeX / effectiveWidth;
        
        const rawValue = minYear + (ratio * (sliderMax - minYear));
        
        // Apply logic to snap to gap
        let newYear = rawValue;
        let snapVisual = rawValue;

        if (rawValue > presentYear) {
             const gapProgress = (rawValue - presentYear) / GAP_SIZE;
             if (gapProgress > 0.5) {
                 newYear = maxYear;
                 snapVisual = sliderMax;
             } else {
                 newYear = presentYear;
                 snapVisual = presentYear;
             }
        }

        // If clicking (not dragging), we trigger the change but DO NOT visually snap instantly.
        // We let the prop update drive the visual slider (smooth transition).
        if (isClick) {
            // "Jump" logic
            setIsJumping(true);
            // We do NOT setInternalValue here. We let the parent tween update the prop, 
            // and the useEffect will sync internalValue smoothly.
            if (newYear !== currentYear) {
                onYearChange(newYear);
            }
        } else {
            // Dragging - instant visual feedback
            setInternalValue(snapVisual);
            if (newYear !== currentYear) {
                onYearChange(newYear);
            }
        }

        if (isPlaying) onPlayPause(false);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isInteractive) return;
        
        // Prevent default to stop the native slider from jumping instantly
        e.preventDefault();
        
        setIsDragging(true);
        const startX = e.clientX;
        const startTime = Date.now();

        // Check if this turns into a drag or stays a click
        let hasMoved = false;

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (!hasMoved && Math.abs(moveEvent.clientX - startX) > 5) {
                hasMoved = true;
            }
            if (hasMoved) {
                updateSliderFromPointer(moveEvent, false);
            }
        };

        const onPointerUp = (upEvent: PointerEvent) => {
            setIsDragging(false);
            
            if (!hasMoved) {
                // It was a click
                updateSliderFromPointer(upEvent, true);
            } else {
                // Final sync for drag
                updateSliderFromPointer(upEvent, false);
            }

            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    // Calculate percentage for gradient stop
    // presentYear represents the end of the solid line
    // sliderMax represents the end of the total track
    
    // We want RED color for the years passed.
    // Gradient: 
    // Red from 0% to (current / total)%
    // Gray from (current / total)% to (present / total)% ??
    // User said: "timeline part that has passed should be red not gray"
    // Previously: CurrentColor (Red) -> ... -> Gray
    // Now: Red -> ... -> Gray
    
    // Innovation Mode / Future Blue
    const ACTIVE_BLUE = '#0099ff'; // Matching 'future' palette brightest
    const ACTIVE_RED = '#ff4444'; 
    
    const isAtEnd = internalValue >= sliderMax;

    const totalRange = sliderMax - minYear;
    const currentRatio = (Math.min(internalValue, presentYear) - minYear) / totalRange;
    const presentRatio = (presentYear - minYear) / totalRange;

    // Use calc to align gradient stops with the slider thumb (which has 9px offset due to width)
    const currentStop = `calc(9px + ${currentRatio} * (100% - 18px))`;
    const presentStop = `calc(9px + ${presentRatio} * (100% - 18px))`;

    return (
        <div className={`timeline-overlay ${isStorylineActive ? 'storyline-active' : ''}`}>
             {!isStorylineActive && (
                 <div className="timeline-play-button-container" style={{
                    width: isStorylineComplete ? '40px' : '0px',
                    opacity: isStorylineComplete ? 1 : 0,
                    pointerEvents: isStorylineComplete ? 'auto' : 'none'
                }}>
                    <button
                        onClick={(e) => {
                            e.currentTarget.blur();
                            setIsEditing(false);
                            onPlayPause(!isPlaying);
                        }}
                        className="timeline-play-button"
                        style={{
                            background: isAtEnd ? ACTIVE_BLUE : ACTIVE_RED,
                            transition: 'background 0.5s ease'
                        }}
                    >
                        {isPlaying ? <MdPause /> : <MdPlayArrow />}
                    </button>
                </div>
             )}

            <div className="timeline-content">
                <div className="timeline-labels">
                    <span>{minYear}</span>
                    {isEditing ? (
                         <input
                            ref={inputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleYearSubmit}
                            onKeyDown={handleKeyDown}
                            className="current-year-input"
                        />
                    ) : (
                        <span 
                            className="current-year" 
                            onClick={handleYearClick}
                            style={{ 
                                cursor: isInteractive ? 'pointer' : 'default',
                                fontSize: ((isTransitioning || isPlaying) && !isStorylineActive) ? '4rem' : undefined,
                                color: isAtEnd ? ACTIVE_BLUE : ACTIVE_RED,
                                transition: 'color 0.5s ease, font-size 0.3s ease'
                            }}
                            title={isInteractive ? "Click to edit year" : ""}
                        >
                            {Math.floor(currentYear)}
                        </span>
                    )}
                    <span>{maxYear}</span>
                </div>
                
                <div className={`range-container ${!isInteractive ? 'disabled' : ''}`}>
                    <input
                        type="range"
                        min={minYear}
                        max={sliderMax}
                        ref={sliderRef} // Attached ref for pointer calc
                        value={internalValue}
                        onChange={handleSliderChange}
                        onPointerDown={handlePointerDown}
                        // Remove onPointerUp as it is handled in the listener logic
                        // Remove touch events as Pointer Events cover them
                        disabled={!isInteractive} // Hard disable input
                        className="timeline-slider"
                        style={{
                            cursor: isInteractive ? 'pointer' : 'default',
                            pointerEvents: !isInteractive ? 'none' : 'auto',
                            opacity: isInteractive ? 1 : 0.7,
                            background: `linear-gradient(to right, 
                                ${isAtEnd ? ACTIVE_BLUE : ACTIVE_RED} 0%, 
                                ${isAtEnd ? ACTIVE_BLUE : ACTIVE_RED} ${currentStop}, 
                                #ddd ${currentStop}, 
                                #ddd ${presentStop},
                                ${isAtEnd ? 'rgba(255, 68, 68, 0.15)' : 'transparent'} ${presentStop},
                                ${isAtEnd ? 'rgba(0, 153, 255, 0.15)' : 'transparent'} 100%
                            )`,
                            transition: 'background 0.5s ease'
                        }}
                    />
                    {/* Visual Dotted Line for the Gap */}
                    <div 
                        className="timeline-gap"
                        style={{
                            // Align with slider thumb center which travels from 9px to (width-9px)
                            left: `calc(9px + ${(presentYear - minYear) / (sliderMax - minYear)} * (100% - 18px))`,
                            width: `calc(${(sliderMax - presentYear) / (sliderMax - minYear)} * (100% - 18px))`
                        }}
                    />
                    {/* 2030 Marker Dot */}
                    <div
                        className="timeline-gap-dot"
                        style={{
                            left: 'calc(100% - 9px)',
                            opacity: internalValue >= sliderMax ? 1 : 0.5,
                            backgroundColor: isAtEnd ? ACTIVE_BLUE : ACTIVE_RED,
                            transition: 'background-color 0.5s ease, opacity 0.2s ease'
                        }}
                     />
                    {/* Inject custom styles for thumb color transition */}
                    <style>{`
                        .timeline-slider::-webkit-slider-thumb {
                            background: ${isAtEnd ? ACTIVE_BLUE : ACTIVE_RED} !important;
                            transition: background 0.5s ease;
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
};
