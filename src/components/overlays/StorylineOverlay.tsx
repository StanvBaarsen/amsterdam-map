import React from 'react';
import ReactMarkdown from 'react-markdown';
import './StorylineOverlay.css';

interface StorylineEvent {
    year: number;
    description: string;
    coordinate: { x: number, y: number };
    image: string;
}

interface StorylineOverlayProps {
    event: StorylineEvent;
    onNext: () => void;
    onSkip?: () => void;
}

export const StorylineOverlay: React.FC<StorylineOverlayProps> = ({ event, onNext, onSkip }) => {
    const [isExiting, setIsExiting] = React.useState(false);

    const handleNext = () => {
        setIsExiting(true);
    };

    const handleSkip = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSkip) onSkip();
    }

    const onAnimationEnd = () => {
        if (isExiting) {
            onNext();
        }
    };

    return (
        <div className="storyline-overlay">
            <div 
                className={`storyline-card ${isExiting ? 'exiting' : ''}`}
                onAnimationEnd={onAnimationEnd}
            >
               <button 
                    onClick={handleSkip}
                    className="storyline-skip-btn"
                    title="Geschiedenis overslaan"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <img src={event.image} alt={`Amsterdam ${event.year}`} className="storyline-image" />
                <div className="storyline-content">
                    <div className="storyline-description">
                        <ReactMarkdown>{event.description}</ReactMarkdown>
                    </div>
                </div>
                <div className="storyline-footer">
                    <button onClick={handleNext} className="storyline-next-btn">
                        Volgende
                    </button>
                </div>
            </div>
        </div>
    );
};
