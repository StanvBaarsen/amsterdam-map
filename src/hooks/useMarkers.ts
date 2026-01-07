import { useRef, useEffect } from 'react';
import * as THREE from 'three';

export const useMarkers = (
    sceneRef: React.MutableRefObject<THREE.Scene | undefined | null> | React.RefObject<THREE.Scene | undefined | null>,
    needsRerender: React.MutableRefObject<number>,
    userHasPanned: boolean,
    userHasRotated: boolean
) => {
    const markerName = "LocationMarker"; 
    const removeLocationMarkerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const placeMarkerOnPoint = (position: THREE.Vector3) => {
        if (!sceneRef.current) return;

        // Clear existing
        const existingMarker = sceneRef.current.getObjectByName(markerName);
        if (existingMarker) {
            sceneRef.current.remove(existingMarker);
        }
        
        // Clear timer
        if (removeLocationMarkerTimerRef.current) {
            clearTimeout(removeLocationMarkerTimerRef.current);
            removeLocationMarkerTimerRef.current = null;
        }

        const markerGroup = new THREE.Group();
        markerGroup.name = markerName;

        // 1. Blue Dot
        const dotGeom = new THREE.CircleGeometry(5, 32); 
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x4285F4, depthTest: false, depthWrite: false }); // Google Blue
        const dotMesh = new THREE.Mesh(dotGeom, dotMat);
        
        // 2. White outline
        const outlineGeom = new THREE.RingGeometry(5, 7, 32);
        const outlineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });
        const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);

        // 3. Transparent pulse ring (static for now, maybe animate in loop if time?)
        const ringGeom = new THREE.RingGeometry(7, 20, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x4285F4, opacity: 0.3, transparent: true, depthTest: false, depthWrite: false });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);

        markerGroup.add(ringMesh);
        markerGroup.add(outlineMesh);
        markerGroup.add(dotMesh);

        // Orient flat on ground (XZ plane)
        markerGroup.rotation.x = -Math.PI / 2;
        markerGroup.position.copy(position);
        markerGroup.position.y += 10; // Slightly above ground to prevent z-fight if flat
        // Render order to ensure on top
        dotMesh.renderOrder = 999;
        outlineMesh.renderOrder = 999;
        ringMesh.renderOrder = 998;

        sceneRef.current.add(markerGroup);
        needsRerender.current = 1;
    };

    // Remove marker on user interaction (Pan/Rotate)
    useEffect(() => {
        if ((userHasPanned || userHasRotated) && sceneRef.current) {
             const m = sceneRef.current.getObjectByName(markerName);
             if (m) {
                 sceneRef.current.remove(m);
                 needsRerender.current = 1;
             }
        }
    }, [userHasPanned, userHasRotated]);

    return { placeMarkerOnPoint };
};
