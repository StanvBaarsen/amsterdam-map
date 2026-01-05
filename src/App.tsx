import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThreeViewer } from './components/ThreeViewer';
import { BuildingInformation } from './components/BuildingInformation';

const ViewerPage: React.FC = () => {

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

    return (
        <div id="viewer" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '2rem', width: '100%', textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
                <div style={{
                    display: 'inline-block',
                    padding: '1rem 2.5rem',
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    pointerEvents: 'auto'
                }}>
                    <h1 style={{ 
                        margin: 0,
                        color: '#1a1a1a',
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                    }}>
                        Amsterdam 2030
                    </h1>
                </div>
            </div>

            {showLocationBox && (
                <div id="locationbox" className="box" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20 }}>
                    {locationBoxText}
                </div>
            )}

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
                }}
                onHideLocationBox={() => setShowLocationBox(false)}
                onObjectPicked={(obj) => {
                    setPickedBuilding(obj);
                    setShowBuildingInfo(true);
                }}
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
