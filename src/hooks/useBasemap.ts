import { useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { WMSTilesRenderer, WMTSTilesRenderer } from '../terrain-tiles';

interface UseBasemapProps {
    basemapOptions: any;
    offsetParentRef: MutableRefObject<THREE.Group | null>;
    tilesRef: MutableRefObject<any>;
    tilesCentered: MutableRefObject<boolean>;
    sceneTransformRef: MutableRefObject<THREE.Vector3 | null>;
    needsRerender: MutableRefObject<number>;
}

export const useBasemap = ({
    basemapOptions,
    offsetParentRef,
    tilesRef,
    tilesCentered,
    sceneTransformRef,
    needsRerender
}: UseBasemapProps) => {
    const terrainTilesRef = useRef<any>(null);

    const reinitBasemap = () => {
        if (!offsetParentRef.current || !tilesRef.current) {
            return;
        }

        if (terrainTilesRef.current) {
            offsetParentRef.current.remove(terrainTilesRef.current.group);
            if (terrainTilesRef.current.dispose) terrainTilesRef.current.dispose();
        }

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
            offsetParentRef.current.add(terrainTilesRef.current.group);
        }
        needsRerender.current = 1;
    };

    useEffect(() => {
        reinitBasemap();
        return () => {
            if (terrainTilesRef.current && offsetParentRef.current) {
                offsetParentRef.current.remove(terrainTilesRef.current.group);
                if (terrainTilesRef.current.dispose) terrainTilesRef.current.dispose();
            }
        };
    }, [basemapOptions]);

    return { terrainTilesRef, reinitBasemap };
};
