import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
// @ts-ignore
import { WMSTilesRenderer, WMTSTilesRenderer } from '../terrain-tiles';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';
import { useLocation } from 'react-router-dom';
import markerSprite from '../assets/locationmarker.png';
import landmarkLocations from '../assets/landmark_locations.json';

// Adjusts the three.js standard shader to include batchid highlight
function batchIdHighlightShaderMixin( shader: any ) {

	const newShader = { ...shader };
	newShader.uniforms = {
		highlightedBatchId: { value: - 1 },
		highlightColor: { value: new THREE.Color( 0xFFC107 ).convertSRGBToLinear() },
		...THREE.UniformsUtils.clone( shader.uniforms ),
	};
	newShader.extensions = {
		derivatives: true,
	};
	newShader.lights = true;
	newShader.fog = true;
	newShader.vertexShader =
		`
			attribute float _batchid;
			varying float batchid;
		` +
		newShader.vertexShader.replace(
			/#include <uv_vertex>/,
			`
			#include <uv_vertex>
			batchid = _batchid;
			`
		);
	newShader.fragmentShader =
		`
			varying float batchid;
			uniform float highlightedBatchId;
			uniform vec3 highlightColor;
		` +
		newShader.fragmentShader.replace(
			/vec4 diffuseColor = vec4\( diffuse, opacity \);/,
			`
			vec4 diffuseColor =
				abs( batchid - highlightedBatchId ) < 0.5 ?
				vec4( highlightColor, opacity ) :
				vec4( diffuse, opacity );
			`
		);

	return newShader;

}

