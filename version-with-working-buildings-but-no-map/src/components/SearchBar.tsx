import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdSearch, MdLocationOn } from 'react-icons/md';
import debounce from 'debounce';
import proj4 from 'proj4';

proj4.defs("EPSG:28992", "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs");
proj4.defs('EPSG:4326', '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees');

interface SearchBarProps {
    onSelectPlace: (place: any) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSelectPlace }) => {
    const { t } = useTranslation();
    const [isModalActive, setIsModalActive] = useState(false);
    const [geocodeResult, setGeocodeResult] = useState<any[]>([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isModalActive && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isModalActive]);

    const doGeocode = useRef(debounce((name: string) => {
        if (!name || name.length < 2) {
            setGeocodeResult([]);
            return;
        }
        setIsGeocoding(true);
        fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${name}&rows=5`)
            .then(response => response.json())
            .then(data => {
                const docs = data.response.docs;
                setGeocodeResult(docs);
                setIsGeocoding(false);
            })
            .catch(() => setIsGeocoding(false));
    }, 300)).current;

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        doGeocode(val);
    };

    const selectPlace = (place: any) => {
        fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${place.id}`)
            .then(response => response.json())
            .then(data => {
                const doc = data.response.docs[0];
                const wkt = doc.centroide_rd; // POINT(x y)
                const coords = wkt.match(/\(([^)]+)\)/)[1].split(' ');
                const rd_x = parseFloat(coords[0]);
                const rd_y = parseFloat(coords[1]);
                
                onSelectPlace({
                    rd_x,
                    rd_y,
                    name: doc.weergavenaam
                });
                setIsModalActive(false);
                setSearchTerm('');
            });
    };

    return (
        <div className="control">
            <button className="button is-primary" onClick={() => setIsModalActive(true)}>
                <span className="icon">
                    <MdSearch />
                </span>
                <span className="is-hidden-mobile">{t("SearchBar.search")}</span>
            </button>

            {isModalActive && (
                <div className="modal is-active">
                    <div className="modal-background" onClick={() => setIsModalActive(false)}></div>
                    <div className="modal-card">
                        <header className="modal-card-head">
                            <p className="modal-card-title">{t("SearchBar.search")}</p>
                            <button className="delete" aria-label="close" onClick={() => setIsModalActive(false)}></button>
                        </header>
                        <section className="modal-card-body">
                            <div className="field">
                                <div className="control has-icons-left has-icons-right">
                                    <input 
                                        className="input" 
                                        type="text" 
                                        placeholder={t("SearchBar.search")}
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        ref={inputRef}
                                    />
                                    <span className="icon is-small is-left">
                                        <MdSearch />
                                    </span>
                                    {isGeocoding && (
                                        <span className="icon is-small is-right">
                                            ...
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="list is-hoverable">
                                {geocodeResult.map(place => (
                                    <a key={place.id} className="list-item" onClick={() => selectPlace(place)}>
                                        <div className="media">
                                            <div className="media-left">
                                                <span className="icon">
                                                    <MdLocationOn />
                                                </span>
                                            </div>
                                            <div className="media-content">
                                                <p>{place.weergavenaam}</p>
                                                <p className="is-size-7">{place.type}</p>
                                            </div>
                                        </div>
                                    </a>
                                ))}
                                {geocodeResult.length === 0 && searchTerm.length > 1 && !isGeocoding && (
                                    <div className="list-item">{t("SearchBar.empty")}</div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};
