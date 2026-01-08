import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

export const animateCameraToLocation = (
    camera: THREE.PerspectiveCamera,
    controls: any,
    targetRD: { x: number, y: number },
    groupPosition: THREE.Vector3,
    onNeedsRerender: () => void,
    onComplete?: () => void,
    cameraAngle?: number, // in degrees, 180 = looking South
    cameraDistance?: number // distance/radius from target
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
    // Default distances
    const dist = cameraDistance ? cameraDistance : 600; 
    let finalCamPos;

    if (cameraAngle !== undefined) {
        // Calculate position based on angle
        // 180 deg = looking South. 
        // In our coord system: -Z is North, +Z is South.
        // Looking South means looking towards +Z.
        // Camera must be at North (-Z) of target.
        
        const rad = cameraAngle * (Math.PI / 180);
        // If distance provided, use it as radius directly. 
        // If not, use 850 (approx diagonal of 600,600)
        const radius = cameraDistance ? cameraDistance : 850; 

        // 0 deg = Looking North (Camera at South/+Z) -> z = +r
        // 180 deg = Looking South (Camera at North/-Z) -> z = -r
        // 90 deg = Looking East (Camera at West/-X) -> x = -r
        
        const offsetX = -radius * Math.sin(rad);
        const offsetZ = radius * Math.cos(rad);
        
        finalCamPos = target.clone().add(new THREE.Vector3(offsetX, dist, offsetZ));
        
        // If specific distance provided, we might want to adjust the Y height? 
        // For now, let's assume 'dist' variable is used for Y if angle is NOT set, 
        // but if angle IS set, we need a height component.
        // The previous logic used 'dist' (600) as height. 
        // Let's use the provided distance as both radius and height for 'angled' view 
        // OR keep height fixed/derived.
        // Let's assume 'cameraDistance' means "distance from target center".
        
        // However, existing logic passed 600 for (dist, dist, dist).
        // Let's stick to using 'radius' for horizontal offset and 'dist' for height.
        // If the user provides 'cameraDistance', use that for both roughly.
        finalCamPos.y = target.y + (cameraDistance ? cameraDistance * 0.7 : 600);

    } else {
        // Default (North-East-ish look)
        finalCamPos = target.clone().add(new THREE.Vector3(dist, dist, dist));
    }

    // Calculate distance to determine duration
    const currentPos = camera.position.clone();
    const distanceToTarget = currentPos.distanceTo(finalCamPos);
    
    // Dynamic duration: min 1500ms, max 2500ms based on distance
    const baseDuration = 1500;
    const additionalDuration = Math.min(1000, (distanceToTarget / 5000) * 1000);
    const duration = baseDuration + additionalDuration;

    // Detect if we are zooming out (going higher)
    const isZoomingOut = finalCamPos.y > currentPos.y;
    // Step 1: Delay vertical movement ONLY if zooming in (descending), creating a "swoop"
    // If zooming out, start rising immediately to avoid dragging across the ground
    const zoomDelay = isZoomingOut ? 0 : 200;

    // Animate X and Z (Pan/Rotate)
    new TWEEN.Tween(camera.position)
        .to({ x: finalCamPos.x, z: finalCamPos.z }, duration)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start();

    // Animate Y (Zoom) with delay logic
    new TWEEN.Tween(camera.position)
        .to({ y: finalCamPos.y }, duration)
        .delay(zoomDelay)
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
    onNeedsRerender: () => void
) => {
    if (!controls || !camera) return;

    // Use current state to zoom out from WHERE WE ARE, not where we started
    const target = controls.target.clone();
    const initialPos = camera.position.clone();

    const direction = new THREE.Vector3().subVectors(initialPos, target).normalize();

    // If direction is zero (camera on target), assume up
    if (direction.lengthSq() < 0.0001) {
        direction.set(0, 1, 0);
    }
    
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