interface ThreeViewerProps {
    tilesUrl?: string;
    basemapOptions?: any;
    onObjectPicked?: (obj: any) => void;
    onCamOffset?: (offset: any) => void;
    onCamRotationZ?: (rot: number) => void;
    onShowLocationBox?: (text: string) => void;
    onHideLocationBox?: () => void;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({
    tilesUrl = 'http://godzilla.bk.tudelft.nl/3dtiles/ZuidHolland/lod13/tileset1.json',
    basemapOptions = {
        type: "wmts",
        options: {
            // Removed 'url' from options to prevent double inclusion in query params
            // The WMTSTilesRenderer seems to iterate over all options and append them
            // We will pass the base URL separately if needed, or rely on the renderer to handle it
            // But looking at the code, it uses options.url as base AND iterates options.
            // So we should probably NOT include 'url' in the options object if we can help it,
            // OR we should fix the renderer. 
            // For now, let's try to fix the URL in the options to NOT include the '?' 
            // and see if that helps, or just remove the 'url' key from the iteration in the renderer (which we can't easily do).
            // Actually, the renderer code does: `if ( k != Object.keys( this.wmtsOptions )[ 0 ] )`
            // It assumes the first key is NOT to be appended? Or something?
            // Let's just disable the basemap for a moment to clear the logs and focus on 3D tiles.
            // url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0?',
            layer: 'standaard',
            style: 'default',
            tileMatrixSet: "EPSG:28992",
            service: "WMTS",
            request: "GetTile",
            version: "1.0.0",
            format: "image/png"
        }
    },
    onObjectPicked,
    onCamRotationZ,
    onShowLocationBox,
    onHideLocationBox
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const dummyCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const tilesRef = useRef<any>(null);
    const terrainTilesRef = useRef<any>(null);
    const offsetParentRef = useRef<THREE.Group | null>(null);
    const sceneTransformRef = useRef<THREE.Vector3 | null>(null);
    const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
    const pointerCasterRef = useRef({ startClientX: 0, startClientY: 0 });
    const requestRef = useRef<number>(0);
    const cameraPositionedRef = useRef(false);
    
    const location = useLocation();
    const needsRerender = useRef(0);

    // Materials
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);
    const highlightMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

    const markerName = "LocationMarker";

    const initScene = () => {
        if (!containerRef.current) return;

        // Renderer
        const renderer = new THREE.WebGLRenderer( { antialias: true } );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( containerRef.current.clientWidth, containerRef.current.clientHeight );
        renderer.setClearColor( 0xf0f0f0 );
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        containerRef.current.appendChild( renderer.domElement );
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color( 0xf0f0f0 );
        // scene.fog = new THREE.FogExp2( 0xeeeeee, 0.0004 );
        sceneRef.current = scene;

        // Camera
        // INCREASED FAR PLANE to 10,000,000 to handle large datasets
        const camera = new THREE.PerspectiveCamera( 50, containerRef.current.clientWidth / containerRef.current.clientHeight, 2, 10000000 );
        camera.position.set( 400, 400, 400 );
        cameraRef.current = camera;

        const dummyCamera = new THREE.PerspectiveCamera( 30, containerRef.current.clientWidth / containerRef.current.clientHeight, 1, 10000000 );
        dummyCameraRef.current = dummyCamera;

        // Controls
        const controls = new OrbitControls( camera, renderer.domElement );
        controls.screenSpacePanning = false;
        controls.minDistance = 1;
        controls.maxDistance = 10000000; // INCREASED MAX DISTANCE
        controls.maxPolarAngle = Math.PI / 2 - 0.1;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controlsRef.current = controls;

        // Lights
        const dirLight = new THREE.DirectionalLight( 0xffffff );
        dirLight.position.set( 0.63, 1, 0 );
        dirLight.intensity = 0.8;
        scene.add( dirLight );

        const ambLight = new THREE.AmbientLight( 0xffffff );
        ambLight.intensity = 0.5;
        scene.add( ambLight );

        const pLight = new THREE.PointLight( 0xffffff );
        pLight.position.set( 0, 0, 0 );
        pLight.intensity = 0.4;
        camera.add( pLight );
        scene.add( camera );

        // Offset Parent
        const offsetParent = new THREE.Group();
        offsetParent.rotation.x = - Math.PI / 2; // Re-enabled rotation
        scene.add( offsetParent );
        offsetParentRef.current = offsetParent;

        // Materials
        const material = new THREE.ShaderMaterial( batchIdHighlightShaderMixin( THREE.ShaderLib.lambert ) );
        // @ts-ignore
        material.extensions.derivatives = true;
        material.defines = material.defines || {};
        material.defines.USE_UV = "";
        material.uniforms.diffuse.value = new THREE.Color( 0xc4c8cf ).convertSRGBToLinear();
        materialRef.current = material;

        const highlightMaterial = new THREE.ShaderMaterial( batchIdHighlightShaderMixin( THREE.ShaderLib.lambert ) );
        // @ts-ignore
        highlightMaterial.extensions.derivatives = true;
        highlightMaterial.defines = highlightMaterial.defines || {};
        highlightMaterial.defines.USE_UV = "";
        highlightMaterial.uniforms.diffuse.value = new THREE.Color( 0xc4c8cf ).convertSRGBToLinear();
        highlightMaterial.uniforms.highlightedBatchId.value = 1;
        highlightMaterialRef.current = highlightMaterial;

        // Events
        window.addEventListener( 'resize', onWindowResize, false );
        renderer.domElement.addEventListener( 'pointermove', onPointerMove, false );
        renderer.domElement.addEventListener( 'pointerdown', onPointerDown, false );
        renderer.domElement.addEventListener( 'pointerup', onPointerUp, false );

        needsRerender.current = 1;
        animate();
    };

    const onWindowResize = () => {
        if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
        cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize( containerRef.current.clientWidth, containerRef.current.clientHeight );
        
        if (dummyCameraRef.current) {
            dummyCameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            dummyCameraRef.current.updateProjectionMatrix();
        }
        
        if (tilesRef.current) {
            tilesRef.current.setResolutionFromRenderer( cameraRef.current, rendererRef.current );
        }
        needsRerender.current = 1;
    };

    const onPointerMove = ( e: PointerEvent ) => {
        if (!containerRef.current) return;
        const bounds = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ( ( e.clientX - bounds.left ) / containerRef.current.clientWidth ) * 2 - 1;
        mouseRef.current.y = - ( ( e.clientY - bounds.top ) / containerRef.current.clientHeight ) * 2 + 1;
    };

    const onPointerDown = ( e: PointerEvent ) => {
        pointerCasterRef.current.startClientX = e.clientX;
        pointerCasterRef.current.startClientY = e.clientY;
    };

    const onPointerUp = ( e: PointerEvent ) => {
        if ( Math.abs( pointerCasterRef.current.startClientX - e.clientX ) < 2 &&
             Math.abs( pointerCasterRef.current.startClientY - e.clientY ) < 2 ) {
            
            // Click logic
            if (onObjectPicked) {
                // Implement raycasting logic here
                // For now, simplified
            }
        }
    };

    const animate = () => {
        requestRef.current = requestAnimationFrame( animate );
        
        if (requestRef.current % 600 === 0) {
            console.log("animate loop running");
            if (cameraRef.current) {
                console.log("Camera Pos:", cameraRef.current.position);
            }
            if (controlsRef.current) {
                console.log("Controls Target:", controlsRef.current.target);
            }
            if (rendererRef.current) {
                console.log("Render Info:", rendererRef.current.info.render);
            }
            if (sceneRef.current) {
                console.log("Scene Children:", sceneRef.current.children.length);
            }
            if (tilesRef.current) {
                console.log("Tiles Stats:", tilesRef.current.stats);
                if (tilesRef.current.root) {
                    console.log("Tiles Root exists in animate");
                    // @ts-ignore
                    console.log("Root inFrustum:", tilesRef.current.root.cached.inFrustum);
                    // @ts-ignore
                    console.log("Root Distance:", tilesRef.current.root.cached.distance);
                    // @ts-ignore
                    console.log("Root SSE:", tilesRef.current.root.cached.screenSpaceError);
                } else {
                    console.log("Tiles Root is MISSING in animate");
                }
            }
        }

        // Force update matrix world of offset parent to ensure rotation is applied
        if (offsetParentRef.current) {
            offsetParentRef.current.updateMatrixWorld(true);
        }

        if (controlsRef.current) controlsRef.current.update();
        TWEEN.update();

        if (cameraRef.current && dummyCameraRef.current) {
            dummyCameraRef.current.position.copy( cameraRef.current.position );
            dummyCameraRef.current.quaternion.copy( cameraRef.current.quaternion );
            dummyCameraRef.current.updateMatrixWorld();
        }

        if (tilesRef.current) {
            tilesRef.current.update();
        }

        // Fallback: If tiles are loaded but camera not positioned, do it now
        if (tilesRef.current && tilesRef.current.root) {
            const root = tilesRef.current.root;
            
            // FIX: Ensure cached sphere exists so renderer can work
            // @ts-ignore
            if (!root.cached.sphere && root.boundingVolume && root.boundingVolume.box) {
                console.log("Fixing missing root sphere...");
                const box = root.boundingVolume.box;
                const center = new THREE.Vector3(box[0], box[1], box[2]);
                // Approximate radius from box extents (box[3]..box[11] are basis vectors)
                const xVector = new THREE.Vector3(box[3], box[4], box[5]);
                const yVector = new THREE.Vector3(box[6], box[7], box[8]);
                const zVector = new THREE.Vector3(box[9], box[10], box[11]);
                const radius = Math.max(xVector.length(), yVector.length(), zVector.length());
                
                // @ts-ignore
                root.cached.sphere = new THREE.Sphere(center, radius);
                console.log("Fixed Root Sphere:", center, radius);
            }

            if (!cameraPositionedRef.current) {
            
            // Try to get center/radius from cached sphere OR manual box parsing
            let center: THREE.Vector3 | null = null;
            let radius: number = 0;

            if (root.cached && root.cached.sphere) {
                const sphere = root.cached.sphere.clone();
                // const sphere = new THREE.Sphere();
                // sphere.copy(root.cached.sphere); // Correct way if not cloning
                
                if (sphere.radius > 0) {
                    center = sphere.center.clone();
                    radius = sphere.radius;
                    console.log("Fallback: Using Cached Sphere", center, radius);
                }
            } else if (root.boundingVolume && root.boundingVolume.box) {
                // Manual Box Parsing
                const box = root.boundingVolume.box;
                const boxCenter = new THREE.Vector3(box[0], box[1], box[2]);
                const xAxis = new THREE.Vector3(box[3], box[4], box[5]);
                const yAxis = new THREE.Vector3(box[6], box[7], box[8]);
                const zAxis = new THREE.Vector3(box[9], box[10], box[11]);
                
                // Apply Root Transform if it exists
                if (root.transform) {
                    const transformMatrix = new THREE.Matrix4().fromArray(root.transform);
                    boxCenter.applyMatrix4(transformMatrix);
                }

                center = boxCenter;
                radius = Math.max(xAxis.length(), yAxis.length(), zAxis.length()) * 2; // Rough radius
                console.log("Fallback: Using Manual Box Parsing");
            }

            if (center && radius > 0) {
                console.log("Fallback Root Center (Local to Group):", center);
                console.log("Fallback Root Radius:", radius);

                // Convert to World Space (taking offsetParent into account)
                const worldCenter = center.clone();
                
                // Apply Root Transform if it exists
                if (root.transform) {
                     const transformMatrix = new THREE.Matrix4().fromArray(root.transform);
                     // Check if center is still near 0,0,0 (local) while transform has large values
                     if (worldCenter.length() < 10000 && transformMatrix.elements[12] > 10000) {
                         console.log("Applying Root Transform to Center...");
                         worldCenter.applyMatrix4(transformMatrix);
                     }
                }

                // Apply Offset Parent Rotation/Transform
                if (offsetParentRef.current) {
                    // Ensure matrix is updated
                    offsetParentRef.current.updateMatrixWorld(true);
                    worldCenter.applyMatrix4(offsetParentRef.current.matrixWorld);
                }
                console.log("Fallback Root Center (World):", worldCenter);

                // Position camera to see the whole set
                // Move camera back by 2x radius to ensure visibility
                // We move along Z and Y in world space to look down/forward
                
                // FIX: The root tile is the entire Netherlands. 
                // If we zoom out to see it all, we are 400km high and get 400 errors from WMTS.
                // Instead, let's default to Amsterdam Central Station if the radius is huge.
                
                let target = worldCenter;
                let dist = radius * 1.5;

                if (radius > 50000) {
                    console.log("Root radius is huge (Country scale). Defaulting to Amsterdam.");
                    // Amsterdam Central Station RD Coordinates
                    // X: 121500, Y: 487500
                    // World: X: 121500, Z: -487500
                    target = new THREE.Vector3(121500, 0, -487500);
                    
                    // Apply offset parent transform if needed (usually just rotation)
                    if (offsetParentRef.current) {
                        // We constructed World Coords directly, but if offsetParent has translation/scale...
                        // Actually offsetParent only has rotation X = -90.
                        // Our World Z = -RD Y is correct for that rotation.
                        // But wait, if we add this point to the scene which is rotated...
                        // The camera is in World Space (outside the rotated group).
                        // So we just need the World Coordinates.
                        // World X = RD X
                        // World Y = 0 (Ground)
                        // World Z = -RD Y
                    }
                    
                    dist = 2000; // 2km altitude
                }

                // Since we rotated -90 deg X, Y is UP, Z is South.
                // We want to be UP (Y) and South (Z)
                const camPos = target.clone().add(new THREE.Vector3(0, dist, dist));
                
                if (cameraRef.current && controlsRef.current) {
                    cameraRef.current.position.copy(camPos);
                    controlsRef.current.target.copy(target);
                    controlsRef.current.update();
                    
                    // Update dummy camera for tiles renderer
                    if (dummyCameraRef.current) {
                        dummyCameraRef.current.position.copy(camPos);
                        dummyCameraRef.current.lookAt(worldCenter);
                        dummyCameraRef.current.updateMatrixWorld();
                    }

                    console.log("Fallback: Camera moved to:", camPos);
                }

                // Add Debug Sphere at Root Center (World Space)
                if (sceneRef.current) {
                    // Remove old debug sphere
                    const oldSphere = sceneRef.current.getObjectByName("RootDebugSphere");
                    if (oldSphere) sceneRef.current.remove(oldSphere);

                    // const debugGeo = new THREE.SphereGeometry(radius / 10, 32, 32);
                    // const debugMat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
                    // const debugSphere = new THREE.Mesh(debugGeo, debugMat);
                    // debugSphere.position.copy(worldCenter);
                    // debugSphere.name = "RootDebugSphere";
                    // sceneRef.current.add(debugSphere);
                    // console.log("Added Debug Sphere at World Center");
                    
                    // Add a HUGE red box to verify scene is rendering anything at all
                    // const boxGeo = new THREE.BoxGeometry(radius/2, radius/2, radius/2);
                    // const boxMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                    // const box = new THREE.Mesh(boxGeo, boxMat);
                    // box.position.copy(worldCenter);
                    // sceneRef.current.add(box);
                }

                cameraPositionedRef.current = true;
                reinitBasemap();
            } else {
                if (requestRef.current % 60 === 0) {
                    console.log("Fallback: Root exists but waiting for bounds...", root);
                }
            }
        }
        } // Close the outer if (tilesRef.current && tilesRef.current.root)

        if (terrainTilesRef.current && sceneTransformRef.current && cameraRef.current) {
            terrainTilesRef.current.update(sceneTransformRef.current, cameraRef.current);
        }

        if (needsRerender.current > 0) {
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render( sceneRef.current, cameraRef.current );
            }
            needsRerender.current--;
        }
        
        if (onCamRotationZ && cameraRef.current) {
            onCamRotationZ(cameraRef.current.rotation.z);
        }
    };

