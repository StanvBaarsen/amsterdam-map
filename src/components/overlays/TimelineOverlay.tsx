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

    // removed unused isFuture

    // Local state for smooth slider dragging (optimization)
    const [localSliderValue, setLocalSliderValue] = React.useState(currentYear);
    
    React.useEffect(() => {
        setLocalSliderValue(currentYear);
    }, [currentYear]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setLocalSliderValue(val);
        
        // "Magnetic" logic: 
        // If we drag past presentYear, snap to maxYear (2030)
        // detailed logic: "secretly continue to 2027" -> means short drag distance
        // We set input max to presentYear + 3 (approx 2028). 
        // If val > presentYear, we treat it as 2030.
        
        if (val > presentYear) {
            onYearChange(maxYear);
        } else {
            onYearChange(val);
        }

        if (isPlaying) onPlayPause(false);
    };

    // Calculate max value for the slider input: present + small buffer to simulate the 'gap'
    const sliderMax = presentYear + 2; 

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
                        value={currentYear > presentYear ? sliderMax : localSliderValue}
                        onChange={handleSliderChange}
                        disabled={!isStorylineComplete}
                        className="timeline-slider"
                        style={{
                            cursor: isStorylineComplete ? 'pointer' : 'default',
                            opacity: isStorylineComplete ? 1 : 0.7,
                            background: `linear-gradient(to right, 
                                currentColor 0%, 
                                currentColor ${(Math.min(localSliderValue, presentYear) - minYear) / (sliderMax - minYear) * 100}%, 
                                #ddd ${(Math.min(localSliderValue, presentYear) - minYear) / (sliderMax - minYear) * 100}%, 
                                #ddd ${(presentYear - minYear) / (sliderMax - minYear) * 100}%,
                                transparent ${(presentYear - minYear) / (sliderMax - minYear) * 100}%
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
                </div>
            </div>
        </div>
    );
};
