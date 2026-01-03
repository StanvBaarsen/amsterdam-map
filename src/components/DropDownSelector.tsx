import React, { useState } from 'react';
import { MdKeyboardArrowDown, MdHome, MdMap } from 'react-icons/md';

interface DropDownSelectorProps {
    value: string;
    options: {[key: string]: {name: string, icon: string}};
    title: string;
    onChange: (value: string) => void;
    color?: string;
}

export const DropDownSelector: React.FC<DropDownSelectorProps> = ({ value, options, title, onChange, color = '' }) => {
    const [isActive, setIsActive] = useState(false);

    const getIcon = (iconName: string) => {
        if (iconName === 'home') return <MdHome />;
        if (iconName === 'map') return <MdMap />;
        return null;
    }

    return (
        <div className={`dropdown ${isActive ? 'is-active' : ''}`}>
            <div className="dropdown-trigger">
                <button 
                    className={`button ${color}`} 
                    aria-haspopup="true" 
                    aria-controls="dropdown-menu" 
                    onClick={() => setIsActive(!isActive)}
                    onBlur={() => setTimeout(() => setIsActive(false), 200)}
                >
                    <span className="icon is-small">
                        {getIcon(options[value].icon)}
                    </span>
                    <span className="is-hidden-mobile" style={{marginLeft: '0.5em', marginRight: '0.5em'}}>{title}</span>
                    <span className="icon is-small">
                        <MdKeyboardArrowDown />
                    </span>
                </button>
            </div>
            <div className="dropdown-menu" id="dropdown-menu" role="menu">
                <div className="dropdown-content">
                    {Object.entries(options).map(([key, opt]) => (
                        <a 
                            key={key} 
                            className={`dropdown-item ${value === key ? 'is-active' : ''}`} 
                            onMouseDown={() => { onChange(key); setIsActive(false); }}
                        >
                            <div className="media">
                                <div className="media-left">
                                    <span className="icon is-small">
                                        {getIcon(opt.icon)}
                                    </span>
                                </div>
                                <div className="media-content">
                                    <p>{opt.name}</p>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};
