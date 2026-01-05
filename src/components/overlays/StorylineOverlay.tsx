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
}

export const StorylineOverlay: React.FC<StorylineOverlayProps> = ({ event, onNext }) => {
    const [isExiting, setIsExiting] = React.useState(false);

    const handleNext = () => {
        setIsExiting(true);
    };

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
                <img src={event.image} alt={`Amsterdam ${event.year}`} className="storyline-image" />
                <div className="storyline-content">
                    <div className="storyline-description">
                        <ReactMarkdown>{event.description}</ReactMarkdown>
                    </div>
                    <button onClick={handleNext} className="storyline-next-btn">
                        Volgende
                    </button>
                </div>
            </div>
        </div>
    );
};
