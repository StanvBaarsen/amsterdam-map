import React, { useState, useEffect } from 'react';
import { MdLightbulbOutline, MdClose } from 'react-icons/md';
import './InnovationList.css';

interface InnovationProject {
    id: string;
    name: string;
    description: string;
    coordinate: { x: number, y: number } | { lat: number, lng: number };
    image?: string;
    ending_text?: boolean;
    cameraAngle?: number;
    cameraDistance?: number;
}

interface InnovationListProps {
    projects: InnovationProject[];
    onSelectProject: (project: InnovationProject) => void;
    onToggle?: (isOpen: boolean) => void;
    isOpen?: boolean;
}

export const InnovationList: React.FC<InnovationListProps> = ({ 
    projects, 
    onSelectProject, 
    onToggle: controlledOnToggle, 
    isOpen: controlledIsOpen 
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    
    // Determine if component is controlled
    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalOpen;

    const handleToggle = (newState: boolean) => {
        if (isControlled && controlledOnToggle) {
            controlledOnToggle(newState);
        } else {
            setInternalOpen(newState);
            controlledOnToggle?.(newState);
        }
    };
    
    useEffect(() => {
        return () => {
             // Cleanup if needed
        };
    }, []);
    
    // Filter out projects that are marked as ending text (should not show in list)
    const visibleProjects = projects.filter(p => !p.ending_text);

    return (
        <div className="innovation-list-container">
            <button 
                className={`innovation-toggle ${isOpen ? 'active' : ''}`}
                onClick={() => handleToggle(!isOpen)}
                title="Innovatieprojecten"
            >
                <div className="icon-wrapper">
                    <MdLightbulbOutline className={`nav-icon main-icon ${isOpen ? 'hidden' : ''}`} />
                    <MdClose className={`nav-icon close-icon ${isOpen ? 'visible' : ''}`} />
                </div>
            </button>

            <div className={`innovation-list-panel ${isOpen ? 'open' : ''}`}>
                <div className="innovation-list-header">
                    <h3>Innovatieprojecten</h3>
                </div>
                <div className="innovation-items-scroll">
                    {visibleProjects.map(project => (
                        <button 
                            key={project.id}
                            className="innovation-item"
                            onClick={() => {
                                onSelectProject(project);
                                handleToggle(false); // Close on select
                            }}
                        >
                            <span className="innovation-item-name">{project.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

