import React from 'react';

interface IntroOverlayProps {
    show: boolean;
    onStart: () => void;
    isLoading: boolean;
    progress: number;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ show, onStart, isLoading, progress }) => {
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
            backgroundColor: 'rgba(240, 240, 240, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 20,
            opacity: show ? 1 : 0,
            pointerEvents: show ? 'auto' : 'none',
            transition: 'opacity 1.5s ease-in-out'
        }}>
            <div style={{
                maxWidth: '600px',
                padding: '3rem',
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                textAlign: 'center'
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    marginBottom: '1.5rem',
                    color: '#1a1a1a',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    fontWeight: '700'
                }}>
                    Amsterdam 2030
                </h1>
                <p style={{
                    fontSize: '1.1rem',
                    lineHeight: '1.6',
                    color: '#444',
                    marginBottom: '2.5rem',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                }}>
                    Ontdek wat innovatie voor Amsterdam heeft betekend door de eeuwen heen. 
                    Deze interactieve 3D-kaart toont de groei van de stad, en neemt je mee door verschillende innovatieprojecten.
                </p>

                {isLoading && (
                    <div style={{ marginBottom: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ marginBottom: '0.5rem', color: '#666', fontSize: '0.9rem', fontFamily: 'sans-serif' }}>
                            Laden... {Math.round(progress)}%
                        </div>
                        <div style={{
                            width: '100%',
                            maxWidth: '300px',
                            height: '4px',
                            backgroundColor: '#eee',
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
                )}

                <button 
                    onClick={onStart}
                    disabled={isLoading}
                    style={{
                        padding: '1rem 3rem',
                        fontSize: '1.1rem',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'transform 0.1s, background-color 0.2s, opacity 0.2s',
                        fontWeight: '600',
                        boxShadow: isLoading ? 'none' : '0 4px 12px rgba(255, 68, 68, 0.3)',
                        opacity: isLoading ? 0.5 : 1
                    }}
                    onMouseOver={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#ff2222')}
                    onMouseOut={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#ff4444')}
                    onMouseDown={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(0.98)')}
                    onMouseUp={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1)')}
                >
                    {isLoading ? 'Even geduld...' : 'Start met verkennen'}
                </button>
            </div>
        </div>
    );
};
