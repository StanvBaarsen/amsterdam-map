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

    const isFuture = currentYear > presentYear;

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
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <input
                        type="range"
                        min={minYear}
                        max={presentYear}
                        value={Math.min(currentYear, presentYear)}
                        onChange={(e) => {
                            onYearChange(Number(e.target.value));
                            if (isPlaying) onPlayPause(false);
                        }}
                        disabled={!isStorylineComplete}
                        className="timeline-slider"
                        style={{
                            cursor: isStorylineComplete ? 'pointer' : 'default',
                            opacity: isStorylineComplete ? 1 : 0.7,
                            flex: 1
                        }}
                    />
                    
                    {/* Future / 2030 Separator */}
                    {maxYear > presentYear && (
                         <div 
                            onClick={() => {
                                if (isStorylineComplete) {
                                    onYearChange(maxYear);
                                    if (isPlaying) onPlayPause(false);
                                }
                            }}
                            style={{ 
                                width: '16px', 
                                height: '16px', 
                                borderRadius: '50%', 
                                background: isFuture ? '#ff4444' : '#ddd', 
                                border: '2px solid white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                cursor: isStorylineComplete ? 'pointer' : 'default',
                                transition: 'all 0.3s ease',
                                flexShrink: 0
                            }}
                            title={`Innovatieprojecten in ${maxYear}`}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
