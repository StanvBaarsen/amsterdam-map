import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThreeViewer } from './components/ThreeViewer';
import { BuildingInformation } from './components/BuildingInformation';
import './App.css';

const ViewerPage: React.FC = () => {

    // Prevent pinch-to-zoom on desktop (trackpad)
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
            }
        };

        const handleGesture = (e: Event) => {
            e.preventDefault();
        };

        // Standard pinch-zoom (ctrl+wheel)
        document.addEventListener('wheel', handleWheel, { passive: false });
        
        // Safari gesture zoom
        document.addEventListener('gesturestart', handleGesture);
        document.addEventListener('gesturechange', handleGesture);

        // Cleanup
        return () => {
             document.removeEventListener('wheel', handleWheel);
             document.removeEventListener('gesturestart', handleGesture);
             document.removeEventListener('gesturechange', handleGesture);
        }
    }, []);

    // Configuration for external tile hosting (e.g. Cloudflare R2, AWS S3)
    // If empty, it will look for files in the local public/ folder
    // If __USE_LOCAL_DATA__ is true (dev mode with local data), use /data
    const REMOTE_TILE_HOST = import.meta.env.VITE_TILE_HOST || '';
    
    const BASEMAP_HOST = (import.meta.env.DEV && typeof __USE_LOCAL_BASEMAP__ !== 'undefined' && __USE_LOCAL_BASEMAP__) 
        ? '/data' 
        : REMOTE_TILE_HOST;

    const TILES_HOST = (import.meta.env.DEV && typeof __USE_LOCAL_TILES__ !== 'undefined' && __USE_LOCAL_TILES__) 
        ? '/data' 
        : REMOTE_TILE_HOST;

    const [basemapPreset] = useState('local');
    const [, setCamRotationZ] = useState(0);
    const [showLocationBox, setShowLocationBox] = useState(false);
    const [locationBoxText, setLocationBoxText] = useState('');
    const [pickedBuilding, setPickedBuilding] = useState<any>(null);
    const [showBuildingInfo, setShowBuildingInfo] = useState(false);
    
    const basemapOptions = useMemo(() => {
        const sources: any = {
            local: {
                type: "wmts",
                options: {
                    url: `${BASEMAP_HOST}/basemap/capabilities.xml`,
                    template: `${BASEMAP_HOST}/basemap/tiles/grijs/{TileMatrix}/{TileCol}/{TileRow}.png`,
                    layer: 'pastel',
                    style: 'default',
                    tileMatrixSet: "EPSG:28992",
                    service: "WMTS",
                    request: "GetTile",
                    version: "1.0.0",
                    format: "image/png"
                }
            },
            local_grijs: {
                type: "wmts",
                options: {
                    url: `${BASEMAP_HOST}/basemap/capabilities.xml`,
                    template: `${BASEMAP_HOST}/basemap/tiles/grijs/{TileMatrix}/{TileCol}/{TileRow}.png`,
                    layer: 'grijs',
                    style: 'default',
                    tileMatrixSet: "EPSG:28992",
                    service: "WMTS",
                    request: "GetTile",
                    version: "1.0.0",
                    format: "image/png"
                }
            },
            brtachtergrondkaart: {
                type: "wmts",
                options: {
                    url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0?',
                    layer: 'standaard',
                    style: 'default',
                    tileMatrixSet: "EPSG:28992",
                    service: "WMTS",
                    request: "GetTile",
                    version: "1.0.0",
                    format: "image/png"
                }
            },
            brtachtergrondkaartgrijs: {
                type: "wmts",
                options: {
                    url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0?',
                    layer: 'grijs',
                    style: 'default',
                    tileMatrixSet: "EPSG:28992",
                    service: "WMTS",
                    request: "GetTile",
                    version: "1.0.0",
                    format: "image/png"
                }
            },
            luchtfotoWMTS: {
                type: "wmts",
                options: {
                    url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?',
                    layer: 'Actueel_ortho25',
                    style: 'default',
                    tileMatrixSet: "EPSG:28992",
                    service: "WMTS",
                    request: "GetTile",
                    version: "1.0.0",
                    format: "image/png"
                }
            }
        };
        return sources[basemapPreset] || sources['brtachtergrondkaart'];
    }, [basemapPreset]);

    const getTilesUrl = () => {
        return `${TILES_HOST}/amsterdam_3dtiles_lod12/tileset.json`;
    };

    const [isStorylineActive, setIsStorylineActive] = useState(false);
    const [isInnovationActive, setIsInnovationActive] = useState(false);

    return (
        <div id="viewer" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            <div className={`app-header ${isStorylineActive || isInnovationActive ? 'storyline-active' : ''}`}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    padding: '1rem 2.5rem',
                    background: 'rgba(239, 240, 235, 0.85)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    pointerEvents: 'auto'
                }}>
                    <h1 style={{ 
                        margin: 0,
                        color: '#231F20',
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        fontFamily: "'Merriweather', serif"
                    }}>
                        Amsterdam 2030
                    </h1>
                    <img src="/favicon.svg" alt="Logo" className="header-logo" />
                </div>
            </div>

            <div 
                id="locationbox" 
                className={`box ${showLocationBox ? 'visible' : ''}`} 
                style={{ 
                    position: 'absolute', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)', 
                    zIndex: 20 
                }}
            >
                {locationBoxText}
            </div>

            <BuildingInformation 
                building={pickedBuilding} 
                show={showBuildingInfo} 
                onCloseInfo={() => setShowBuildingInfo(false)} 
                onReportData={() => {}} 
            />

            <ThreeViewer 
                tilesUrl={getTilesUrl()}
                basemapOptions={basemapOptions}
                onCamRotationZ={setCamRotationZ}
                onShowLocationBox={(text) => {
                    setLocationBoxText(text);
                    setShowLocationBox(true);
                    setTimeout(() => {
                        setShowLocationBox(false);
                    }, 2000);
                }}
                onHideLocationBox={() => setShowLocationBox(false)}
                onObjectPicked={(obj) => {
                    setPickedBuilding(obj);
                    setShowBuildingInfo(true);
                }}
                onStorylineToggle={setIsStorylineActive}
                onInnovationToggle={setIsInnovationActive}
            />
        </div>
    );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ViewerPage />} />
      </Routes>
    </Router>
  )
}

export default App
