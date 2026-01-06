import React from 'react';
import { MdPlayArrow, MdPause } from 'react-icons/md';
import './TimelineOverlay.css';

interface TimelineOverlayProps {
    minYear: number;
    maxYear: number;
    currentYear: number;
    onYearChange: React.Dispatch<React.SetStateAction<number>>;
    isPlaying: boolean;
    onPlayPause: (playing: boolean) => void;
    isStorylineActive?: boolean;
    isStorylineComplete?: boolean;
}

export const TimelineOverlay: React.FC<TimelineOverlayProps> = ({
    minYear,
    maxYear,
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

    return (
        <div className={`timeline-overlay ${isStorylineActive ? 'storyline-active' : ''}`}>
            <div className="timeline-play-button-container" style={{
                width: isStorylineComplete ? '40px' : '0px',
                opacity: isStorylineComplete ? 1 : 0
            }}>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        onPlayPause(!isPlaying);
                    }}
                    className="timeline-play-button"
                >
                    {isPlaying ? <MdPause /> : <MdPlayArrow />}
                </button>
            </div>

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
                <input
                    type="range"
                    min={minYear}
                    max={maxYear}
                    value={currentYear}
                    onChange={(e) => {
                        onYearChange(Number(e.target.value));
                        if (isPlaying) onPlayPause(false);
                    }}
                    disabled={!isStorylineComplete}
                    className="timeline-slider"
                    style={{
                        cursor: isStorylineComplete ? 'pointer' : 'default',
                        opacity: isStorylineComplete ? 1 : 0.7
                    }}
                />
            </div>
        </div>
    );
};
