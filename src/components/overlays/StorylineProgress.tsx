import React, { useMemo } from 'react';
import { MdArrowForward } from 'react-icons/md';
import './StorylineProgress.css';

interface StorylineProgressProps {
    chapters: { year: number; description: string; }[];
    activeIndex: number;
    currentYear?: number;
    mode: 'overview' | 'focus';
    onJump: (index: number) => void;
    onSkipToFuture: () => void;
    onStartStoryline?: () => void;
}

export const StorylineProgress: React.FC<StorylineProgressProps> = ({
    chapters,
    activeIndex,
    currentYear,
    mode,
    onJump,
    onSkipToFuture,
    onStartStoryline
}) => {
    
    const getTitle = (desc: string) => {
        // Extract title from markdown-like description
        const firstLine = desc.split('\n')[0].replace(/^#+\s*/, '');
        return firstLine.length > 25 ? firstLine.substring(0, 25) + '...' : firstLine;
    };

    // Calculate progress line height
    const progressHeight = useMemo(() => {
        // If we have currentYear, interpolate smoothly
        if (currentYear) {
            // Find which chapter span we are in
            // chapters should be sorted by year
            let prevChapterIndex = -1;
            for (let i = 0; i < chapters.length; i++) {
                if (chapters[i].year <= currentYear) {
                    prevChapterIndex = i;
                } else {
                    break;
                }
            }

            if (prevChapterIndex === -1) return '0%';
            if (prevChapterIndex >= chapters.length - 1) return '100%';

            const prevYear = chapters[prevChapterIndex].year;
            const nextYear = chapters[prevChapterIndex + 1].year;
            
            // Avoid division by zero
            if (nextYear === prevYear) {
                 return `${(prevChapterIndex / (chapters.length - 1)) * 100}%`;
            }

            const fraction = (currentYear - prevYear) / (nextYear - prevYear);
            // Cap fraction for valid range
            const validFraction = Math.max(0, Math.min(1, fraction));
            
            // Total progress
            // Each chapter step is 1 / (chapters.length - 1) roughly? 
            // Actually the dots are evenly spaced in CSS flex layout (gap 12px) ? 
            // Wait, we used gap in CSS so they are spaced evenly visually, not by year.
            // So we just need to interpolate between index i and i+1 visually.
            
            // Total height available is roughly implicitly defined by the container.
            // But we use percentage height for the line.
            // The line spans from first dot to last dot?
            // Actually lines 60-65 in StorylineProgress.css say:
            // "height: calc(100% - 20px)" inside "storyline-dots-list" which houses the items.
            // So 100% corresponds to full list height.
            // But 100% height line would cover all dots.
            // We want line to stop at current progress.
            
            // Visual interpolation (linear between dots):
            // (index + fraction) / (totalItems - 1) * 100%
            // const visualProgress = (prevChapterIndex + validFraction) / (chapters.length);
            
            // Wait, if we use totalItems - 1 as denominator, then at last item we get 100%.
            // But if we use chapters.length as denominator it won't reach bottom.
            // Let's stick to chapters.length as a base since CSS logic is loose.
            // Or better: use chapters.length - 1 if we assume line ends at last dot?
            // But we have "Projecten in 2030" as an extra item at the bottom?
            // "projecten in 2030" is separate? "storyline-dot-row future-row".
            // That is inside "storyline-dots-list" in StorylineProgress.tsx structure? 
            // No, look at TSX render:
            //      <div className="storyline-dots-list"> ... {chapters.map} ... </div>
            //      {mode === 'focus' && ( <div ... future-row ... /> )}
            // So the dots list ONLY contains chapters.
            
            // So 100% of dots list height is bottom of last chapter item.
            // So if we are at last chapter, line should be full height of that container.
            
            const totalSteps = Math.max(1, chapters.length - 1);
            const percentage = ((prevChapterIndex + validFraction) / totalSteps) * 100;
            return `${Math.min(100, Math.max(0, percentage))}%`;
        }

        // Fallback to activeIndex if no year provided
        if (activeIndex < 0) return '0%';
        if (activeIndex >= chapters.length - 1) return '100%';
        return `${(activeIndex / (chapters.length - 1)) * 100}%`;
    }, [activeIndex, chapters, currentYear]);

    return (
        <div className={`storyline-progress-container ${mode}`}>
            <div className="storyline-progress-pill">
                {mode === 'overview' && (
                    <button 
                        className="storyline-start-btn-inline"
                        onClick={() => onStartStoryline && onStartStoryline()}
                    >
                        ▶ Innovatie-geschiedenis van Amsterdam bekijken
                    </button>
                )}

                <div className="storyline-dots-list">
                    <div className="dots-line-bg" />
                    <div className="dots-line-progress" style={{ height: progressHeight }} />

                    {chapters.map((chapter, index) => {
                        const isPast = index < activeIndex;
                        const isActive = index === activeIndex;
                        
                        return (
                            <div 
                                key={index} 
                                className={`storyline-dot-row ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                                onClick={() => onJump(index)}
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
                        onClick={onSkipToFuture}
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
