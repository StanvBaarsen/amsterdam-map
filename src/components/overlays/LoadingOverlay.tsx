import React from 'react';

interface LoadingOverlayProps {
    isLoading: boolean;
    showIntro: boolean;
    progress: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, showIntro, progress }) => {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0f0f0',
            zIndex: 10,
            opacity: (isLoading && !showIntro) ? 1 : 0,
            pointerEvents: (isLoading && !showIntro) ? 'auto' : 'none',
            transition: 'opacity 0.8s ease-out'
        }}>
            <div style={{
                fontSize: '1.2rem',
                marginBottom: '1rem',
                color: '#333',
                fontFamily: 'sans-serif'
            }}>
                Laden... {Math.round(progress)}%
            </div>
            <div style={{
                width: '200px',
                height: '4px',
                backgroundColor: '#ddd',
                borderRadius: '2px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: '#ff4444',
                    transition: 'width 0.2s ease-out'
                }} />
            </div>
        </div>
    );
};
