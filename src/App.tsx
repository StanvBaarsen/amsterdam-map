import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThreeViewer } from './components/ThreeViewer';
import { BuildingInformation } from './components/BuildingInformation';
import BAG3D from './assets/3dbag_versions.json';

const ViewerPage: React.FC = () => {

    const [basemapPreset] = useState('brtachtergrondkaart');
    const [tileset] = useState('lod22');
    const [, setCamRotationZ] = useState(0);
    const [showLocationBox, setShowLocationBox] = useState(false);
    const [locationBoxText, setLocationBoxText] = useState('');
    const [pickedBuilding, setPickedBuilding] = useState<any>(null);
    const [showBuildingInfo, setShowBuildingInfo] = useState(false);
    
    const BAG3DVersionData = (BAG3D as any)["versions"][(BAG3D as any)["latest"]];

    const basemapOptions = useMemo(() => {
        const sources: any = {
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

    const getTilesUrl = (lod: string) => {
        return BAG3DVersionData['3DTilesets'][lod];
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
                        Amsterdam 2035
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
                tilesUrl={getTilesUrl(tileset)}
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
