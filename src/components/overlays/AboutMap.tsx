import React, { useState, useEffect } from 'react';
import { MdRotateRight, MdAdsClick, MdMouse, MdTouchApp, MdPanTool, MdZoomIn } from 'react-icons/md';
import './AboutMap.css';

export const AboutMap: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                className="about-map-toggle"
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
                        
                        <p style={{ lineHeight: '1.6', color: '#444', marginBottom: '1.5rem', fontSize: '0.9em', fontStyle: 'italic' }}>
                            Let op: De kaart toont de gebouwen zoals ze er zijn in 2025. Gebouwen worden ingekleurd op basis van hun bouwjaar. Historisch gezien waren er uiteraard diverse gebouwen die nu niet meer bestaan; deze worden niet getoond.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                             <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#1a1a1a' }}>Navigatie</h3>
                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#ff4444', marginBottom: '6px', fontSize: '24px' }}>
                                        {isMobile ? <MdTouchApp /> : <MdRotateRight />}
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Draaien</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {isMobile ? 'Sleep met één vinger' : 'Linker muisknop'}
                                    </div>
                                    {!isMobile && <div style={{ fontSize: '12px', color: '#999' }}>of shift + slepen</div>}
                                </div>
                                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#ff4444', marginBottom: '6px', fontSize: '24px' }}>
                                        {isMobile ? <MdPanTool /> : <MdAdsClick />}
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Verplaatsen</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {isMobile ? 'Sleep met twee vingers' : 'Rechter muisknop'}
                                    </div>
                                    {!isMobile && <div style={{ fontSize: '12px', color: '#999' }}>of 2 vingers</div>}
                                </div>
                                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: '8px', textAlign: 'center', gridColumn: 'span 2' }}>
                                    <div style={{ color: '#ff4444', marginBottom: '6px', fontSize: '24px' }}>
                                        {isMobile ? <MdZoomIn /> : <MdMouse />}
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Zoomen</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {isMobile ? 'Pinch (knijp) beweging' : 'Scrollen met muiswiel'}
                                    </div>
                                    {!isMobile && <div style={{ fontSize: '12px', color: '#999' }}>of pinch beweging</div>}
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
                                    <strong>Bevolking:</strong> Cijfers afkomstig uit <a href="https://onderzoek.amsterdam.nl/artikel/de-amsterdamse-bevolking-tot-1900" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Onderzoek & Statistiek Amsterdam</a>.
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
