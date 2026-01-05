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
import { useState } from 'react';

const getBuildingColor = (year: number) => {
    if (!year) return new THREE.Color(0xeeeeee); // Unknown: Light Grey

    if (year < 1400) return new THREE.Color(0x550000); // < 1400: Dark Red
    if (year < 1500) return new THREE.Color(0x770000); // 1400-1500: Medium Dark Red
    if (year < 1600) return new THREE.Color(0x990000); // 1500-1600: Red
    if (year < 1700) return new THREE.Color(0xbb1100); // 1600-1700: Bright Red
    if (year < 1800) return new THREE.Color(0xdd3300); // 1700-1800: Red-Orange
    if (year < 1900) return new THREE.Color(0xff5500); // 1800-1900: Orange-Red
    if (year < 2000) return new THREE.Color(0xff7700); // 1900-2000: Orange
    return new THREE.Color(0xff9900); // > 2000: Light Orange
};

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
    tilesUrl = '/amsterdam_3dtiles_lod12/tileset.json',
    basemapOptions = {
        type: "wmts",
        options: {
            url: '/basemap/capabilities.xml',
            template: '/basemap/tiles/grijs/{TileMatrix}/{TileCol}/{TileRow}.png',
            layer: 'pastel',
            style: 'default',
            tileMatrixSet: "EPSG:28992",
            service: "WMTS",
            request: "GetTile",
            version: "1.0.0",
            format: "image/png"
        }
    },
    onObjectPicked,
    onCamRotationZ
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [showIntro, setShowIntro] = useState(true);
    
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
    const tilesetLoadedRef = useRef(false);
    const stableFramesRef = useRef(0);
    const isFinishingLoadRef = useRef(false);
    const isLoadingRef = useRef(true); // Ref to track loading state inside animate loop

    const location = useLocation();
    const needsRerender = useRef(0);
    const keepAliveFrames = useRef(0);

    // Materials
    const materialRef = useRef<THREE.Material | null>(null);
    const highlightMaterialRef = useRef<THREE.Material | null>(null);
    const coloredMaterialRef = useRef<THREE.Material | null>(null);

    const markerName = "LocationMarker";

    const initScene = () => {
        if (!containerRef.current) return;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setClearColor(0xf0f0f0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);
        // scene.fog = new THREE.FogExp2( 0xeeeeee, 0.0004 );
        sceneRef.current = scene;

        // Camera
        // INCREASED FAR PLANE to 10,000,000 to handle large datasets
        const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 2, 10000000);
        camera.position.set(400, 400, 400);
        cameraRef.current = camera;

        const dummyCamera = new THREE.PerspectiveCamera(30, containerRef.current.clientWidth / containerRef.current.clientHeight, 1, 10000000);
        dummyCameraRef.current = dummyCamera;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.screenSpacePanning = false;
        controls.minDistance = 750;
        controls.maxDistance = 4000; // Limit max zoom out to 2km
        controls.maxPolarAngle = 0.8; // Matched reference implementation
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.zoomSpeed = 1.6;
        controls.panSpeed = 1.6;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
        controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        controls.addEventListener('change', () => {
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
        });
        controlsRef.current = controls;

        // Lights
        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(0.63, 1, 0);
        dirLight.intensity = 1.2;
        scene.add(dirLight);

        const ambLight = new THREE.AmbientLight(0xffffff);
        ambLight.intensity = 0.8;
        scene.add(ambLight);

        const pLight = new THREE.PointLight(0xffffff);
        pLight.position.set(0, 0, 0);
        pLight.intensity = 0.4;
        camera.add(pLight);
        scene.add(camera);

        // Offset Parent
        const offsetParent = new THREE.Group();
        offsetParent.rotation.x = - Math.PI / 2; // Re-enabled rotation
        scene.add(offsetParent);
        offsetParentRef.current = offsetParent;

        // Materials
        // Use MeshLambertMaterial with flatShading for a clean, solid look
        const material = new THREE.MeshLambertMaterial({
            color: 0xff4444,
            flatShading: true
        });
        materialRef.current = material;

        const highlightMaterial = new THREE.MeshLambertMaterial({
            color: 0xffcc00,
            flatShading: true
        });
        highlightMaterialRef.current = highlightMaterial;

        // Add colored material
        const coloredMaterial = new THREE.MeshLambertMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: true
        });
        coloredMaterialRef.current = coloredMaterial;

        // Events
        window.addEventListener('resize', onWindowResize, false);
        renderer.domElement.addEventListener('pointermove', onPointerMove, false);
        renderer.domElement.addEventListener('pointerdown', onPointerDown, false);
        renderer.domElement.addEventListener('pointerup', onPointerUp, false);

        needsRerender.current = 1;
        animate();
    };

    const onWindowResize = () => {
        if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
        cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);

        if (dummyCameraRef.current) {
            dummyCameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            dummyCameraRef.current.updateProjectionMatrix();
        }

        if (tilesRef.current) {
            tilesRef.current.setResolutionFromRenderer(cameraRef.current, rendererRef.current);
        }
        needsRerender.current = 1;
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!containerRef.current) return;
        const bounds = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((e.clientX - bounds.left) / containerRef.current.clientWidth) * 2 - 1;
        mouseRef.current.y = - ((e.clientY - bounds.top) / containerRef.current.clientHeight) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
        pointerCasterRef.current.startClientX = e.clientX;
        pointerCasterRef.current.startClientY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
        if (Math.abs(pointerCasterRef.current.startClientX - e.clientX) < 2 &&
            Math.abs(pointerCasterRef.current.startClientY - e.clientY) < 2) {

            // Click logic
            if (onObjectPicked) {
                // Implement raycasting logic here
                // For now, simplified
            }
        }
    };

    const animate = () => {
        requestRef.current = requestAnimationFrame(animate);

        // Force update matrix world of offset parent to ensure rotation is applied
        if (offsetParentRef.current) {
            offsetParentRef.current.updateMatrixWorld(true);
        }

        if (controlsRef.current) controlsRef.current.update();
        TWEEN.update();

        if (cameraRef.current && dummyCameraRef.current) {
            dummyCameraRef.current.matrixWorld.copy(cameraRef.current.matrixWorld);
            dummyCameraRef.current.position.copy(cameraRef.current.position);
            dummyCameraRef.current.quaternion.copy(cameraRef.current.quaternion);
            dummyCameraRef.current.scale.copy(cameraRef.current.scale);
            dummyCameraRef.current.updateMatrixWorld();
        }

        if (tilesRef.current) {
            // Update tiles and check if a re-render is needed
            if (tilesRef.current.update()) {
                needsRerender.current = Math.max(needsRerender.current, 1);
            }

            // Loading Logic
            if (isLoadingRef.current) {
                const stats = tilesRef.current.stats;
                const isStable = stats.downloading === 0 && stats.parsing === 0;
                
                if (tilesRef.current.root && isStable) {
                    stableFramesRef.current++;
                    if (stableFramesRef.current > 15 && !isFinishingLoadRef.current) { // Wait ~0.25s of stability
                        isFinishingLoadRef.current = true;
                        setLoadingProgress(100);
                        
                        // Delay hiding to let user see 100%
                        setTimeout(() => {
                            setIsLoading(false);
                            isLoadingRef.current = false;
                        }, 500);
                    }
                } else {
                    stableFramesRef.current = 0;
                    // Fake progress: Asymptotically approach 90% while loading
                    if (!isFinishingLoadRef.current) {
                        setLoadingProgress(prev => {
                            const target = 90;
                            const next = prev + (target - prev) * 0.01; // Slow approach
                            if (next - prev < 0.1) return prev; // Skip small updates
                            return next;
                        });
                    }
                }
            }

            // Force material update on every frame to ensure new tiles get the material
            // This is a bit expensive but ensures consistency for now
            tilesRef.current.forEachLoadedModel((scene: THREE.Object3D, tile: any) => {
                // Lazy-load colors if missing
                // Check if we've already processed this tile to avoid re-parsing every frame
                // @ts-ignore
                if (!tile._colorsProcessed) {
                    // Try to find batch table in various locations
                    const batchTable = tile.batchTable ||
                        tile.content?.batchTable ||
                        // @ts-ignore
                        scene.batchTable ||
                        // @ts-ignore
                        tile.cached?.batchTable;

                    if (batchTable) {
                        // Helper to get data with fallback for deprecated API
                        const getData = (key: string) => {
                            // 3d-tiles-renderer v0.3+ uses getPropertyArray
                            if (batchTable.getPropertyArray) return batchTable.getPropertyArray(key);
                            // Fallback for older versions
                            if (batchTable.getData) return batchTable.getData(key);
                            return null;
                        };

                        // Parse construction years
                        let constructionYears: any = null;

                        // 1. Try direct access
                        constructionYears = getData('bouwjaar') ||
                            getData('construction_year') ||
                            getData('oorspronkelijkbouwjaar');

                        // 2. If not found, check for 'attributes'
                        if (!constructionYears) {
                            let attributes = getData('attributes');
                            if (!attributes && batchTable.json && batchTable.json.attributes) {
                                attributes = batchTable.json.attributes;
                            }

                            if (attributes) {
                                constructionYears = attributes.map((attr: any) => {
                                    let data = attr;
                                    if (typeof attr === 'string') {
                                        try {
                                            data = JSON.parse(attr);
                                        } catch (e) { return 0; }
                                    }
                                    return data?.oorspronkelijkbouwjaar || data?.bouwjaar || 0;
                                });
                            }
                        }

                        if (constructionYears) {
                            scene.traverse((c: any) => {
                                if (c.isMesh) {
                                    let geometry = c.geometry;

                                    // Ensure geometry is non-indexed to support per-face coloring (hard edges)
                                    // If vertices are shared between buildings, we need to split them.
                                    if (geometry.index) {
                                        geometry = geometry.toNonIndexed();
                                        c.geometry = geometry;
                                    }

                                    const batchIdAttr = geometry.getAttribute('_batchid');
                                    if (batchIdAttr) {
                                        const count = geometry.attributes.position.count;
                                        const colors = new Float32Array(count * 3);
                                        const batchIds = batchIdAttr.array;

                                        for (let i = 0; i < count; i++) {
                                            // FIX: Round batchId to handle floating point jitter in Float32Array
                                            const batchId = Math.round(batchIds[i]);
                                            const year = (batchId >= 0 && batchId < constructionYears.length) ? constructionYears[batchId] : 0;

                                            const color = getBuildingColor(year);
                                            colors[i * 3] = color.r;
                                            colors[i * 3 + 1] = color.g;
                                            colors[i * 3 + 2] = color.b;
                                        }
                                        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                                        // Remove existing normals to ensure flat shading works correctly
                                        geometry.deleteAttribute('normal');
                                        c.material = coloredMaterialRef.current;
                                    }
                                }
                            });
                            // Only mark processed if we successfully applied colors
                            // @ts-ignore
                            tile._colorsProcessed = true;
                        }
                    }
                }

                scene.traverse((c: any) => {
                    if (c.isMesh &&
                        c.material !== materialRef.current &&
                        c.material !== highlightMaterialRef.current &&
                        c.material !== coloredMaterialRef.current) {

                        // Fallback to red material for any mesh that wasn't explicitly colored
                        // We ignore existing vertex colors (which might be gradients/normals) 
                        // unless we generated them ourselves.
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
                    tilesRef.current.group.updateMatrixWorld(true);
                    tilesCentered.current = true;
                    needsRerender.current = 1;
                    keepAliveFrames.current = 60; // Force render for 1 second to ensure tiles load

                    // Initial Camera Positioning
                    if (!cameraPositionedRef.current) {
                        const q = new URLSearchParams(location.search);
                        if (q.has("rdx") && q.has("rdy")) {
                            setCameraPosFromRoute(q);
                            cameraPositionedRef.current = true;
                        }
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

                        // Apply transform to center if it exists, to match the centering logic
                        if (root.transform && center) {
                            const transform = new THREE.Matrix4().fromArray(root.transform);
                            center.applyMatrix4(transform);
                        } else if (root.cached.transform && center) {
                            const t = root.cached.transform;
                            if (t.elements) {
                                center.applyMatrix4(t);
                            } else if (t.length === 16) {
                                const transform = new THREE.Matrix4().fromArray(t);
                                center.applyMatrix4(transform);
                            }
                        }
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
                // Since we centered the tileset, the center of the tileset in Group Space is 'center'.
                // But the Group is moved by '-center'.
                // So the center of the tileset in OffsetParent Space is (0,0,0).
                
                // We want the camera to look at (0,0,0) in OffsetParent Space.
                // But OffsetParent is rotated.
                // So (0,0,0) in OffsetParent Space is (0,0,0) in World Space.
                
                const target = new THREE.Vector3(0, 0, 0);

                // Apply Offset Parent Rotation/Transform to the target if it wasn't 0,0,0
                if (offsetParentRef.current) {
                    offsetParentRef.current.updateMatrixWorld(true);
                    target.applyMatrix4(offsetParentRef.current.matrixWorld);
                }

                // Position camera to see the whole set
                // Move camera back by 2x radius to ensure visibility
                // We move along Z and Y in world space to look down/forward
                
                // FIX: The root tile is the entire Netherlands. 
                // If we zoom out to see it all, we are 400km high and get 400 errors from WMTS.
                // Instead, let's default to Amsterdam Central Station if the radius is huge.
                
                let dist = radius * 1.5;

                if (radius > 50000) {
                    // Amsterdam Central Station RD Coordinates: X: 121500, Y: 487500
                    // Adjusted to be more South: Y: 485000
                    // We need Local Coordinates.
                    // Local = RD - Offset.
                    // We need the Offset.
                    // let offsetX = 0;
                    // let offsetY = 0;
                    if (root.transform) {
                        // const tm = new THREE.Matrix4().fromArray(root.transform);
                        // offsetX = tm.elements[12];
                        // offsetY = tm.elements[13];
                    }
                    
                    // The tileset is centered, so (0,0,0) corresponds to the center of the tileset.
                    // We need to find where Amsterdam CS is relative to the center.
                    // Center (RD) was approx (155000, 463000) (Center of NL)
                    // Amsterdam CS (RD) is (121500, 487500)
                    
                    // But wait, we don't know the exact center RD without parsing the tileset center again.
                    // The 'center' variable holds the local center of the root tile.
                    // If the tileset uses RD coordinates directly, 'center' IS the RD coordinate of the center.
                    
                    // So Amsterdam CS relative to Center is:
                    // dX = 121500 - center.x
                    // dY = 487500 - center.y
                    
                    // In the Group, the position is (dX, dY, 0) (assuming Z=0 for simplicity)
                    // But the Group is rotated -90 X by OffsetParent?
                    // No, OffsetParent is rotated. Group is child.
                    // So (dX, dY, 0) in Group becomes (dX, 0, -dY) in World?
                    // Let's check rotation.
                    // OffsetParent.rotation.x = -PI/2.
                    // (x, y, z) -> (x, z, -y).
                    // So (dX, dY, 0) -> (dX, 0, -dY).
                    
                    // So we want to look at (dX, 0, -dY).
                    
                    const amsterdamRDX = 121500;
                    const amsterdamRDY = 487500;
                    
                    const dX = amsterdamRDX - center.x;
                    const dY = amsterdamRDY - center.y;
                    
                    // Apply rotation manually or use Vector3.applyEuler
                    const localTarget = new THREE.Vector3(dX, dY, 0);
                    
                    // IMPORTANT: The offsetParent is rotated -90 degrees around X.
                    // This means local (x, y, z) becomes world (x, z, -y).
                    // So localTarget (dX, dY, 0) becomes world (dX, 0, -dY).
                    // BUT, we are calculating dX and dY relative to the CENTER of the tileset.
                    // The tileset group is positioned at -center.
                    // So a point P in the tileset is at P - center in the group.
                    // We want to look at Amsterdam CS.
                    // P_ams = (121500, 487500, 0).
                    // P_ams_local = P_ams - center.
                    // This is exactly what dX and dY are.
                    
                    // Now we need to transform this local vector into world space.
                    // The group is a child of offsetParent.
                    // offsetParent has rotation X = -PI/2.
                    // So we apply that rotation.
                    
                    localTarget.applyEuler(new THREE.Euler(-Math.PI/2, 0, 0));
                    
                    // And we need to add the world position of the group?
                    // No, 'target' was initialized to (0,0,0) which is the world position of the group's origin (because group is at -center).
                    // Wait.
                    // Group position is -center.
                    // So the point (0,0,0) in Group space is at -center in Parent space.
                    // The point 'center' in Group space is at (0,0,0) in Parent space.
                    // We want the point P_ams in Group space.
                    // P_ams in Group space is P_ams. (Because the geometry vertices are in RD).
                    // So we want to look at P_ams transformed to World Space.
                    
                    // WorldPos = P_ams * GroupMatrix * ParentMatrix
                    // GroupMatrix is just translation by -center.
                    // ParentMatrix is rotation by -90 X.
                    
                    // So: (P_ams - center) * Rotation.
                    // (dX, dY, 0) * Rotation.
                    // This is exactly what we calculated above!
                    
                    target.copy(localTarget);
                    
                    // However, we must ensure we are adding this to the world position of the "center" of the tileset?
                    // No, (dX, dY, 0) * Rotation is the vector from the World Origin to the target.
                    // Because World Origin corresponds to the "center" of the tileset (since we moved the group by -center).
                    
                    dist = 2000; // 2km altitude
                }

                // Since we rotated -90 deg X, Y is UP, Z is South.
                // We want to be UP (Y) and South (Z)
                // Adjusted to be slightly less top-down
                const camPos = target.clone().add(new THREE.Vector3(0, dist * 1.0, dist * 0.8));
                
                if (cameraRef.current && controlsRef.current) {
                    cameraRef.current.position.copy(camPos);
                    controlsRef.current.target.copy(target);
                    controlsRef.current.update();
                    
                    // Update dummy camera for tiles renderer
                    if (dummyCameraRef.current) {
                        dummyCameraRef.current.position.copy(camPos);
                        dummyCameraRef.current.lookAt(target);
                        dummyCameraRef.current.updateMatrixWorld();
                    }

                }

                // Add Debug Sphere at Root Center (World Space)
                if (sceneRef.current) {
                    // Remove old debug sphere
                    const oldSphere = sceneRef.current.getObjectByName("RootDebugSphere");
                    if (oldSphere) sceneRef.current.remove(oldSphere);
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

        if (needsRerender.current > 0 || keepAliveFrames.current > 0) {
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
            if (needsRerender.current > 0) needsRerender.current--;
            if (keepAliveFrames.current > 0) keepAliveFrames.current--;
        }

        if (onCamRotationZ && cameraRef.current) {
            onCamRotationZ(cameraRef.current.rotation.z);
        }
    };

    const reinitTiles = (init: boolean) => {
        setIsLoading(true);
        isLoadingRef.current = true;
        setLoadingProgress(0);
        tilesetLoadedRef.current = false;
        stableFramesRef.current = 0;
        isFinishingLoadRef.current = false;

        tilesCentered.current = false; // Reset centering flag
        if (!offsetParentRef.current || !rendererRef.current || !dummyCameraRef.current) {
            console.error("Missing refs in reinitTiles");
            return;
        }

        if (tilesRef.current) {
            if (tilesRef.current.dispose) tilesRef.current.dispose();
            offsetParentRef.current.remove(tilesRef.current.group);
        }

        // Resolve to absolute URL to avoid issues with relative paths in 3d-tiles-renderer
        const absoluteTilesUrl = new URL(tilesUrl, window.location.href).toString();
        const tiles = new TilesRenderer(absoluteTilesUrl);

        // Configure Draco Loader
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');

        const loader = new GLTFLoader(tiles.manager);
        loader.setDRACOLoader(dracoLoader);

        tiles.manager.addHandler(/\.gltf$/, loader);

        tiles.fetchOptions = { mode: 'cors' };
        // tiles.group.rotation.x = - Math.PI / 2;
        tiles.displayBoxBounds = false;
        tiles.colorMode = 0; // None (Use material color)

        // Preload settings: Increase cache and detail to load all buildings
        tiles.lruCache.minSize = 3000;
        tiles.lruCache.maxSize = 4000;
        tiles.errorTarget = 10; // Relaxed from 0 to 10 to prevent stalling

        // tiles.errorThreshold = 60;
        tiles.loadSiblings = true;
        tiles.maxDepth = 30;
        tiles.showEmptyTiles = true;

        // @ts-ignore
        // tiles.downloadQueue.priorityCallback = tile => 1 / tile.cached.distance;

        tiles.setCamera(cameraRef.current);
        tiles.setResolutionFromRenderer(cameraRef.current, rendererRef.current);

        tiles.onLoadTileSet = () => {
            tilesetLoadedRef.current = true;
            keepAliveFrames.current = 60; // Force render for 1 second

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
            }
            needsRerender.current = 2;
        };

        tiles.onLoadModel = (scene: THREE.Group, tile: any) => {
            // Try to get batch table
            const batchTable = tile.content?.batchTable || tile.batchTable;

            let constructionYears: any = null;

            if (batchTable) {
                // 1. Try direct access
                constructionYears = batchTable.getData('bouwjaar') ||
                    batchTable.getData('construction_year') ||
                    batchTable.getData('oorspronkelijkbouwjaar');

                // 2. If not found, check for 'attributes' object/string (3DBAG style)
                if (!constructionYears) {
                    // Try getData first
                    let attributes = batchTable.getData('attributes');

                    // Fallback to direct JSON access if getData fails
                    if (!attributes && batchTable.json && batchTable.json.attributes) {
                        attributes = batchTable.json.attributes;
                    }

                    if (attributes) {
                        // attributes is an array of objects or JSON strings
                        // We need to map it to an array of years
                        constructionYears = attributes.map((attr: any) => {
                            let data = attr;
                            if (typeof attr === 'string') {
                                try {
                                    data = JSON.parse(attr);
                                } catch (e) {
                                    return 0;
                                }
                            }
                            // Check for year in the parsed object
                            return data?.oorspronkelijkbouwjaar || data?.bouwjaar || 0;
                        });
                    }
                }
            } else {
                console.warn("No batch table found for tile");
            }

            scene.traverse((c: any) => {
                if (c.isMesh) {
                    // Apply vertex colors if we have data
                    if (constructionYears) {
                        const geometry = c.geometry;
                        const batchIdAttr = geometry.getAttribute('_batchid');

                        if (batchIdAttr) {
                            const count = geometry.attributes.position.count;
                            const colors = new Float32Array(count * 3);
                            const batchIds = batchIdAttr.array;

                            let foundValidYear = false;
                            for (let i = 0; i < count; i++) {
                                const batchId = Math.round(batchIds[i]);
                                // Ensure batchId is within bounds of our data
                                const year = (batchId >= 0 && batchId < constructionYears.length) ? constructionYears[batchId] : 0;
                                if (year > 0) foundValidYear = true;
                                const color = getBuildingColor(year);

                                colors[i * 3] = color.r;
                                colors[i * 3 + 1] = color.g;
                                colors[i * 3 + 2] = color.b;
                            }

                            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                            geometry.deleteAttribute('normal');
                            c.material = coloredMaterialRef.current;

                            if (!foundValidYear) {
                                console.warn("No valid years found for this tile, but attributes existed.");
                            }
                        } else {
                            console.warn("Mesh has no _batchid attribute");
                            c.material = materialRef.current;
                        }
                    } else {
                        // Fallback to Blue to indicate "Processed but no data"
                        // This helps distinguish from "Not processed" (Red)
                        // c.material = new THREE.MeshLambertMaterial({ color: 0x0000ff });
                        c.material = materialRef.current;
                    }

                    if (c.geometry) c.geometry.computeBoundingBox();
                }
            });
            // @ts-ignore
            tile._colorsProcessed = true;
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

    function reinitBasemap() {
        if (!offsetParentRef.current || !tilesRef.current) {
            return;
        }

        if (terrainTilesRef.current) {
            offsetParentRef.current.remove(terrainTilesRef.current.group);
        }

        // Calculate the scene transform (World Origin -> RD Coordinate)
        // If tiles are centered, the group position is -Center. So Center = -group.position.
        // If not centered yet, try to use the root transform.
        const sceneTransform = new THREE.Vector3();
        
        if (tilesCentered.current) {
            sceneTransform.copy(tilesRef.current.group.position).multiplyScalar(-1);
        } else if (tilesRef.current.root && tilesRef.current.root.cached.transform) {
            const t = tilesRef.current.root.cached.transform;
            sceneTransform.set(t.elements[12], t.elements[13], t.elements[14]);
        }
        
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

    function setCameraPosFromRoute(q: URLSearchParams) {
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

        cameraRef.current.updateMatrixWorld();
        controlsRef.current.update();
        needsRerender.current = 1;

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

    function placeMarkerOnPoint(position: THREE.Vector3) {
        if (!sceneRef.current) return;

        const existingMarker = sceneRef.current.getObjectByName(markerName);
        if (existingMarker) sceneRef.current.remove(existingMarker);

        const textureLoader = new THREE.TextureLoader();
        const map = textureLoader.load('');
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
            window.removeEventListener('resize', onWindowResize);
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }
        };
    }, []);

    useEffect(() => {
        reinitTiles(true);
        
        // Fallback timeout to ensure loading screen disappears even if stats are weird
        const timeout = setTimeout(() => {
            setIsLoading(false);
            isLoadingRef.current = false;
        }, 15000); // 15 seconds max

        return () => {
            clearTimeout(timeout);
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

    return (
        <>
            <div 
                id="canvas" 
                ref={containerRef} 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    zIndex: 0,
                    opacity: isLoading ? 0 : 1,
                    transition: 'opacity 1.5s ease-in-out'
                }} 
            />
            
            {/* Intro Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(240, 240, 240, 0.8)',
                backdropFilter: 'blur(8px)',
                zIndex: 20,
                opacity: showIntro ? 1 : 0,
                pointerEvents: showIntro ? 'auto' : 'none',
                transition: 'opacity 0.5s ease-out'
            }}>
                <div style={{
                    maxWidth: '600px',
                    padding: '3rem',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                    textAlign: 'center'
                }}>
                    <h1 style={{
                        fontSize: '2.5rem',
                        marginBottom: '1.5rem',
                        color: '#1a1a1a',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                        fontWeight: '700'
                    }}>
                        Amsterdam 2030
                    </h1>
                    <p style={{
                        fontSize: '1.1rem',
                        lineHeight: '1.6',
                        color: '#444',
                        marginBottom: '2.5rem',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                    }}>
                        Ontdek wat innovatie voor Amsterdam heeft betekend door de eeuwen heen. 
                        Deze interactieve 3D-kaart toont de groei van de stad, waarbij gebouwen zijn gekleurd op basis van hun bouwjaar.
                    </p>
                    <button 
                        onClick={() => setShowIntro(false)}
                        style={{
                            padding: '1rem 3rem',
                            fontSize: '1.1rem',
                            backgroundColor: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'transform 0.1s, background-color 0.2s',
                            fontWeight: '600',
                            boxShadow: '0 4px 12px rgba(255, 68, 68, 0.3)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ff2222'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff4444'}
                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        Start met verkennen
                    </button>
                </div>
            </div>

            {/* Loading Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f0f0f0',
                zIndex: 10,
                opacity: (isLoading && !showIntro) ? 1 : 0,
                pointerEvents: (isLoading && !showIntro) ? 'auto' : 'none',
                transition: 'opacity 0.8s ease-out'
            }}>
                <div style={{
                    fontSize: '1.2rem',
                    marginBottom: '1rem',
                    color: '#333',
                    fontFamily: 'sans-serif'
                }}>
                    Amsterdam 2030 laden... {Math.round(loadingProgress)}%
                </div>
                <div style={{
                    width: '200px',
                    height: '4px',
                    backgroundColor: '#ddd',
                    borderRadius: '2px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${loadingProgress}%`,
                        height: '100%',
                        backgroundColor: '#ff4444',
                        transition: 'width 0.2s ease-out'
                    }} />
                </div>
                <style>{`
                    /* Removed keyframes as we use width transition now */
                `}</style>
            </div>
        </>
    );
};
