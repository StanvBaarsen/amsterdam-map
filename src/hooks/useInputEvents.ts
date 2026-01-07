import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

interface UseInputEventsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    cameraRef: React.RefObject<THREE.PerspectiveCamera | undefined | null>;
    rendererRef: React.RefObject<THREE.WebGLRenderer | undefined | null>;
    tilesRef: React.RefObject<any>;
    terrainTilesRef: React.RefObject<any>;
    sceneRef: React.RefObject<THREE.Scene | undefined | null>;
    controlsRef: React.RefObject<any>;
    dummyCameraRef: React.RefObject<THREE.PerspectiveCamera | undefined | null>;
    needsRerender: React.MutableRefObject<number>;
    isReady: boolean;
    onObjectPicked?: (obj: any) => void;
    onUserInteraction: () => void;
}

export const useInputEvents = ({
    containerRef,
    cameraRef,
    rendererRef,
    tilesRef,
    terrainTilesRef,
    sceneRef,
    controlsRef,
    dummyCameraRef,
    needsRerender,
    isReady,
    onObjectPicked,
    onUserInteraction
}: UseInputEventsProps) => {

    const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
    const pointerCasterRef = useRef({ startClientX: 0, startClientY: 0 });

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
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        pointerCasterRef.current.startClientX = e.clientX;
        pointerCasterRef.current.startClientY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
        if (Math.abs(pointerCasterRef.current.startClientX - e.clientX) < 2 &&
            Math.abs(pointerCasterRef.current.startClientY - e.clientY) < 2) {
            if (onObjectPicked) {
                // Implement raycasting logic here
            }
        }
    };

    // Double click to zoom
    useEffect(() => {
        if (!isReady || !rendererRef.current) return;

        const onDoubleClick = (event: MouseEvent) => {
            if (!cameraRef.current || !sceneRef.current || !tilesRef.current) return;

            const rect = rendererRef.current!.domElement.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

            const objects: THREE.Object3D[] = [];
            if (tilesRef.current.group) objects.push(tilesRef.current.group);
            if (terrainTilesRef.current) objects.push(terrainTilesRef.current);

            const intersects = raycaster.intersectObjects(objects, true);

            if (intersects.length > 0) {
                const point = intersects[0].point;
                const controls = controlsRef.current!;

                const startTarget = controls.target.clone();
                const startPos = cameraRef.current.position.clone();

                const direction = startPos.clone().sub(point).normalize();
                const dist = startPos.distanceTo(point);
                const newDist = Math.max(dist * 0.5, 50); // Zoom in by 50%, min 50m
                
                const endPos = point.clone().add(direction.multiplyScalar(newDist));
                const endTarget = point;

                new TWEEN.Tween({ t: 0 })
                    .to({ t: 1 }, 1000)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onUpdate(({ t }) => {
                        controls.target.lerpVectors(startTarget, endTarget, t);
                        cameraRef.current!.position.lerpVectors(startPos, endPos, t);
                        needsRerender.current = 1;
                    })
                    .start();
            }
        };

        const canvas = rendererRef.current.domElement;
        canvas.addEventListener('dblclick', onDoubleClick);
        return () => canvas.removeEventListener('dblclick', onDoubleClick);
    }, [isReady, rendererRef, cameraRef, tilesRef, terrainTilesRef, sceneRef, controlsRef, needsRerender]);


    useEffect(() => {
        window.addEventListener('resize', onWindowResize, false);
        if (rendererRef.current) {
            const canvas = rendererRef.current.domElement;
            canvas.addEventListener('pointermove', onPointerMove, false);
            canvas.addEventListener('pointerdown', (e) => {
                onPointerDown(e);
                onUserInteraction();
            }, false);
            canvas.addEventListener('pointerup', onPointerUp, false);
            canvas.addEventListener('wheel', onUserInteraction, false);
            canvas.addEventListener('touchstart', onUserInteraction, false);
        }

        return () => {
            window.removeEventListener('resize', onWindowResize);
            if (rendererRef.current) {
                const canvas = rendererRef.current.domElement;
                canvas.removeEventListener('pointermove', onPointerMove);
                canvas.removeEventListener('pointerdown', onPointerDown);
                canvas.removeEventListener('pointerup', onPointerUp);
                canvas.removeEventListener('wheel', onUserInteraction);
                canvas.removeEventListener('touchstart', onUserInteraction);
            }
        };
    }, [rendererRef.current]);

    return { mouseRef };
};
