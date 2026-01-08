import React from 'react';
import ReactMarkdown from 'react-markdown';
import './IntroOverlay.css';
import startText from '../../assets/start_text.json';

interface IntroOverlayProps {
    show: boolean;
    onStart: (skipStoryline: boolean, resume?: boolean, goToInnovation?: boolean) => void;
    isLoading: boolean;
    progress: number;
    hasSavedProgress?: boolean;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ show, onStart, isLoading, progress, hasSavedProgress }) => {
    const [showResumeParams, setShowResumeParams] = React.useState(false);

    const handleStart = (skip: boolean, goToInnovation: boolean = false) => {
        if (!skip && hasSavedProgress && !showResumeParams) {
             setShowResumeParams(true);
        } else {
             onStart(skip, false, goToInnovation);
        }
    };

    const handleResume = () => {
        onStart(false, true);
    }
    
    const handleRestart = () => {
        onStart(false, false);
    }

    // Clamp progress at 100%
    const displayProgress = Math.min(100, Math.round(progress));

    if (showResumeParams) {
        return (
            <div className={`intro-overlay ${show ? 'visible' : ''}`}>
                <div className="intro-card">
                    <h1 className="intro-title">Verder waar je gebleven was?</h1>
                    <p className="intro-description">
                         Je hebt de rondleiding eerder afgebroken. Wil je verdergaan bij het hoofdstuk waar je gebleven was?
                    </p>
                     <div className="actions-area">
                        <div className="start-options visible">
                             <button 
                                onClick={handleResume}
                                className="start-button full-width"
                                style={{ marginBottom: '10px' }}
                            >
                                Ja, ga verder
                            </button>
                            <button 
                                onClick={handleRestart}
                                className="start-button half-width"
                                style={{ width: '100%' }}
                            >
                                Nee, begin opnieuw
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

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
                            onClick={() => handleStart(false)}
                            className="start-button full-width"
                        >
                            Volledige Amsterdam innovatie-tour
                        </button>
                        
                        <div className="start-options-row">
                            <button 
                                onClick={() => handleStart(true, true)}
                                className="start-button half-width"
                            >
                                Direct naar innovatieprojecten 2030
                            </button>
                            <button 
                                onClick={() => handleStart(true, false)}
                                className="start-button half-width"
                            >
                                Innovatie-kaart vrij verkennen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
