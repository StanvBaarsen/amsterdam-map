import React from 'react';
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
    return (
        <div className={`timeline-overlay ${isStorylineActive ? 'storyline-active' : ''}`}>
            <div className="timeline-play-button-container" style={{
                width: isStorylineComplete ? '40px' : '0px',
                opacity: isStorylineComplete ? 1 : 0
            }}>
                <button
                    onClick={() => onPlayPause(!isPlaying)}
                    className="timeline-play-button"
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>
            </div>

            <div className="timeline-content">
                <div className="timeline-labels">
                    <span>{minYear}</span>
                    <span className="current-year">{Math.floor(currentYear)}</span>
                    <span>{maxYear}</span>
                </div>
                <input
                    type="range"
                    min={minYear}
                    max={maxYear}
                    value={currentYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
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
