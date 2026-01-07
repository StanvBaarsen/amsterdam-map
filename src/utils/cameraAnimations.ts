import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

export const animateCameraToLocation = (
    camera: THREE.PerspectiveCamera,
    controls: any,
    targetRD: { x: number, y: number },
    groupPosition: THREE.Vector3,
    onNeedsRerender: () => void,
    onComplete?: () => void
) => {
    if (!controls || !camera) return;

    const local_x = targetRD.x + groupPosition.x;
    const local_y = targetRD.y + groupPosition.y;
    
    // Convert to World Space (Y-up, rotated parent)
    const world_x = local_x;
    const world_y = 0 + groupPosition.z; 
    const world_z = -local_y;

    const target = new THREE.Vector3(world_x, world_y, world_z);
    
    // Final Zoom in position
    const dist = 600; 
    const finalCamPos = target.clone().add(new THREE.Vector3(dist, dist, dist));

    // Calculate distance to determine duration
    const currentPos = camera.position.clone();
    const distanceToTarget = currentPos.distanceTo(finalCamPos);
    
    // Dynamic duration: min 800ms, max 2000ms based on distance
    const baseDuration = 800;
    const additionalDuration = Math.min(1200, (distanceToTarget / 5000) * 1500);
    const duration = baseDuration + additionalDuration;

    // Animate X and Z (Pan/Rotate)
    new TWEEN.Tween(camera.position)
        .to({ x: finalCamPos.x, z: finalCamPos.z }, duration)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();

    // Animate Y (Zoom) with delay
    new TWEEN.Tween(camera.position)
        .to({ y: finalCamPos.y }, duration)
        .delay(200) // Delay zoom slightly
        .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
            controls.update();
            onNeedsRerender();
        })
        .onComplete(() => {
            if (onComplete) onComplete();
        })
        .start();

    // Animate Target (LookAt)
    new TWEEN.Tween(controls.target)
        .to({ x: target.x, y: target.y, z: target.z }, duration)
        .easing(TWEEN.Easing.Quadratic.InOut) 
        .onUpdate(() => {
            controls.update();
            onNeedsRerender();
        })
        .start();
};

export const animateCameraToOverview = (
    camera: THREE.PerspectiveCamera,
    controls: any,
    initialCameraState: { position: THREE.Vector3, target: THREE.Vector3 },
    onNeedsRerender: () => void
) => {
    if (!controls || !camera || !initialCameraState) return;

    const { position, target } = initialCameraState;

    new TWEEN.Tween(camera.position)
        .to({ x: position.x, y: position.y, z: position.z }, 2000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();

    new TWEEN.Tween(controls.target)
        .to({ x: target.x, y: target.y, z: target.z }, 2000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
            controls.update();
            onNeedsRerender();
        })
        .start();
};

export const animateZoomOut = (
    camera: THREE.PerspectiveCamera,
    controls: any,
    initialCameraState: { position: THREE.Vector3, target: THREE.Vector3 },
    onNeedsRerender: () => void
) => {
    if (!controls || !camera || !initialCameraState) return;

    const { target } = initialCameraState;
    const initialPos = initialCameraState.position;
    const direction = new THREE.Vector3().subVectors(initialPos, target).normalize();
    
    const dist = 6000;
    const endPos = target.clone().add(direction.multiplyScalar(dist));

    new TWEEN.Tween(camera.position)
        .to({ x: endPos.x, y: endPos.y, z: endPos.z }, 4000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
                controls.update();
                onNeedsRerender();
        })
        .start();
        
    new TWEEN.Tween(controls.target)
        .to({ x: target.x, y: target.y, z: target.z }, 4000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
};

export const animateResetToStart = (
    camera: THREE.PerspectiveCamera,
    controls: any,
    initialCameraState: { position: THREE.Vector3, target: THREE.Vector3 },
    onNeedsRerender: () => void
) => {
    if (!camera || !controls || !initialCameraState) return;
    const { target } = initialCameraState;
    // "Normal, mid-close height"
    const height = 2200;
    const offset = 2600;
    const startPos = target.clone().add(new THREE.Vector3(0, height, offset));
    
    // Animate Camera Position
    new TWEEN.Tween(camera.position)
        .to({ x: startPos.x, y: startPos.y, z: startPos.z }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            controls.update();
            onNeedsRerender();
        })
        .start();

    // Animate Controls Target (Reset to center)
    new TWEEN.Tween(controls.target)
        .to({ x: target.x, y: target.y, z: target.z }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            controls.update();
            onNeedsRerender();
        })
        .start();
};