    const reinitTiles = (init: boolean) => {
        console.log("reinitTiles called with url:", tilesUrl);
        cameraPositionedRef.current = false; // Reset flag
        if (!offsetParentRef.current || !rendererRef.current || !dummyCameraRef.current) {
            console.error("Missing refs in reinitTiles");
            return;
        }

        if (tilesRef.current) {
            if (tilesRef.current.dispose) tilesRef.current.dispose();
            offsetParentRef.current.remove(tilesRef.current.group);
        }

        const tiles = new TilesRenderer( tilesUrl );
        tiles.fetchOptions = { mode: 'cors' };
        // tiles.group.rotation.x = - Math.PI / 2;
        tiles.displayBoxBounds = false;
        tiles.colorMode = 7; // BatchID
        tiles.lruCache.minSize = 85;
        tiles.lruCache.maxSize = 115;
        tiles.errorTarget = 6;
        // tiles.errorThreshold = 60;
        tiles.loadSiblings = false;
        tiles.maxDepth = 15;
        tiles.showEmptyTiles = true;
        
        // @ts-ignore
        // tiles.downloadQueue.priorityCallback = tile => 1 / tile.cached.distance;

        tiles.setCamera( cameraRef.current );
        tiles.setResolutionFromRenderer( cameraRef.current, rendererRef.current );

        tiles.onLoadTileSet = () => {
            console.log("onLoadTileSet fired (root ready)");
            if (init && !cameraPositionedRef.current) {
                const q = new URLSearchParams(location.search);
                if (q.has("rdx") && q.has("rdy")) {
                    setCameraPosFromRoute(q);
                } else {
                    // Random landmark
                    const keys = Object.keys(landmarkLocations);
                    const landmark = (landmarkLocations as any)[keys[keys.length * Math.random() << 0]];
                    
                    if (onShowLocationBox) onShowLocationBox(landmark.name);
                    
                    setCameraPosFromRoute(new URLSearchParams({
                        rdx: landmark.rdx,
                        rdy: landmark.rdy,
                        ox: landmark.ox,
                        oy: landmark.oy,
                        oz: landmark.oz
                    }));

                    setTimeout(() => {
                        if (onHideLocationBox) onHideLocationBox();
                    }, 10000);
                }
                cameraPositionedRef.current = true;
            }
            
            if (tiles.root) {
                console.log("Tiles root exists, initializing basemap");
                
                // Calculate Root Center
                const sphere = new THREE.Sphere();
                tiles.root.cached.sphere.copy(sphere); // Get bounding sphere
                
                console.log("Root Sphere Center (Local):", sphere.center);
                console.log("Root Sphere Radius:", sphere.radius);

                // Position Camera at Root Center + Offset
                if (init && !cameraPositionedRef.current) {
                    // We ignore the route params for a moment to ensure we see the data
                    const center = sphere.center;
                    const radius = sphere.radius;
                    
                    // Position camera to see the whole set
                    const dist = radius * 2;
                    const camPos = new THREE.Vector3(center.x, center.y + dist, center.z + dist);
                    
                    if (cameraRef.current && controlsRef.current) {
                        cameraRef.current.position.copy(camPos);
                        controlsRef.current.target.copy(center);
                        controlsRef.current.update();
                        console.log("Forced Camera to Root Center:", center);
                    }

                    // Add Debug Sphere at Root Center
                    if (offsetParentRef.current) {
                        const debugGeo = new THREE.SphereGeometry(radius / 10, 32, 32);
                        const debugMat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
                        const debugSphere = new THREE.Mesh(debugGeo, debugMat);
                        debugSphere.position.copy(center);
                        debugSphere.name = "RootDebugSphere";
                        offsetParentRef.current.add(debugSphere);
                        console.log("Added Root Debug Sphere at:", center);
                    }
                    
                    cameraPositionedRef.current = true;
                }

                reinitBasemap();
            } else {
                console.warn("Tiles root is missing in onLoadTileSet");
            }
            needsRerender.current = 2;
        };

        tiles.onLoadModel = (s: any) => {
            console.log("onLoadModel fired");
            s.traverse((c: any) => {
                if (c.material) {
                    // c.material.dispose();
                    // c.material = materialRef.current;
                    if (c.geometry) c.geometry.computeBoundingBox();
                }
            });
            needsRerender.current = 1;
        };

        tiles.onLoadTileStart = (tile: any) => {
            console.log("onLoadTileStart", tile?.metadata?.url || tile?.url);
        };

        tiles.onLoadTileError = (tile: any, error: any) => {
            console.error("onLoadTileError", tile?.metadata?.url || tile?.url, error);
        };

        tiles.onLoadTileSuccess = (tile: any) => {
            console.log("onLoadTileSuccess", tile?.metadata?.url || tile?.url);
        };

        offsetParentRef.current.add(tiles.group);
        tilesRef.current = tiles;
    };

