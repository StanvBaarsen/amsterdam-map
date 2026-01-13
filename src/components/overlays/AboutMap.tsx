import React, { useState, useEffect } from 'react';
import { MdRotateRight, MdAdsClick, MdMouse, MdTouchApp, MdPanTool, MdZoomIn } from 'react-icons/md';
import './AboutMap.css';

interface AboutMapProps {
    isOpen?: boolean;
    onClose?: () => void;
    onToggle?: () => void;
}

export const AboutMap: React.FC<AboutMapProps> = ({ 
    isOpen: propIsOpen, 
    onClose: propOnClose,
    onToggle: propOnToggle
}) => {
    // Local state fallback if not controlled
    const [localIsOpen, setLocalIsOpen] = useState(false);
    const isControlled = typeof propIsOpen !== 'undefined';
    const isOpen = isControlled ? propIsOpen : localIsOpen;

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
            if (isControlled) {
                if (propOnClose) propOnClose();
            } else {
                setLocalIsOpen(false);
            }
            setIsClosing(false);
        }, 300);
    };

    const handleOpen = () => {
        if (isControlled) {
            if (propOnToggle) propOnToggle();
        } else {
            setLocalIsOpen(true);
        }
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
                                    <strong>Bevolkingsdata:</strong>
                                    <ul style={{ marginTop: '5px', paddingLeft: '15px', listStyleType: 'disc' }}>
                                        <li style={{ marginBottom: '4px' }}>
                                            1000-1275: <a href="https://openresearch.amsterdam/nl/page/114554/erfgoed-van-de-week-een-wandeling-in-amsterdam-in-1275" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>OpenResearch</a> & <a href="https://www.amsterdammuseum.nl/tentoonstelling/geschiedenis-van-de-dam/12469" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Amsterdam Museum</a>
                                        </li>
                                        <li style={{ marginBottom: '4px' }}>
                                            1600-1900: <a href="https://onderzoek.amsterdam.nl/artikel/de-amsterdamse-bevolking-tot-1900" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Onderzoek & Statistiek Gemeente Amsterdam (tot 1900)</a>
                                        </li>
                                        <li>
                                            2000-2024: <a href="https://onderzoek.amsterdam.nl/artikel/bevolking-in-cijfers-2024" target="_blank" rel="noopener noreferrer" style={{ color: '#ff4444', textDecoration: 'none' }}>Onderzoek & Statistiek Gemeente Amsterdam (2024)</a>
                                        </li>
                                    </ul>
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
