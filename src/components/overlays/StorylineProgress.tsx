import React, { useMemo, useState } from 'react';
import { MdArrowForward, MdClose } from 'react-icons/md';
import './StorylineProgress.css';

interface StorylineProgressProps {
    chapters: { year: number; description: string; ending_text?: boolean; }[];
    activeIndex: number;
    currentYear?: number;
    mode: 'overview' | 'focus';
    isProjectCompleted?: boolean;
    onJump: (index: number) => void;
    onSkipToFuture: () => void;
    onStartStoryline?: () => void;
}

export const StorylineProgress: React.FC<StorylineProgressProps> = ({
    chapters,
    activeIndex,
    currentYear,
    mode,
    isProjectCompleted,
    onJump,
    onSkipToFuture,
    onStartStoryline
}) => {
    
    const [isExpanded, setIsExpanded] = useState(false);

    const getTitle = (desc: string) => {
        // Extract title from markdown-like description
        const firstLine = desc.split('\n')[0].replace(/^#+\s*/, '');
        return firstLine;
    };

    // Calculate progress line height
    const progressHeight = useMemo(() => {
        // If we have currentYear (and in focus mode), interpolate smoothly
        if (currentYear && mode === 'focus') {
            // Find which chapter span we are in
            let prevChapterIndex = -1;
            for (let i = 0; i < chapters.length; i++) {
                if (chapters[i].year <= currentYear) {
                    prevChapterIndex = i;
                } else {
                    break;
                }
            }

            if (prevChapterIndex === -1) return '0%';
            
            let percentage = 0;
            const totalVisualSteps = mode === 'focus' ? chapters.length : Math.max(1, chapters.length - 1);

            if (prevChapterIndex >= chapters.length - 1) {
                // At or past last chapter
                percentage = (prevChapterIndex / totalVisualSteps) * 100;
            } else {
                // Interpolate between chapters
                const prevYear = chapters[prevChapterIndex].year;
                const nextYear = chapters[prevChapterIndex + 1].year;
                
                if (nextYear === prevYear) {
                     percentage = (prevChapterIndex / totalVisualSteps) * 100;
                } else {
                    const fraction = (currentYear - prevYear) / (nextYear - prevYear);
                    const validFraction = Math.max(0, Math.min(1, fraction));
                    percentage = ((prevChapterIndex + validFraction) / totalVisualSteps) * 100;
                }
            }
            return `${Math.min(100, Math.max(0, percentage))}%`;
        }
if (isProjectCompleted) return '100%';
        
        // Fallback to activeIndex
        const totalVisualStepsFallback = mode === 'focus' ? chapters.length : Math.max(1, chapters.length - 1);
        if (activeIndex < 0) return '0%';
        if (activeIndex >= chapters.length - 1 && mode !== 'focus') return '100%';
        
        return `${(activeIndex / totalVisualStepsFallback) * 100}%`;
    }, [activeIndex, chapters, currentYear, mode]);

    return (
        <div className={`storyline-progress-container ${mode}`}>
            <div 
                className={`storyline-progress-pill ${isExpanded ? 'expanded' : ''}`}
                onMouseEnter={() => setIsExpanded(true)}
                onMouseLeave={() => setIsExpanded(false)}
                onClick={() => setIsExpanded(true)}
            >
                 <button 
                    className="storyline-close-mobile"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                    }}
                >
                    <MdClose />
                </button>

                {mode === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                         <button 
                            className="storyline-start-btn-inline"
                            onClick={() => onStartStoryline && onStartStoryline()}
                        >
                            ▶ Innovatie-geschiedenis van Amsterdam bekijken
                        </button>
                        <button 
                            className="storyline-start-btn-inline secondary"
                            onClick={onSkipToFuture}
                        >
                            Direct naar innovatieprojecten in 2030 »
                        </button>
                    </div>
                )}

                <div className="storyline-dots-list">
                    <div className="storyline-line-track">
                        <div className="dots-line-bg" />
                        <div className="dots-line-progress" style={{ height: progressHeight }} />
                    </div>
                    {chapters.map((chapter, index) => {
                        if (chapter.ending_text) return null;
                        const isPast = isProjectCompleted || index < activeIndex || (currentYear && currentYear >= new Date().getFullYear());
                        const isActive = !isProjectCompleted && mode === 'focus' && index === activeIndex;
                        
                        return (
                            <div 
                                key={index} 
                                className={`storyline-dot-row ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                                onClick={(e) => {
                                    if (!isExpanded) return; // Prevent jump if not expanded (mobile tap to open)
                                    e.stopPropagation(); // Avoid re-triggering parent click? Actually parent click just sets expanded true, so it's fine.
                                    // But better to be explicit.
                                    onJump(index);
                                }}
                            >
                                <div className={`storyline-dot ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''}`} />
                                <span className="storyline-chapter-title">
                                    {chapter.year}: {getTitle(chapter.description)}
                                </span>
                            </div>
                        );
                    })}
                </div>
                
                {mode === 'focus' && (
                     <div 
                        className="storyline-dot-row future-row"
                        onClick={(e) => {
                            if (!isExpanded) return;
                            onSkipToFuture();
                        }}
                     >
                        <div className="storyline-dot future-dot">
                            <MdArrowForward className="future-icon" />
                        </div>
                        <span className="storyline-chapter-title future-label">
                            Innovatieprojecten in 2030 laten zien »
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
