import React, { useState } from 'react';
import { MdHistory, MdClose } from 'react-icons/md';
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
    // currentYear,
    // mode,
    isProjectCompleted,
    onJump,
    onSkipToFuture,
    // onStartStoryline
}) => {
    
    const [isOpen, setIsOpen] = useState(false);

    const getTitle = (desc: string) => {
        // Extract title from markdown-like description
        const firstLine = desc.split('\n')[0].replace(/^#+\s*/, '');
        // Remove text in parentheses (including the parens)
        return firstLine.replace(/\s*\(.*?\)/g, '').trim();
    };

    return (
        <div className="storyline-list-container">
            <button 
                className={`storyline-toggle ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Hoofdstukken"
            >
                <div className="icon-wrapper">
                    <MdHistory className={`nav-icon main-icon ${isOpen ? 'hidden' : ''}`} />
                    <MdClose className={`nav-icon close-icon ${isOpen ? 'visible' : ''}`} />
                </div>
            </button>

            <div className={`storyline-list-panel ${isOpen ? 'open' : ''}`}>
                <div className="storyline-list-header">
                    <h3>Hoofdstukken</h3>
                </div>
                <div className="storyline-items-scroll">
                    {chapters.map((chapter, index) => {
                        if (chapter.ending_text) return null;
                        const isPast = isProjectCompleted || index < activeIndex; 
                        const isActive = index === activeIndex;

                        return (
                            <button 
                                key={index} 
                                className={`storyline-item ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                                onClick={() => {
                                    onJump(index);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="storyline-item-year">{chapter.year}</span>
                                <span className="storyline-item-title">{getTitle(chapter.description)}</span>
                            </button>
                        );
                    })}
                     <button 
                        className="storyline-item future-item"
                        onClick={() => {
                            onSkipToFuture();
                            setIsOpen(false);
                        }}
                    >
                        <span className="storyline-item-year">2030</span>
                        <span className="storyline-item-title">Innovatieprojecten</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