    const reinitBasemap = () => {
        console.log("reinitBasemap called");
        if (!offsetParentRef.current || !tilesRef.current || !tilesRef.current.root) {
            console.log("reinitBasemap aborted: missing refs or root");
            return;
        }
        
        if (terrainTilesRef.current) {
            offsetParentRef.current.remove(terrainTilesRef.current.group);
        }

        const transform = tilesRef.current.root.cached.transform;
        // We need to pass the tileset offset to the basemap renderer so it can calculate the correct RD coordinates
        // transform.elements[12] is Offset X (RD X)
        // transform.elements[13] is Offset Y (RD Y)
        const sceneTransform = new THREE.Vector3( transform.elements[ 12 ], transform.elements[ 13 ], 0 );
        sceneTransformRef.current = sceneTransform;

        if (basemapOptions.type === "wms") {
            const { url, layer, style } = basemapOptions.options;
            terrainTilesRef.current = new WMSTilesRenderer(url, layer, style);
        } else if (basemapOptions.type === "wmts") {
            terrainTilesRef.current = new WMTSTilesRenderer(basemapOptions.options, () => { needsRerender.current = 1; });
        }

        if (terrainTilesRef.current) {
            // terrainTilesRef.current.init(sceneRef.current);
            offsetParentRef.current.add(terrainTilesRef.current.group);
        }
        needsRerender.current = 1;
    };

