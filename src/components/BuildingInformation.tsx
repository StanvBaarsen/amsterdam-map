import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdTableChart, MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose, MdDownload, MdHeight } from 'react-icons/md';

interface BuildingInformationProps {
    building: any;
    show: boolean;
    onCloseInfo: () => void;
    onReportData: () => void;
}

export const BuildingInformation: React.FC<BuildingInformationProps> = ({ building, show, onCloseInfo, onReportData }) => {
    const { t, i18n } = useTranslation();
    const [isActive, setIsActive] = useState(false);

    if (!show || !building) return null;

    const attr_names = building.attributes ? Object.keys(building.attributes).sort() : [];
    const h_clicked = building.attributes && building.attributes['h_dak_50p'] ? building.attributes['h_dak_50p'] : '-';

    return (
        <div id="building-info" className="field has-addons" style={{ zIndex: 1, position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)' }}>
            <div className={`control dropdown is-up ${isActive ? 'is-active' : ''}`}>
                <div className="dropdown-trigger">
                    <button className="button is-warning" aria-haspopup="true" aria-controls="dropdown-menu" onClick={() => setIsActive(!isActive)}>
                        <span className="icon is-small">
                            <MdTableChart />
                        </span>
                        <span className="is-hidden-mobile" style={{marginLeft: '0.5em', marginRight: '0.5em'}}>{t("attributes")}</span>
                        <span className="icon is-small">
                            {isActive ? <MdKeyboardArrowDown /> : <MdKeyboardArrowUp />}
                        </span>
                    </button>
                </div>
                <div className="dropdown-menu" id="dropdown-menu" role="menu" style={{minWidth: '300px'}}>
                    <div className="dropdown-content">
                        <div className="dropdown-item">
                            <div className="table-container" style={{ maxHeight: '350px', overflow: 'scroll' }}>
                                <table className="table is-fullwidth is-striped has-text-left" style={{ marginBottom: '0.75rem' }}>
                                    <thead>
                                        <tr>
                                            <th>{t("attribute")}</th>
                                            <th>{t("value")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>{t("tilenumber")}</td>
                                            <td>
                                                <span className="tag is-primary">
                                                    <span className="icon is-small mr-1">
                                                        <MdDownload />
                                                    </span>
                                                    {building.tileID}
                                                </span>
                                            </td>
                                        </tr>
                                        {attr_names.map(name => (
                                            <tr key={name}>
                                                <td>
                                                    <a target="_blank" href={`https://docs.3dbag.nl/${i18n.language}/schema/attributes/#${name}`}>
                                                        {name}
                                                    </a>
                                                </td>
                                                <td>
                                                    <code style={{ color: 'inherit' }}>{building.attributes[name]}</code>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mb-2">
                                {t("BuildingInfo.attr1")} <a href={`https://docs.3dbag.nl/${i18n.language}/schema/attributes/`}>{t("documentation")}</a>.
                            </p>
                            <p>
                                <a className="tag is-danger" onClick={onReportData}>
                                    {t("viewer.issue")}
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="control">
                <button className="button is-static">
                    <span className="icon is-small mr-1">
                        <MdHeight />
                    </span>
                    <b>{h_clicked}</b> m
                </button>
            </div>
            <div className="control">
                <button className="button is-danger" onClick={onCloseInfo}>
                    <span className="icon is-small">
                        <MdClose />
                    </span>
                </button>
            </div>
        </div>
    );
};
