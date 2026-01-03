import React from 'react';
import compassSvg from '../assets/compass.svg';

interface CompassProps {
    rotation: number;
    onOrientNorth: () => void;
}

export const Compass: React.FC<CompassProps> = ({ rotation, onOrientNorth }) => {
    return (
        <div className="control">
            <button className="button px-2" type="button" onClick={onOrientNorth}>
                <img 
                    src={compassSvg} 
                    width="24" 
                    height="24" 
                    style={{ transform: `rotate(${rotation}rad)`, transition: 'transform 0.1s' }} 
                    alt="Compass"
                />
            </button>
        </div>
    );
};