    const setCameraPosFromRoute = (q: URLSearchParams) => {
        if (!tilesRef.current || !tilesRef.current.root || !controlsRef.current || !cameraRef.current) return;

        const rdx = parseFloat(q.get("rdx") || "0");
        const rdy = parseFloat(q.get("rdy") || "0");
        const ox = parseFloat(q.get("ox") || "400");
        const oy = parseFloat(q.get("oy") || "400");
        const oz = parseFloat(q.get("oz") || "400");

        if (isNaN(rdx)) return;

        const transform = tilesRef.current.root.cached.transform;
        const tileset_offset_x = transform.elements[ 12 ];
        const tileset_offset_y = transform.elements[ 13 ];
        
        console.log("Tileset Transform:", transform.elements);
        console.log("Tileset Offset X:", tileset_offset_x, "Y:", tileset_offset_y);

        const local_x = rdx - tileset_offset_x;
        const local_y = 0;
        const local_z = - ( rdy - tileset_offset_y );

        console.log("Target RD:", rdx, rdy);
        console.log("Calculated Local:", local_x, local_y, local_z);

        controlsRef.current.target.x = local_x;
        controlsRef.current.target.z = local_z;
        cameraRef.current.position.x = local_x + ox;
        cameraRef.current.position.y = local_y + oy;
        cameraRef.current.position.z = local_z + oz;
        
        controlsRef.current.update();

        // Debug Cube
        if (sceneRef.current) {
            // Remove old debug objects if they exist
            const oldCube = sceneRef.current.getObjectByName("DebugCube");
            if (oldCube) sceneRef.current.remove(oldCube);
            const oldAxes = sceneRef.current.getObjectByName("DebugAxes");
            if (oldAxes) sceneRef.current.remove(oldAxes);
            const oldGrid = sceneRef.current.getObjectByName("DebugGrid");
            if (oldGrid) sceneRef.current.remove(oldGrid);

            // 1. Solid Red Cube at Target (100m size)
            // const geom = new THREE.BoxGeometry(100, 100, 100); 
            // const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            // const cube = new THREE.Mesh(geom, mat);
            // cube.name = "DebugCube";
            // cube.position.set(local_x, local_y, local_z);
            // sceneRef.current.add(cube);
            
            // 2. Axes Helper at Target
            // const axes = new THREE.AxesHelper(500);
            // axes.name = "DebugAxes";
            // axes.position.set(local_x, local_y, local_z);
            // sceneRef.current.add(axes);

            // 3. Grid Helper at Target (Ground)
            // const grid = new THREE.GridHelper(2000, 20);
            // grid.name = "DebugGrid";
            // grid.position.set(local_x, local_y, local_z);
            // sceneRef.current.add(grid);

            // console.log("Added debug cube, axes, and grid at:", local_x, local_y, local_z);
        }
        
        if (q.get("placeMarker") === "true") {
            placeMarkerOnPoint(new THREE.Vector3(local_x, local_y, local_z));
        }
    };

