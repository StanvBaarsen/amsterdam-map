import React from 'react';
import { MdHistory, MdClose } from 'react-icons/md';
import './ChapterNavigation.css';

interface Chapter {
    year: number;
    description: string;
}

interface ChapterNavigationProps {
    chapters: Chapter[];
    activeIndex: number;
    onSelectChapter: (index: number) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export const ChapterNavigation: React.FC<ChapterNavigationProps> = ({ 
    chapters, 
    activeIndex,
    onSelectChapter,
    isOpen,
    onToggle
}) => {
    // Helper to extract a title from markdown description (first line with # or just text)
    const getTitle = (desc: string) => {
        const firstLine = desc.split('\n')[0].replace(/^#+\s*/, '');
        return firstLine;
    };

    return (
        <div className="chapter-nav-container">
            <button 
                className={`chapter-nav-toggle ${isOpen ? 'active' : ''}`}
                onClick={onToggle}
                title="Tijdlijn hoofdstukken"
            >
                <div className="icon-wrapper">
                    <MdHistory className={`nav-icon main-icon ${isOpen ? 'hidden' : ''}`} />
                    <MdClose className={`nav-icon close-icon ${isOpen ? 'visible' : ''}`} />
                </div>
            </button>

            <div className={`chapter-list ${isOpen ? 'open' : ''}`}>
                <div className="chapter-list-header">
                    <h3>Tijdlijn</h3>
                </div>
                <div className="chapter-list-scroll">
                    {chapters.map((chapter, index) => (
                        <button 
                            key={chapter.year}
                            className={`chapter-item ${index === activeIndex ? 'active' : ''}`}
                            onClick={() => {
                                onSelectChapter(index);
                                onToggle(); // Close on select
                            }}
                        >
                            <span className="chapter-year">{chapter.year}</span>
                            <span className="chapter-title">{getTitle(chapter.description)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};


