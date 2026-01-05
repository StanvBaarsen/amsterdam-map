import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const useThreeScene = (containerRef: React.RefObject<HTMLDivElement | null>) => {
    const [isReady, setIsReady] = useState(false);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const dummyCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const offsetParentRef = useRef<THREE.Group | null>(null);

    useEffect(() => {
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
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 2, 10000000);
        camera.position.set(400, 400, 400);
        cameraRef.current = camera;

        const dummyCamera = new THREE.PerspectiveCamera(30, containerRef.current.clientWidth / containerRef.current.clientHeight, 1, 10000000);
        dummyCameraRef.current = dummyCamera;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.screenSpacePanning = false;
        controls.minDistance = 750;
        controls.maxDistance = 6000;
        controls.maxPolarAngle = 0.8;
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
        offsetParent.rotation.x = - Math.PI / 2;
        scene.add(offsetParent);
        offsetParentRef.current = offsetParent;

        setIsReady(true);

        return () => {
            setIsReady(false);
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }
        };
    }, []);

    return {
        rendererRef,
        sceneRef,
        cameraRef,
        dummyCameraRef,
        controlsRef,
        offsetParentRef,
        isReady
    };
};
