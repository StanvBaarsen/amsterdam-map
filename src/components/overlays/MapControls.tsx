// src/components/overlays/MapControls.tsx
import React from 'react';
import { MdMyLocation, MdExplore } from 'react-icons/md';
import './MapControls.css';

interface MapControlsProps {
    onLocateMe: () => void;
    onResetNorth: () => void;
    visible: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({ 
    onLocateMe, 
    onResetNorth,
    visible 
}) => {
    if (!visible) return null;

    return (
        <div className="map-controls-container">
            <button 
                className="map-control-btn"
                onClick={onResetNorth}
                title="Kompas: Reset naar noorden"
            >
                <MdExplore />
            </button>
            <button 
                className="map-control-btn"
                onClick={onLocateMe}
                title="Mijn locatie"
            >
                <MdMyLocation />
            </button>
        </div>
    );
};
