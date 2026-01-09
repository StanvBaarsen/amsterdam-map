import {
	Texture,
	PlaneGeometry,
	MeshBasicMaterial,
	Mesh,
	Group,
	LinearFilter
} from 'three';

import {
	ResourceTracker
} from './ResourceTracker.js';

import {
	arrayBuffer2Base64
} from './ArrayBuffer2Base64.js';

export class TilesRenderer {

	constructor() {

		this.tileLevel = 0;

		this.resFactor = 4.5; // Adjusted to 8.0 as requested

		this.tileMatrixLevels = null;
		this.activeTiles = new Set();
		this.downloadQueue = new Map();
        this.pendingFetches = 0;
        this.maxConcurrentFetches = 10;
        this.fetchQueue = [];

		this.tilesInView = null;

		this.group = new Group();
		this.resourceTracker = new ResourceTracker();
		this.track = this.resourceTracker.track.bind( this.resourceTracker );
		this.needsTileLevelClean = false;

		this.onLoadTile = null;

		this.tempMaterial = new MeshBasicMaterial( { color: 0xFFFFFF, side: 2 } ); // DoubleSide
		this.tempMaterial.depthWrite = false;

	}

	update( sceneCenter, camera ) {

		// Get indices of all tiles that are in view
		const tiles = this.tileScheme.getTilesInView( camera, this.resFactor, sceneCenter );
		this.tilesInView = tiles;

		// check if we just changed tileLevel
		if ( tiles.length && tiles[ 0 ].tileMatrix.level != this.tileLevel ) {

			this.abortDownloads();
			this.changeRenderOrder();
			this.needsTileLevelClean = true;
			this.tileLevel = tiles[ 0 ].tileMatrix.level;

		} else {

			// Cancel pending tile downloads that are not in view anymore
			setTimeout( () => {

				var tidsInView = new Set();
				this.tilesInView.forEach( function ( ti ) {

					tidsInView.add( ti.getId() );

				} );

				for ( let [ tid, abortCtrl ] of this.downloadQueue.entries() ) {

					if ( ! tidsInView.has( tid ) ) {

						abortCtrl.abort();

					}

				}

                // Memory Cleanup: Prune tiles that are no longer in view
                // This prevents infinite accumulation of tiles during long sessions (e.g. storylines)
                const MAX_ACTIVE_TILES = 50;
                if (this.activeTiles.size > MAX_ACTIVE_TILES) {
                    for ( let i = this.group.children.length - 1; i >= 0; i-- ) {
                        const child = this.group.children[i];
                        // Only remove if it has a tileId (managed by us) and is not visible
                        if (child.userData.tileId && !tidsInView.has(child.userData.tileId)) {
                             // Also ensure we don't remove tiles from other levels if they are being handled by cleanTileLevels?
                             // No, cleanTileLevels handles cross-level. 
                             // But actually if we are simply panning, tileLevel is constant.
                             // So we just check tileId.
                             
                             this.group.remove(child);
                             this.resourceTracker.untrack(child);
                             this.activeTiles.delete(child.userData.tileId);
                        }
                    }
                }

			} );

		}

		// Create tiles that hadn't been created yet
		tiles.forEach( function ( ti ) {

			// Check bounds
			if ( ti.col < 0 || ti.col >= ti.tileMatrix.matrixWidth || ti.row < 0 || ti.row >= ti.tileMatrix.matrixHeight ) {
				return;
			}

			const tileId = ti.getId();

			if ( ! this.activeTiles.has( tileId ) ) {

				this.activeTiles.add( tileId );

				this.createTile( ti, sceneCenter );

			}

		}, this );

		if ( this.needsTileLevelClean && this.downloadQueue.size == 0 ) {

			this.cleanTileLevels();

		}

	}

	changeRenderOrder() {

		for ( let i = this.group.children.length - 1; i > 0; i -- ) {

			if ( this.group.children[ i ].name != this.tileLevel ) {

				// Place tiles of old tileLevel above temporary (white) tiles, but underneath fully loaded tiles of new tileLevel
				this.group.children[ i ].renderOrder = -2;

			}

		}

	}

