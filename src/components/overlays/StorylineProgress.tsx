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
    isOpen?: boolean;
    onToggle?: (isOpen: boolean) => void;
}

export const StorylineProgress: React.FC<StorylineProgressProps> = ({
    chapters,
    activeIndex,
    // currentYear,
    mode,
    isProjectCompleted,
    onJump,
    onSkipToFuture,
    // onStartStoryline
    isOpen: controlledIsOpen,
    onToggle: controlledOnToggle
}) => {
    
    const [internalOpen, setInternalOpen] = useState(false);
    
    // Determine if component is controlled
    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalOpen;
    
    const handleToggle = (newState: boolean) => {
        if (isControlled && controlledOnToggle) {
            controlledOnToggle(newState);
        } else {
            setInternalOpen(newState);
        }
    };

    const getTitle = (desc: string) => {
        // Extract title from markdown-like description
        const firstLine = desc.split('\n')[0].replace(/^#+\s*/, '');
        // Remove text in parentheses (including the parens)
        return firstLine.replace(/\s*\(.*?\)/g, '').trim();
    };

    return (
        <div className={`storyline-list-container mode-${mode}`}>
            <button 
                className={`storyline-toggle ${isOpen ? 'active' : ''}`}
                onClick={() => handleToggle(!isOpen)}
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
                                    handleToggle(false);
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
                            handleToggle(false);
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
