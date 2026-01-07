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
    isStorylineComplete = false
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
        if (isStorylineActive) return;
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

    // Gap size matches distance to act as a buffer. 
    // We want the visual gap to be substantial.
    const GAP_SIZE = 50;
    const sliderMax = presentYear + GAP_SIZE;

    // Determine visual slider position from current year
    const getSliderValue = (year: number) => {
        if (year >= maxYear) return sliderMax;
        // If year is "2026" (present), it is at 2026.
        return Math.min(year, presentYear);
    };

    const [internalValue, setInternalValue] = React.useState(getSliderValue(currentYear));
    const [isDragging, setIsDragging] = React.useState(false);

    // Sync internal value when external props change (e.g. playback), but ONLY if not dragging
    React.useEffect(() => {
        if (!isDragging) {
            setInternalValue(getSliderValue(currentYear));
        }
    }, [currentYear, isDragging, maxYear, presentYear]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        
        // Logical Snapping
        let newYear = val;
        let snapVisual = val;

        if (val > presentYear) {
             // In the gap
             const gapProgress = (val - presentYear) / GAP_SIZE;
             
             // Hysteresis/Latch logic:
             // If we are closer to finish (2030), snap year AND visual to 2030 (maxYear/sliderMax)
             // If we are closer to start (2026), snap year AND visual to 2026 (presentYear)
             
             if (gapProgress > 0.5) {
                 newYear = maxYear;
                 snapVisual = sliderMax;
             } else {
                 newYear = presentYear;
                 snapVisual = presentYear;
             }
        }

        // Apply visual snap immediately so slider doesn't "float" in the gap
        setInternalValue(snapVisual);
        
        // Notify parent only if year changed
        if (newYear !== currentYear) {
            onYearChange(newYear);
        }
        
        if (isPlaying) onPlayPause(false);
    };

    const handlePointerDown = () => setIsDragging(true);
    const handlePointerUp = () => {
        setIsDragging(false);
        // Force final sync
        setInternalValue(getSliderValue(currentYear));
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
    
    const totalRange = sliderMax - minYear;
    const currentPercent = ((Math.min(internalValue, presentYear) - minYear) / totalRange) * 100;
    const presentPercent = ((presentYear - minYear) / totalRange) * 100;

    return (
        <div className={`timeline-overlay ${isStorylineActive ? 'storyline-active' : ''}`}>
             {!isStorylineActive && (
                 <div className="timeline-play-button-container" style={{
                    width: isStorylineComplete ? '40px' : '0px',
                    opacity: isStorylineComplete ? 1 : 0
                }}>
                    <button
                        onClick={(e) => {
                            e.currentTarget.blur();
                            setIsEditing(false);
                            onPlayPause(!isPlaying);
                        }}
                        className="timeline-play-button"
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
                            style={{ cursor: isStorylineActive ? 'default' : 'pointer' }}
                            title={isStorylineActive ? "" : "Click to edit year"}
                        >
                            {Math.floor(currentYear)}
                        </span>
                    )}
                    <span>{maxYear}</span>
                </div>
                
                <div className="range-container">
                    <input
                        type="range"
                        min={minYear}
                        max={sliderMax}
                        value={internalValue}
                        onChange={handleSliderChange}
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                        disabled={!isStorylineComplete}
                        className="timeline-slider"
                        style={{
                            cursor: isStorylineComplete ? 'pointer' : 'default',
                            opacity: isStorylineComplete ? 1 : 0.7,
                            background: `linear-gradient(to right, 
                                #ff4444 0%, 
                                #ff4444 ${currentPercent}%, 
                                #ddd ${currentPercent}%, 
                                #ddd ${presentPercent}%,
                                transparent ${presentPercent}%
                            )`
                        }}
                    />
                    {/* Visual Dotted Line for the Gap */}
                    <div 
                        className="timeline-gap"
                        style={{
                            left: `${(presentYear - minYear) / (sliderMax - minYear) * 100}%`,
                            width: `${(sliderMax - presentYear) / (sliderMax - minYear) * 100}%`
                        }}
                    />
                    {/* 2030 Marker Dot */}
                    <div
                        className="timeline-gap-dot"
                        style={{
                            left: '100%',
                            opacity: internalValue >= sliderMax ? 1 : 0.5
                        }}
                     />
                </div>
            </div>
        </div>
    );
};
