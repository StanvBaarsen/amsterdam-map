import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// @ts-ignore
import { WMSTilesRenderer, WMTSTilesRenderer } from '../terrain-tiles';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';
import { useLocation } from 'react-router-dom';
import markerSprite from '../assets/locationmarker.png';
import landmarkLocations from '../assets/landmark_locations.json';

// Adjusts the three.js standard shader to include batchid highlight
// function batchIdHighlightShaderMixin( shader: any ) {
// 
// 	const newShader = { ...shader };
// 	newShader.uniforms = {
// 		highlightedBatchId: { value: - 1 },
// 		highlightColor: { value: new THREE.Color( 0x00FF00 ).convertSRGBToLinear() }, // DEBUG: Green
// 		...THREE.UniformsUtils.clone( shader.uniforms ),
// 	};
// 	newShader.extensions = {
// 		derivatives: true,
// 	};
// 	newShader.lights = true;
// 	newShader.fog = true;
// 	newShader.vertexShader =
// 		`
// 			attribute float _batchid;
// 			varying float batchid;
// 		` +
// 		newShader.vertexShader.replace(
// 			/#include <uv_vertex>/,
// 			`
// 			#include <uv_vertex>
// 			batchid = _batchid;
// 			`
// 		);
// 	newShader.fragmentShader =
// 		`
// 			varying float batchid;
// 			uniform float highlightedBatchId;
// 			uniform vec3 highlightColor;
// 		` +
// 		newShader.fragmentShader.replace(
// 			/vec4 diffuseColor = vec4\( diffuse, opacity \);/,
// 			`
// 			vec4 diffuseColor =
// 				abs( batchid - highlightedBatchId ) < 0.5 ?
// 				vec4( highlightColor, opacity ) :
// 				vec4( diffuse, opacity );
// 			`
// 		);
// 
// 	return newShader;
// 
// }

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
    tilesUrl = 'https://data.3dbag.nl/v20250903/3dtiles/lod22/tileset.json',
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
    // onHideLocationBox
}) => {
    // const boxRef = useRef<THREE.Box3>(new THREE.Box3());
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
    const tilesCentered = useRef(false);
    
    const location = useLocation();
    const needsRerender = useRef(0);

    // Materials
    const materialRef = useRef<THREE.Material | null>(null);
    const highlightMaterialRef = useRef<THREE.Material | null>(null);

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
        controls.maxDistance = 4000; // Limit max zoom out to 2km
        controls.maxPolarAngle = 0.8; // Matched reference implementation
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
        controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        controls.addEventListener( 'change', () => { 
            needsRerender.current = 1; 

            // Constrain to Amsterdam
            if (tilesCentered.current && tilesRef.current) {
                const groupPos = tilesRef.current.group.position;
                const target = controls.target;
                
                // Amsterdam Bounds (RD)
                // Tighter bounds for Amsterdam area (approx 4km radius from Central Station)
                const minRDX = 119000;
                const maxRDX = 124000;
                const minRDY = 484500;
                const maxRDY = 488000;
                
                // Calculate current RD from target
                // world_x = rdx + groupPos.x
                // world_z = -(rdy + groupPos.y)
                const currentRDX = target.x - groupPos.x;
                const currentRDY = -target.z - groupPos.y;
                
                let clampedRDX = Math.max(minRDX, Math.min(maxRDX, currentRDX));
                let clampedRDY = Math.max(minRDY, Math.min(maxRDY, currentRDY));
                
                if (clampedRDX !== currentRDX || clampedRDY !== currentRDY) {
                    // Convert back to World
                    const newWorldX = clampedRDX + groupPos.x;
                    const newWorldZ = -(clampedRDY + groupPos.y);
                    
                    controls.target.x = newWorldX;
                    controls.target.z = newWorldZ;
                    
                    // Also adjust camera position to maintain offset?
                    // If we just clamp target, the camera might "slide" relative to target if we don't move camera too.
                    // But OrbitControls handles camera position relative to target.
                    // If we move target, OrbitControls might jump?
                    // Actually, modifying target inside 'change' event might be tricky.
                    // But let's try.
                    
                    // We also need to clamp the camera position so it doesn't drift away?
                    // No, OrbitControls updates camera based on target.
                    // If we force target back, the camera should follow?
                    // Let's see.
                    const offset = camera.position.clone().sub(target);
                    camera.position.copy(new THREE.Vector3(newWorldX, target.y, newWorldZ).add(offset));
                }
            }
        } );
        controlsRef.current = controls;

        // Lights
        const dirLight = new THREE.DirectionalLight( 0xffffff );
        dirLight.position.set( 0.63, 1, 0 );
        dirLight.intensity = 1.2;
        scene.add( dirLight );

        const ambLight = new THREE.AmbientLight( 0xffffff );
        ambLight.intensity = 0.8;
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
        // Use a standard material first to ensure we can control the appearance
        const material = new THREE.MeshLambertMaterial({ color: 0xff4444 }); // Clean light blue
        materialRef.current = material;

        const highlightMaterial = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
        highlightMaterialRef.current = highlightMaterial;

        // Events
        window.addEventListener( 'resize', onWindowResize, false );
        renderer.domElement.addEventListener( 'pointermove', onPointerMove, false );
        renderer.domElement.addEventListener( 'pointerdown', onPointerDown, false );
        renderer.domElement.addEventListener( 'pointerup', onPointerUp, false );

        console.log("initScene completed, starting animate loop");
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
        
        if (requestRef.current % 60 === 0) {
            console.log("animate loop running. Tiles root:", tilesRef.current?.root ? "Exists" : "Missing");
            if (tilesRef.current && tilesRef.current.root) {
                 const root = tilesRef.current.root;
                 // @ts-ignore
                 if (root.cached && root.cached.sphere) {
                     // @ts-ignore
                     const sphere = root.cached.sphere;
                     
                     // Calculate World Position of the Sphere Center
                     const worldCenter = sphere.center.clone();
                     if (offsetParentRef.current) {
                         worldCenter.applyMatrix4(offsetParentRef.current.matrixWorld);
                     }

                     console.log("Debug Info:", {
                         sphereCenterLocal: sphere.center,
                         sphereRadius: sphere.radius,
                         sphereCenterWorld: worldCenter,
                         cameraPos: cameraRef.current?.position,
                         cameraTarget: controlsRef.current?.target,
                         transform: root.cached.transform
                     });

                     // Force Camera to Center of Sphere (0,0,0) if we haven't yet
                     // This overrides the route logic for debugging
                     /*
                     if (requestRef.current % 600 === 0) { // Every 10 seconds force it back to check
                         console.log("DEBUG: Forcing Camera to Sphere Center (0,0,0) Local");
                     }
                     */
                 }
            }
            
            if (tilesRef.current) {
                 console.log("Stats:", {
                     downloading: tilesRef.current.stats.downloading,
                     failed: tilesRef.current.stats.failed,
                     parsing: tilesRef.current.stats.parsing,
                     visible: tilesRef.current.stats.visible
                 });
            }
        }

        // Force update matrix world of offset parent to ensure rotation is applied
        if (offsetParentRef.current) {
            offsetParentRef.current.updateMatrixWorld(true);
        }

        if (controlsRef.current) controlsRef.current.update();
        TWEEN.update();

        if (cameraRef.current && dummyCameraRef.current) {
            dummyCameraRef.current.matrixWorld.copy( cameraRef.current.matrixWorld );
            dummyCameraRef.current.position.copy( cameraRef.current.position );
            dummyCameraRef.current.quaternion.copy( cameraRef.current.quaternion );
            dummyCameraRef.current.scale.copy( cameraRef.current.scale );
            dummyCameraRef.current.updateMatrixWorld();
        }

        if (tilesRef.current) {
            tilesRef.current.update();
            
            // Force material update on every frame to ensure new tiles get the material
            // This is a bit expensive but ensures consistency for now
            tilesRef.current.forEachLoadedModel((scene: THREE.Object3D) => {
                scene.traverse((c: any) => {
                    if (c.isMesh && c.material !== materialRef.current && c.material !== highlightMaterialRef.current) {
                        c.material = materialRef.current;
                    }
                });
            });

            // Center the tileset using root sphere
            if (!tilesCentered.current && tilesRef.current.root) {
                const root = tilesRef.current.root;
                // @ts-ignore
                if (root.cached && root.cached.sphere) {
                    // @ts-ignore
                    const sphere = root.cached.sphere;
                    
                    // Calculate the true center including transform
                    const center = sphere.center.clone();
                    if (root.transform) {
                        const transform = new THREE.Matrix4().fromArray(root.transform);
                        center.applyMatrix4(transform);
                    } else if (root.cached.transform) {
                         // Fallback if transform is stored in cached
                         // Note: cached.transform might be a Matrix4 already or array
                         const t = root.cached.transform;
                         if (t.elements) {
                             center.applyMatrix4(t);
                         } else if (t.length === 16) {
                             const transform = new THREE.Matrix4().fromArray(t);
                             center.applyMatrix4(transform);
                         }
                    }

                    tilesRef.current.group.position.copy(center).multiplyScalar(-1);
                    tilesCentered.current = true;
                    console.log("Tiles centered at:", tilesRef.current.group.position);

                    // Initial Camera Positioning
                    if (!cameraPositionedRef.current) {
                        const q = new URLSearchParams(location.search);
                        if (q.has("rdx") && q.has("rdy")) {
                            setCameraPosFromRoute(q);
                        } else {
                            // Random landmark
                            const keys = Object.keys(landmarkLocations);
                            const landmark = (landmarkLocations as any)[keys[keys.length * Math.random() << 0]];
                            
                            if (onShowLocationBox) onShowLocationBox(`DEBUG: Loaded. Moving to ${landmark.name}`);
                            
                            setCameraPosFromRoute(new URLSearchParams({
                                rdx: landmark.rdx,
                                rdy: landmark.rdy,
                                ox: landmark.ox,
                                oy: landmark.oy,
                                oz: landmark.oz
                            }));
                        }
                        cameraPositionedRef.current = true;
                    }
                }
            }
        }

        // Fallback: If tiles are loaded but camera not positioned, do it now
        if (tilesRef.current && tilesRef.current.root) {
            const root = tilesRef.current.root;
            
            // FIX: Ensure cached sphere exists so renderer can work
            // @ts-ignore
            if (!root.cached.sphere && root.boundingVolume && root.boundingVolume.box) {
                const box = root.boundingVolume.box;
                const center = new THREE.Vector3(box[0], box[1], box[2]);
                // Approximate radius from box extents (box[3]..box[11] are basis vectors)
                const xVector = new THREE.Vector3(box[3], box[4], box[5]);
                const yVector = new THREE.Vector3(box[6], box[7], box[8]);
                const zVector = new THREE.Vector3(box[9], box[10], box[11]);
                const radius = Math.max(xVector.length(), yVector.length(), zVector.length());
                
                // @ts-ignore
                root.cached.sphere = new THREE.Sphere(center, radius);
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
            }

            if (center && radius > 0) {

                // Convert to World Space (taking offsetParent into account)
                const worldCenter = center.clone();
                
                // Apply Root Transform if it exists
                // FIX: We want to stay in Local Coordinates because TileScheme expects Local Camera Position.
                // The 3D Tiles Renderer handles the transform internally for meshes? 
                // Actually, if we move camera to World (RD), we see nothing because meshes are at Local?
                // Or meshes are at World?
                // If meshes are at World, then Camera at World is correct.
                // But TileScheme adds Offset. So TileScheme expects Camera at Local.
                // So we MUST be at Local.
                /*
                if (root.transform) {
                     const transformMatrix = new THREE.Matrix4().fromArray(root.transform);
                     // Check if center is still near 0,0,0 (local) while transform has large values
                     if (worldCenter.length() < 10000 && transformMatrix.elements[12] > 10000) {
                         console.log("Applying Root Transform to Center...");
                         worldCenter.applyMatrix4(transformMatrix);
                     }
                }
                */

                // Apply Offset Parent Rotation/Transform
                if (offsetParentRef.current) {
                    // Ensure matrix is updated
                    offsetParentRef.current.updateMatrixWorld(true);
                    // worldCenter.applyMatrix4(offsetParentRef.current.matrixWorld);
                    // FIX: Do not apply offset parent transform if we want to stay in Local Space of the group?
                    // No, Camera is in World Space.
                    // If we want Camera to be at Local (0,0,0) relative to Group.
                    // And Group is at (0,0,0) World (just rotated).
                    // Then Local (0,0,0) IS World (0,0,0).
                    // So we don't need to apply matrixWorld if translation is 0.
                    // Rotation matters for "Up" vector.
                }

                // Position camera to see the whole set
                // Move camera back by 2x radius to ensure visibility
                // We move along Z and Y in world space to look down/forward
                
                // FIX: The root tile is the entire Netherlands. 
                // If we zoom out to see it all, we are 400km high and get 400 errors from WMTS.
                // Instead, let's default to Amsterdam Central Station if the radius is huge.
                
                let target = worldCenter;
                let dist = radius * 1.5;

                if (radius > 50000) {
                    // Amsterdam Central Station RD Coordinates: X: 121500, Y: 487500
                    // We need Local Coordinates.
                    // Local = RD - Offset.
                    // We need the Offset.
                    let offsetX = 0;
                    let offsetY = 0;
                    if (root.transform) {
                        const tm = new THREE.Matrix4().fromArray(root.transform);
                        offsetX = tm.elements[12];
                        offsetY = tm.elements[13];
                    }
                    
                    const localX = 121500 - offsetX;
                    const localY = 0;
                    const localZ = -(487500 - offsetY); // RD Y -> Local Z (flipped)
                    
                    target = new THREE.Vector3(localX, localY, localZ);
                    
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
        console.log("reinitTiles called with URL:", tilesUrl);
        cameraPositionedRef.current = false; // Reset flag
        tilesCentered.current = false; // Reset centering flag
        if (!offsetParentRef.current || !rendererRef.current || !dummyCameraRef.current) {
            console.error("Missing refs in reinitTiles");
            return;
        }

        if (tilesRef.current) {
            if (tilesRef.current.dispose) tilesRef.current.dispose();
            offsetParentRef.current.remove(tilesRef.current.group);
        }

        const tiles = new TilesRenderer( tilesUrl );
        
        // Configure Draco Loader
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath( 'https://www.gstatic.com/draco/versioned/decoders/1.4.3/' );

        const loader = new GLTFLoader( tiles.manager );
        loader.setDRACOLoader( dracoLoader );

        tiles.manager.addHandler( /\.gltf$/, loader );
        
        tiles.fetchOptions = { mode: 'cors' };
        // tiles.group.rotation.x = - Math.PI / 2;
        tiles.displayBoxBounds = false;
        tiles.colorMode = 0; // None (Use material color)
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
            if (onShowLocationBox) onShowLocationBox("DEBUG: Tileset Loaded");

            if (init && !cameraPositionedRef.current) {
                // Moved to animate loop to ensure tiles are centered first
                /*
                const q = new URLSearchParams(location.search);
                if (q.has("rdx") && q.has("rdy")) {
                    setCameraPosFromRoute(q);
                } else {
                    // Random landmark
                    const keys = Object.keys(landmarkLocations);
                    const landmark = (landmarkLocations as any)[keys[keys.length * Math.random() << 0]];
                    
                    if (onShowLocationBox) onShowLocationBox(`DEBUG: Loaded. Moving to ${landmark.name}`);
                    
                    setCameraPosFromRoute(new URLSearchParams({
                        rdx: landmark.rdx,
                        rdy: landmark.rdy,
                        ox: landmark.ox,
                        oy: landmark.oy,
                        oz: landmark.oz
                    }));

                    // setTimeout(() => {
                    //    if (onHideLocationBox) onHideLocationBox();
                    // }, 10000);
                }
                cameraPositionedRef.current = true;
                */
            }
            
            if (tiles.root) {
                reinitBasemap();
            } else {
                console.warn("Tiles root is missing in onLoadTileSet");
                if (onShowLocationBox) onShowLocationBox("DEBUG: Root Missing!");
            }
            needsRerender.current = 2;
        };

        tiles.onLoadModel = (s: any) => {
            console.log("onLoadModel fired", s);
            s.traverse((c: any) => {
                if (c.material) {
                    // c.material.dispose();
                    c.material = materialRef.current; // Apply custom material
                    if (c.geometry) c.geometry.computeBoundingBox();
                }
            });
            needsRerender.current = 1;
        };

        tiles.onLoadTileStart = () => {
        };

        tiles.onLoadTileError = (tile: any, error: any) => {
            console.error("onLoadTileError", tile?.metadata?.url || tile?.url, error);
        };

        tiles.onLoadTileSuccess = () => {
        };

        offsetParentRef.current.add(tiles.group);
        tilesRef.current = tiles;
    };

    const reinitBasemap = () => {
        if (!offsetParentRef.current || !tilesRef.current || !tilesRef.current.root) {
            return;
        }
        
        if (terrainTilesRef.current) {
            offsetParentRef.current.remove(terrainTilesRef.current.group);
        }

        const transform = tilesRef.current.root.cached.transform;
        // We need to pass the tileset offset to the basemap renderer so it can calculate the correct RD coordinates
        // transform.elements[12] is Offset X (RD X)
        // transform.elements[13] is Offset Y (RD Y)
        // transform.elements[14] is Offset Z (RD Z)
        const sceneTransform = new THREE.Vector3( transform.elements[ 12 ], transform.elements[ 13 ], transform.elements[ 14 ] );
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

        // We have centered the tileset by moving tilesRef.current.group.position.
        // groupPos is in the Local Space (Z-up) of the tileset.
        const groupPos = tilesRef.current.group.position;

        // Target Point in Local Space (Z-up)
        // We want to look at (rdx, rdy, 0) in the original data.
        // Since we moved the group by groupPos, the point is now at:
        const local_x = rdx + groupPos.x;
        const local_y = rdy + groupPos.y;
        const local_z = 0 + groupPos.z;

        // Convert to World Space (Y-up)
        // OffsetParent is rotated -90 degrees around X.
        // (x, y, z) -> (x, z, -y)
        const world_x = local_x;
        const world_y = local_z;
        const world_z = -local_y;

        controlsRef.current.target.x = world_x;
        controlsRef.current.target.y = world_y;
        controlsRef.current.target.z = world_z;
        
        // Camera Position relative to Target
        // The offset (ox, oy, oz) seems to be in World Space (Y-up) based on default camera pos (400,400,400)
        cameraRef.current.position.x = world_x + ox;
        cameraRef.current.position.y = world_y + oy;
        cameraRef.current.position.z = world_z + oz;
        
        controlsRef.current.update();

        // Debug Cube
        if (sceneRef.current) {
            // Remove old debug objects if they exist
            const oldCube = sceneRef.current.getObjectByName("DebugCube");
            if (oldCube) sceneRef.current.remove(oldCube);
            
            // const geom = new THREE.BoxGeometry(100, 100, 100); 
            // const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            // const cube = new THREE.Mesh(geom, mat);
            // cube.name = "DebugCube";
            // cube.position.set(world_x, world_y, world_z);
            // sceneRef.current.add(cube);
        }
        
        if (q.get("placeMarker") === "true") {
            placeMarkerOnPoint(new THREE.Vector3(world_x, world_y, world_z));
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
