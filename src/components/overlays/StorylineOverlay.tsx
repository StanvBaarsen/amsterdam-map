import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MdClose } from 'react-icons/md';
import './StorylineOverlay.css';

interface StorylineEvent {
    year: number;
    description: string;
    coordinate: { x: number, y: number } | { lat: number, lng: number };
    image: string;
    cameraAngle?: number;
    cameraDistance?: number;
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
    nextProjectName?: string;
    isStorylineComplete?: boolean;
    onStartInnovation?: () => void;
}

export const StorylineOverlay: React.FC<StorylineOverlayProps> = ({ 
    event, 
    onNext, 
    onPrev, 
    onSkip, 
    // onJump,
    onStartInnovation,
    variant = 'default',
    currentIndex = 0,
    totalEvents = 1,
    // nextProjectName,
    isStorylineComplete = false,
    // allEvents = []
}) => {
    const [isExiting, setIsExiting] = React.useState(false);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsExiting(false);
        // Reset scroll position when event changes
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [event]);

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
    
    // const handleChapterClick = (index: number) => {
    //     if (onJump && index !== currentIndex) {
    //         onJump(index);
    //     }
    // }

    const onAnimationEnd = () => {
        if (isExiting) {
            onNext();
        }
    };

    const skipButtonText = isStorylineComplete ? "Geschiedenis afsluiten" : "Geschiedenis overslaan";

    const isEndingText = (event as any).ending_text;

    return (
        <div className="storyline-overlay">
            <div 
                className={`storyline-card ${isExiting ? 'exiting' : ''}`}
                onAnimationEnd={onAnimationEnd}
            >
                <div className="storyline-scroll-container" ref={scrollContainerRef}>
                    <div style={{ position: 'relative' }}>
                        <img src={event.image} alt={`Amsterdam ${event.year}`} className="storyline-image" />
                        <button 
                            onClick={handleSkip}
                            className={`storyline-skip-btn ${variant === 'innovation' ? 'icon-only' : ''}`}
                            title={variant === 'innovation' ? "Sluiten" : skipButtonText}
                        >
                            {variant === 'innovation' ? <MdClose /> : <>{skipButtonText} »</>}
                        </button>
                    </div>
                    <div className="storyline-content">
                        <div className="storyline-description">
                            <ReactMarkdown>{event.description}</ReactMarkdown>
                        </div>
                    </div>
                </div>

                <div className="storyline-footer">
                    {currentIndex > 0 && !isEndingText && (
                        <button onClick={handlePrev} className="storyline-prev-btn">
                            Vorige
                        </button>
                    )}
                    
                    {/* Different button if we are about to enter innovation loop */}
                    <button 
                        onClick={() => {
                            if (isEndingText) {
                                // If ending, just close/skip
                                onSkip ? onSkip() : onNext();
                            } else if ((event as any).startInnovation) {
                                (onStartInnovation) ? onStartInnovation() : onNext();
                            } else {
                                handleNext();
                            }
                        }} 
                        className="storyline-next-btn"
                    >
                        {isEndingText 
                            ? "Afsluiten" 
                            : (currentIndex === totalEvents - 1 
                                ? (variant === 'innovation' ? 'Naar het slot' : 'Bekijk innovatieprojecten in Amsterdam in 2030')
                                : (variant === 'innovation' ? 'Bekijk volgend project' : 'Volgende')
                              )
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

