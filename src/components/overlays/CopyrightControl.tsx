import React, { useState } from 'react';

export const CopyrightControl: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                title="Informatie & Credits"
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '25px',
                    width: '32px', // Slightly smaller
                    height: '32px',
                    borderRadius: '50%',
                    background: 'white',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    zIndex: 90, // Under overlays if they open?
                    transition: 'transform 0.2s',
                    fontFamily: 'serif'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                ©
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 1,
                    transition: 'opacity 0.2s'
                }} onClick={() => setIsOpen(false)}>
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white',
                            padding: '30px',
                            borderRadius: '16px',
                            maxWidth: '500px',
                            width: '90%',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            position: 'relative',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                        }}
                    >
                        <button 
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '20px',
                                color: '#999',
                                padding: '5px'
                            }}
                        >
                            ✕
                        </button>
                        
                        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', color: '#1a1a1a' }}>Over deze kaart</h2>
                        
                        <p style={{ lineHeight: '1.6', color: '#444', marginBottom: '1.5rem' }}>
                            Deze interactieve 3D-kaart visualiseert de ontwikkeling van Amsterdam door de eeuwen heen, met een focus op innovatie en groei.
                        </p>

                        <div style={{ 
                            background: '#f5f7fa', 
                            padding: '20px', 
                            borderRadius: '8px', 
                            marginBottom: '1.5rem' 
                        }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#1a1a1a' }}>Credits</h3>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', lineHeight: '1.5', fontSize: '0.95rem' }}>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>3D Data:</strong> Met dank aan het <a href="https://3dbag.nl" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>3DBAG</a> project (TUDelft) voor de gedetailleerde gebouwindformatie.
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>Realisatie:</strong> Ontwikkeld door het <a href="https://deltainstituut.nl" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Delta Instituut</a>.
                                </li>
                            </ul>
                        </div>
                        
                        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#888' }}>
                           © {new Date().getFullYear()} Delta Instituut
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
