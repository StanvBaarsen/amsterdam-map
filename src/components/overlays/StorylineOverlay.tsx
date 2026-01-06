import React from 'react';
import ReactMarkdown from 'react-markdown';
import { MdClose } from 'react-icons/md';
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
    onPrev?: () => void;
    onSkip?: () => void;
    onJump?: (index: number) => void;
    variant?: 'default' | 'innovation';
    currentIndex?: number;
    totalEvents?: number;
    allEvents?: StorylineEvent[];
}

export const StorylineOverlay: React.FC<StorylineOverlayProps> = ({ 
    event, 
    onNext, 
    onPrev, 
    onSkip, 
    onJump,
    variant = 'default',
    currentIndex = 0,
    totalEvents = 1,
    allEvents = []
}) => {
    const [isExiting, setIsExiting] = React.useState(false);

    const handleNext = () => {
        setIsExiting(true);
    };

    const handlePrev = () => {
        if (onPrev) onPrev();
    }

    const handleSkip = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSkip) onSkip();
    }
    
    const handleChapterClick = (index: number) => {
        if (onJump && index !== currentIndex) {
            onJump(index);
        }
    }

    const onAnimationEnd = () => {
        if (isExiting) {
            onNext();
        }
    };

    return (
        <div className="storyline-overlay">
            {/* Sidebar with Chapter Progress */}
            {variant === 'default' && (
                <div className="storyline-sidebar">
                    {allEvents.map((evt, idx) => (
                        <div 
                            key={idx}
                            className={`storyline-chapter-dot ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'completed' : ''}`}
                            onClick={() => handleChapterClick(idx)}
                            title={`Ga naar ${evt.year}`}
                        >
                            <span className="chapter-tooltip">{evt.year}</span>
                        </div>
                    ))}
                </div>
            )}

            <div 
                className={`storyline-card ${isExiting ? 'exiting' : ''}`}
                onAnimationEnd={onAnimationEnd}
            >
               <button 
                    onClick={handleSkip}
                    className={`storyline-skip-btn ${variant === 'innovation' ? 'icon-only' : ''}`}
                    title={variant === 'innovation' ? "Sluiten" : "Geschiedenis overslaan"}
                >
                    {variant === 'innovation' ? <MdClose /> : 'geschiedenis overslaan »'}
                </button>
                <img src={event.image} alt={`Amsterdam ${event.year}`} className="storyline-image" />
                <div className="storyline-content">
                    <div className="storyline-description">
                        <ReactMarkdown>{event.description}</ReactMarkdown>
                    </div>
                </div>
                <div className="storyline-footer">
                    {currentIndex > 0 && (
                        <button onClick={handlePrev} className="storyline-prev-btn">
                            Vorige
                        </button>
                    )}
                    <button onClick={handleNext} className="storyline-next-btn">
                        {currentIndex === totalEvents - 1 ? 'Bekijk Amsterdam in 2030' : 'Volgende'}
                    </button>
                </div>
            </div>
        </div>
    );
};