    const placeMarkerOnPoint = (position: THREE.Vector3) => {
        if (!sceneRef.current) return;
        
        const existingMarker = sceneRef.current.getObjectByName(markerName);
        if (existingMarker) sceneRef.current.remove(existingMarker);

        const textureLoader = new THREE.TextureLoader();
        const map = textureLoader.load(markerSprite);
        const material = new THREE.SpriteMaterial({ map: map });
        const sprite = new THREE.Sprite(material);

        material.depthWrite = false;
        material.depthTest = false;
        material.sizeAttenuation = false;

        sprite.position.set(position.x, position.y, position.z);
        sprite.scale.set(0.04, 0.10, 1);
        sprite.name = markerName;

        sceneRef.current.add(sprite);
        needsRerender.current = 1;
    };

    useEffect(() => {
        initScene();
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            window.removeEventListener( 'resize', onWindowResize );
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }
        };
    }, []);

    useEffect(() => {
        reinitTiles(true);
        return () => {
            if (tilesRef.current) {
                if (offsetParentRef.current) offsetParentRef.current.remove(tilesRef.current.group);
                if (tilesRef.current.dispose) tilesRef.current.dispose();
            }
        };
    }, [tilesUrl]);

    useEffect(() => {
        reinitBasemap();
        return () => {
            if (terrainTilesRef.current && offsetParentRef.current) {
                offsetParentRef.current.remove(terrainTilesRef.current.group);
                if (terrainTilesRef.current.dispose) terrainTilesRef.current.dispose();
            }
        };
    }, [basemapOptions]);

    return <div id="canvas" ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />;
};
