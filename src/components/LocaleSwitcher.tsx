import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdTranslate } from 'react-icons/md';

export const LocaleSwitcher: React.FC = () => {
    const { i18n } = useTranslation();

    const switchLocale = (locale: string) => {
        i18n.changeLanguage(locale);
    };

    const localeName = (locale: string) => {
        const names: {[key: string]: string} = { "en": "English", "nl": "Nederlands" };
        return names[locale];
    };

    return (
        <div className="navbar-item has-dropdown is-hoverable">
            <a className="navbar-link">
                <span className="icon">
                    <MdTranslate />
                </span>
            </a>
            <div className="navbar-dropdown is-right">
                {['en', 'nl'].map(locale => (
                    <a
                        key={locale}
                        className="navbar-item"
                        onClick={() => switchLocale(locale)}
                    >
                        <span>{localeName(locale)}</span>
                    </a>
                ))}
            </div>
        </div>
    );
};
