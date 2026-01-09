import { useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { processTileColors } from '../utils/tiles';

interface UseTilesLoaderProps {
    tilesUrl: string;
    cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
    rendererRef: MutableRefObject<THREE.WebGLRenderer | null>;
    offsetParentRef: MutableRefObject<THREE.Group | null>;
    coloredMaterialRef: MutableRefObject<THREE.Material | null>;
    materialRef: MutableRefObject<THREE.Material | null>;
    setLoadingProgress: (progress: any) => void;
    setIsLoading: (loading: boolean) => void;
    needsRerender: MutableRefObject<number>;
    tilesCentered: MutableRefObject<boolean>;
    onLoadCallback?: () => void;
    isReady: boolean;
}

export const useTilesLoader = ({
    tilesUrl,
    cameraRef,
    rendererRef,
    offsetParentRef,
    coloredMaterialRef,
    materialRef,
    setLoadingProgress,
    setIsLoading,
    needsRerender,
    tilesCentered,
    onLoadCallback,
    isReady
}: UseTilesLoaderProps) => {
    const tilesRef = useRef<any>(null);
    const tilesetLoadedRef = useRef(false);
    const stableFramesRef = useRef(0);
    const isFinishingLoadRef = useRef(false);
    const isLoadingRef = useRef(true);
    const keepAliveFrames = useRef(0);

    useEffect(() => {
        if (!isReady || !offsetParentRef.current || !rendererRef.current || !cameraRef.current) return;

        setIsLoading(true);
        isLoadingRef.current = true;
        setLoadingProgress(0);
        tilesetLoadedRef.current = false;
        stableFramesRef.current = 0;
        isFinishingLoadRef.current = false;
        tilesCentered.current = false;

        if (tilesRef.current) {
            if (tilesRef.current.dispose) tilesRef.current.dispose();
            offsetParentRef.current.remove(tilesRef.current.group);
        }

        const absoluteTilesUrl = new URL(tilesUrl, window.location.href).toString();
        const tiles = new TilesRenderer(absoluteTilesUrl);

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
        const loader = new GLTFLoader(tiles.manager);
        loader.setDRACOLoader(dracoLoader);
        tiles.manager.addHandler(/\.gltf$/, loader);

        tiles.fetchOptions = { mode: 'cors' };
        tiles.displayBoxBounds = false;
        tiles.colorMode = 0;

        const isMobile = window.innerWidth < 768;

        // Reduce cache size significantly for mobile to prevent OOM crashes
        // Aggressive limits: minSize=150, maxSize=300 for mobile
        // If "tiles stays around 100", let's keep it close to that.
        tiles.lruCache.minSize = isMobile ? 150 : 4000;
        tiles.lruCache.maxSize = isMobile ? 300 : 6000;
        
        // @ts-ignore
        tiles.lruCache.unloadPercent = isMobile ? 0.5 : 0.05; // Force unloading of unused tiles aggressively on mobile

        // Increase error target on mobile to reduce geometry load (lower LOD)
        tiles.errorTarget = isMobile ? 20 : 10;
        tiles.loadSiblings = !isMobile; // Disable sibling loading on mobile to save bandwidth/memory
        tiles.maxDepth = 30;
        tiles.showEmptyTiles = true;

        tiles.setCamera(cameraRef.current);
        tiles.setResolutionFromRenderer(cameraRef.current, rendererRef.current);

        tiles.onLoadTileSet = () => {
            tilesetLoadedRef.current = true;
            keepAliveFrames.current = 60;
            if (onLoadCallback) onLoadCallback();
            needsRerender.current = 2;
        };

        tiles.onLoadModel = (scene: THREE.Group, tile: any) => {
            if (coloredMaterialRef.current && materialRef.current) {
                processTileColors(scene, tile, coloredMaterialRef.current, materialRef.current);
            }
            needsRerender.current = 1;
        };

        offsetParentRef.current.add(tiles.group);
        tilesRef.current = tiles;

        return () => {
             // Dispose loaders to terminate workers
             dracoLoader.dispose();
             
            if (tilesRef.current) {
                if (offsetParentRef.current) offsetParentRef.current.remove(tilesRef.current.group);
                if (tilesRef.current.dispose) tilesRef.current.dispose();
            }
        };
    }, [tilesUrl, isReady]);

    return { tilesRef, isLoadingRef, stableFramesRef, isFinishingLoadRef, keepAliveFrames };
};