	abortDownloads() {

		for ( let abortCtrl of this.downloadQueue.values() ) {

			abortCtrl.abort();

		}

		this.downloadQueue.clear();
        this.fetchQueue = []; // Clear pending fetches

	}

	cleanTileLevels() {

		this.needsOldTileLevelClean = false;
		const scope = this;

		for ( let i = this.group.children.length - 1; i > 0; i -- ) {

			if ( this.group.children[ i ].name != this.tileLevel ) {

				this.group.remove( this.group.children[ i ] );
				this.resourceTracker.untrack( this.group.children[ i ] );

			}

		}

		this.activeTiles.forEach( function ( tile ) {

			if ( tile.split( "-" )[ 0 ] != scope.tileLevel ) {

				scope.activeTiles.delete( tile );

			}

		} );

	}

	getRequestURL( tile ) {

	}

	createTile( tile, transform ) {

		var geometry = this.track( new PlaneGeometry( tile.tileMatrix.tileSpanX, tile.tileMatrix.tileSpanY ) );

		var mesh = new Mesh( geometry, this.tempMaterial );
		mesh.name = this.tileLevel;
        mesh.userData.tileId = tile.getId();
		// The temporary (white) tiles on the bottom
		mesh.renderOrder = -3;
		this.group.add( mesh );

		const scenePosition = tile.getCenterPosition( transform );
		mesh.position.set( scenePosition.x, scenePosition.y, scenePosition.z );
		mesh.updateMatrix();

		const requestURL = this.getRequestURL( tile );

		const scope = this;
		const tileId = tile.getId();
		var controller = new AbortController();
		var signal = controller.signal;
		this.downloadQueue.set( tileId, controller );

        const fetchTile = () => {
            this.pendingFetches++;
            fetch( requestURL, { signal } ).then( function ( res ) {

                if (!res.ok) {
                    throw new Error(`Failed to load tile: ${res.status} ${res.statusText}`);
                }
                return res.arrayBuffer();

            } ).then( function ( buffer ) {

                scope.downloadQueue.delete( tileId );
                scope.pendingFetches--;
                scope.processFetchQueue();

                // Place tiles of new/current tile level with loaded texture completely on top
                mesh.renderOrder = -1;

                const tex = new Texture();
                var image = new Image();
                image.src = 'data:image/png;base64,' + arrayBuffer2Base64( buffer );
                image.onload = function () {

                    // console.log("Texture loaded for tile:", tileId);
                    tex.image = image;
                    tex.magFilter = LinearFilter;
                    tex.minFilter = LinearFilter;
                    tex.generateMipmaps = false;
                    tex.needsUpdate = true;
                    tex.colorSpace = 'srgb'; // Use srgb color space
                    var material = new MeshBasicMaterial( { map: scope.track( tex ), side: 2 } ); // DoubleSide
                    material.depthWrite = false;
                    mesh.material = material;
                    if (scope.onLoadTile) scope.onLoadTile();

                };
                
                image.onerror = function(err) {
                    // Suppress texture load errors for cancelled/invalid tiles
                    // console.error("Texture load error for tile:", tileId, err);
                };

            } ).catch( function ( e ) {
                
                // console.warn("Tile fetch failed:", tileId, e.message);

                // we end up here if abort() is called on the Abortcontroller attached to this tile, or if fetch fails
                scope.downloadQueue.delete( tileId );
                scope.activeTiles.delete( tileId );
                scope.resourceTracker.untrack( geometry );
                scope.pendingFetches--;
                scope.processFetchQueue();

            } );
        };

        if (this.pendingFetches < this.maxConcurrentFetches) {
            fetchTile();
        } else {
            this.fetchQueue.push(fetchTile);
        }

	}

    processFetchQueue() {
        if (this.fetchQueue.length > 0 && this.pendingFetches < this.maxConcurrentFetches) {
            const nextFetch = this.fetchQueue.shift();
            nextFetch();
        }
    }

	dispose() {
		this.abortDownloads();
		this.resourceTracker.dispose();
		this.group.clear();
	}

}
