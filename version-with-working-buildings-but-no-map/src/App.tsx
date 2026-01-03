import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { ThreeViewer } from './components/ThreeViewer';
import { DropDownSelector } from './components/DropDownSelector';
import { SearchBar } from './components/SearchBar';
import { Compass } from './components/Compass';
import { BuildingInformation } from './components/BuildingInformation';
import { useTranslation } from 'react-i18next';
import BAG3D from './assets/3dbag_versions.json';

const ViewerPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [basemapPreset, setBasemapPreset] = useState('brtachtergrondkaart');
    const [tileset, setTileset] = useState('lod12');
    const [camRotationZ, setCamRotationZ] = useState(0);
    const [showLocationBox, setShowLocationBox] = useState(false);
    const [locationBoxText, setLocationBoxText] = useState('');
    const [pickedBuilding, setPickedBuilding] = useState<any>(null);
    const [showBuildingInfo, setShowBuildingInfo] = useState(false);
    
    const BAG3DVersionData = (BAG3D as any)["versions"][(BAG3D as any)["latest"]];

    const basemaps: any = {
        brtachtergrondkaart: { name: "BRT Achtergrondkaart", icon: "map" },
        brtachtergrondkaartgrijs: { name: "BRT Achtergrondkaart (Grijs)", icon: "map" },
        luchtfotoWMTS: { name: "Luchtfoto Actueel", icon: "map" }
    };

    const lods: any = {
        lod22: { name: "LoD 2.2", icon: "home" },
        lod13: { name: "LoD 1.3", icon: "home" },
        lod12: { name: "LoD 1.2", icon: "home" }
    };

    const getBasemapOptions = (preset: string) => {
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
        return sources[preset] || sources['brtachtergrondkaart'];
    };

    const getTilesUrl = (lod: string) => {
        return BAG3DVersionData['3DTilesets'][lod];
    };

    const handleOrientNorth = () => {
        // This would require a ref to ThreeViewer to call pointCameraToNorth
        // For now, we can implement it later or use a context/event bus
        console.log("Orient North clicked");
    };

    return (
        <div id="viewer" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
            <nav className="navbar is-fixed-top is-white" role="navigation" aria-label="main navigation">
                <div className="navbar-brand">
                    <div className="navbar-item">
                        <span className="logo-text" style={{marginRight: '0.4em', color: '#000', fontWeight: 'bold'}}>Amsterdam kaartje</span>
                    </div>
                </div>
            </nav>

            <section id="map-options" className="field has-addons" style={{ position: 'absolute', top: '4rem', left: '1rem', zIndex: 10 }}>
                <DropDownSelector 
                    value={basemapPreset} 
                    options={basemaps} 
                    title={t('viewer.baselayer2')} 
                    onChange={setBasemapPreset} 
                />
                <DropDownSelector 
                    value={tileset} 
                    options={lods} 
                    title="LoD" 
                    onChange={setTileset} 
                />
                <SearchBar onSelectPlace={(place) => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('rdx', place.rd_x);
                    params.set('rdy', place.rd_y);
                    params.set('placeMarker', 'true');
                    navigate(`/?${params.toString()}`);
                }} />
                <Compass rotation={camRotationZ} onOrientNorth={handleOrientNorth} />
            </section>

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
                basemapOptions={getBasemapOptions(basemapPreset)}
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
