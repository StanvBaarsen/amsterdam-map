import React from 'react';
import ReactMarkdown from 'react-markdown';
import './IntroOverlay.css';
import startText from '../../assets/start_text.json';

interface IntroOverlayProps {
    show: boolean;
    onStart: (skipStoryline?: boolean, resume?: boolean, goToInnovation?: boolean) => void;
    isLoading: boolean;
    progress: number;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ show, onStart, isLoading, progress }) => {

    // Clamp progress at 99%
    const displayProgress = Math.min(99, Math.round(progress));

    return (
        <div className={`intro-overlay ${show ? 'visible' : ''} ${!isLoading ? 'loaded' : ''}`}>
            <div className="intro-card">
                <h1 className="intro-title">
                    {startText.title}
                </h1>
                <div className="intro-description">
                    <ReactMarkdown>{startText.content}</ReactMarkdown>
                </div>
                <p className="mobile-warning">Deze kaart werkt het beste op een desktop.</p>

                <div className="actions-area">
                    <div className={`loading-container ${isLoading ? 'loading' : ''}`}>
                        <div className="loading-text">
                            Laden... {displayProgress}%
                        </div>
                        <div className="loading-track">
                            <div 
                                className="loading-bar" 
                                style={{ width: `${displayProgress}%` }} 
                            />
                        </div>
                    </div>

                    <div className={`start-options ${!isLoading ? 'visible' : ''}`}>
                        <button 
                            onClick={() => onStart()}
                            className="start-button full-width"
                        >
                            Start
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
