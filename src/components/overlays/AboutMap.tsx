import React, { useState } from 'react';
import { MdRotateRight, MdAdsClick, MdMouse } from 'react-icons/md';
import './AboutMap.css';

export const AboutMap: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 300);
    };

    const handleOpen = () => {
        setIsOpen(true);
    };

    return (
        <>
            <button
                onClick={handleOpen}
                title="Informatie & Credits"
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '25px',
                    width: '32px',
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
                    zIndex: 90,
                    transition: 'transform 0.2s',
                    fontFamily: '"Helvetica Neue", Arial, sans-serif'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                ?
            </button>

            {isOpen && (
                <div 
                    className={`about-map-overlay ${isClosing ? 'closing' : ''}`}
                    onClick={handleClose}
                >
                    <div 
                        className="about-map-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={handleClose}
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

                        <div style={{ marginBottom: '1.5rem' }}>
                             <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#1a1a1a' }}>Navigatie</h3>
                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#ff4444', marginBottom: '6px', fontSize: '24px' }}><MdRotateRight /></div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Draaien</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>Linker muisknop</div>
                                    <div style={{ fontSize: '12px', color: '#999' }}>of shift + slepen</div>
                                </div>
                                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#ff4444', marginBottom: '6px', fontSize: '24px' }}><MdAdsClick /></div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Verplaatsen</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>Rechter muisknop</div>
                                    <div style={{ fontSize: '12px', color: '#999' }}>of 2 vingers</div>
                                </div>
                                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center', gridColumn: 'span 2' }}>
                                    <div style={{ color: '#ff4444', marginBottom: '6px', fontSize: '24px' }}><MdMouse /></div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Zoomen</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>Scrollen met muiswiel</div>
                                    <div style={{ fontSize: '12px', color: '#999' }}>of pinch beweging</div>
                                </div>
                             </div>
                        </div>

                        <div style={{ 
                            background: '#f5f7fa', 
                            padding: '20px', 
                            borderRadius: '8px', 
                            marginBottom: '1.5rem' 
                        }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#1a1a1a' }}>Credits</h3>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', lineHeight: '1.5', fontSize: '0.95rem' }}>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>3D Data:</strong> Met dank aan het <a href="https://3dbag.nl" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>3DBAG</a> project (TU Delft) voor de gedetailleerde gebouwinformatie en kaart-logica.
                                </li>
                                <li style={{ marginBottom: '8px' }}>
                                    <strong>Ontwikkeling:</strong> Door <a href="https://herprogrammeerdeoverheid.nl" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Herprogrammeer de Overheid</a> (<a href="https://www.linkedin.com/in/oscar-lepoeter-87002a160/" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Oscar Lepoeter</a>, <a href="https://www.linkedin.com/in/onnoericblom/" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Onno Eric Blom</a> en <a href="https://www.stanvanbaarsen.nl" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Stan van Baarsen</a>).
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
