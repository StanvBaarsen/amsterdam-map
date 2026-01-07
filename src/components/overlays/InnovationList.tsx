import React, { useState } from 'react';
import { MdLightbulbOutline, MdClose } from 'react-icons/md';
import './InnovationList.css';

interface InnovationProject {
    id: string;
    name: string;
    description: string;
    coordinate: { x: number, y: number } | { lat: number, lng: number };
    image?: string;
}

interface InnovationListProps {
    projects: InnovationProject[];
    onSelectProject: (project: InnovationProject) => void;
}

export const InnovationList: React.FC<InnovationListProps> = ({ projects, onSelectProject }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="innovation-list-container">
            <button 
                className={`innovation-toggle ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
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
                    {projects.map(project => (
                        <button 
                            key={project.id}
                            className="innovation-item"
                            onClick={() => {
                                onSelectProject(project);
                                setIsOpen(false); // Close on select
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

