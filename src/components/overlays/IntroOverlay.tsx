import React from 'react';
import './IntroOverlay.css';

interface IntroOverlayProps {
    show: boolean;
    onStart: (skipStoryline: boolean) => void;
    isLoading: boolean;
    progress: number;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ show, onStart, isLoading, progress }) => {
    const [skipStoryline, setSkipStoryline] = React.useState(false);
    const [hasVisited, setHasVisited] = React.useState(false);

    React.useEffect(() => {
        const visited = localStorage.getItem('hasVisited');
        if (visited) {
            setHasVisited(true);
        }
    }, []);

    const handleStart = () => {
        localStorage.setItem('hasVisited', 'true');
        onStart(skipStoryline);
    };

    // Clamp progress at 100%
    const displayProgress = Math.min(100, Math.round(progress));

    return (
        <div className={`intro-overlay ${show ? 'visible' : ''}`}>
            <div className="intro-card">
                <h1 className="intro-title">
                    Amsterdam 2030
                </h1>
                <p className="intro-description">
                    Ontdek wat innovatie voor Amsterdam heeft betekend door de eeuwen heen. 
                    Deze interactieve 3D-kaart toont de groei van de stad, en neemt je mee door verschillende innovatieprojecten.
                </p>

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

                {hasVisited && (
                    <div className="checkbox-container">
                        <input 
                            type="checkbox" 
                            id="skipStoryline"
                            className="checkbox-custom" 
                            checked={skipStoryline} 
                            onChange={(e) => setSkipStoryline(e.target.checked)}
                        />
                        <label htmlFor="skipStoryline" className="checkbox-label">
                            Sla geschiedenis over
                        </label>
                    </div>
                )}

                <button 
                    onClick={handleStart}
                    disabled={isLoading}
                    className={`start-button ${!isLoading ? 'ready' : ''}`}
                >
                    {isLoading ? 'Even geduld...' : 'Start met verkennen'}
                </button>
            </div>
        </div>
    );
};
