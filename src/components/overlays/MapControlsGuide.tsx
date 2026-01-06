import React, { useEffect, useState } from 'react';

interface MapControlsGuideProps {
    visible: boolean;
    hasPanned: boolean;
    hasRotated: boolean;
}

export const MapControlsGuide: React.FC<MapControlsGuideProps> = ({ visible, hasPanned, hasRotated }) => {
    const [show, setShow] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        if (visible) {
            // Show after 1s delay
            const timer = setTimeout(() => {
                setShow(true);
                // Standard timeout: Hide after 10s
                const hideTimer = setTimeout(() => setIsFadingOut(true), 10000);
                return () => clearTimeout(hideTimer);
            }, 1000); 
            return () => clearTimeout(timer);
        } else {
            setShow(false);
            setIsFadingOut(false);
        }
    }, [visible]);

    // Check interaction completion
    useEffect(() => {
        if (show && hasPanned && hasRotated) {
            const timer = setTimeout(() => {
                setIsFadingOut(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [show, hasPanned, hasRotated]);

    // Handle removal after fade out
    useEffect(() => {
        if (isFadingOut) {
            const timer = setTimeout(() => setShow(false), 1000); // 1s transition
            return () => clearTimeout(timer);
        }
    }, [isFadingOut]);

    if (!show) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: '160px', 
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            padding: '12px 24px',
            borderRadius: '24px',
            color: 'white',
            pointerEvents: 'none',
            display: 'flex',
            gap: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontSize: '14px',
            zIndex: 100,
            animation: isFadingOut ? 'fadeOut 1s forwards' : 'fadeIn 0.5s ease-out',
            opacity: isFadingOut ? 0 : 1
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🖱️</span>
                <span>Sleep om te bewegen</span>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                    border: '1px solid rgba(255,255,255,0.8)', 
                    borderRadius: '4px', 
                    padding: '0 4px', 
                    fontSize: '11px',
                    fontWeight: 600 
                }}>SHIFT</span>
                <span>+</span>
                <span style={{ fontSize: '18px' }}>🖱️</span>
                <span>Sleep om te draaien</span>
            </div>
            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translate(-50%, 10px); }
                        to { opacity: 1; transform: translate(-50%, 0); }
                    }
                    @keyframes fadeOut {
                        from { opacity: 1; transform: translate(-50%, 0); }
                        to { opacity: 0; transform: translate(-50%, -10px); }
                    }
                `}
            </style>
        </div>
    );
};
