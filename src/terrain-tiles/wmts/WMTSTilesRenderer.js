import {
	TilesRenderer
} from '../base/TilesRenderer.js';


import {
	WMTSTileScheme
} from './WMTSTileScheme.js';

export class WMTSTilesRenderer extends TilesRenderer {

	constructor( wmtsOptions, onLoadTileScheme = null ) {

		super();

		this.format = wmtsOptions.format;
		this.request = wmtsOptions.request;
		this.service = wmtsOptions.service;
		this.tileMatrixSet = wmtsOptions.tileMatrixSet;
		this.url = wmtsOptions.url;

		this.wmtsOptions = wmtsOptions;

		this.tileScheme = new WMTSTileScheme( this.url, this.tileMatrixSet, onLoadTileScheme );
        this.onLoadTile = onLoadTileScheme;

	}

	getRequestURL( tile ) {

        if (this.wmtsOptions.template) {
            let url = this.wmtsOptions.template;
            const level = tile.tileMatrix.level;
            const levelStr = level < 10 ? `0${level}` : `${level}`;
            
            url = url.replace('{TileMatrix}', levelStr);
            url = url.replace('{TileCol}', tile.col.toString());
            url = url.replace('{TileRow}', tile.row.toString());
            return url;
        }

		let requestURL = this.url;
        if (requestURL.indexOf('?') === -1) {
            requestURL += '?';
        }

		for ( const [ k, v ] of Object.entries( this.wmtsOptions ) ) {
            if (k === 'url') continue;

            if (!requestURL.endsWith('?') && !requestURL.endsWith('&')) {
				requestURL += "&";
			}

			requestURL += k + "=" + v;

		}

        if (!requestURL.endsWith('?') && !requestURL.endsWith('&')) {
            requestURL += "&";
        }

		requestURL += "TileCol=" + tile.col.toString();
		requestURL += "&TileRow=" + tile.row.toString();
		requestURL += "&tileMatrix=" + tile.tileMatrix.level.toString();

		return requestURL;

	}

}
