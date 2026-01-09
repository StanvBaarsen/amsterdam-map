import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';

interface DebugMonitorProps {
    renderer: THREE.WebGLRenderer | null;
    tilesRef: React.MutableRefObject<any>;
}

export const DebugMonitor: React.FC<DebugMonitorProps> = ({ renderer, tilesRef }) => {
    const [stats, setStats] = useState({
        fps: 0,
        geometries: 0,
        textures: 0,
        drawCalls: 0,
        triangles: 0,
        memory: 0,
        tilesLoaded: 0,
        tilesActive: 0
    });

    const frameRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const framesRef = useRef(0);

    useEffect(() => {
        if (!renderer) return;

        const updateStats = () => {
            const now = performance.now();
            framesRef.current++;

            if (now - lastTimeRef.current >= 1000) {
                const info = renderer.info;
                const memory = (performance as any).memory;
                
                let tilesCount = 0;
                let activeTiles = 0;
                if (tilesRef.current) {
                    // Try to dig into 3d-tiles-renderer internals
                    if (tilesRef.current.stats) {
                        // Some versions expose stats
                    }
                    if (tilesRef.current.visibleTiles) {
                        activeTiles = tilesRef.current.visibleTiles.length;
                    }
                    // Estimate cache size?
                    if (tilesRef.current.lruCache) {
                         // This is private usually, but we can try
                         // @ts-ignore
                         if (tilesRef.current.lruCache.itemList) {
                             // @ts-ignore
                             tilesCount = tilesRef.current.lruCache.itemList.length;
                         }
                    }
                }

                setStats({
                    fps: Math.round((framesRef.current * 1000) / (now - lastTimeRef.current)),
                    geometries: info.memory.geometries,
                    textures: info.memory.textures,
                    drawCalls: info.render.calls,
                    triangles: info.render.triangles,
                    memory: memory ? Math.round(memory.usedJSHeapSize / 1048576) : 0,
                    tilesLoaded: tilesCount,
                    tilesActive: activeTiles
                });

                framesRef.current = 0;
                lastTimeRef.current = now;
            }

            frameRef.current = requestAnimationFrame(updateStats);
        };

        frameRef.current = requestAnimationFrame(updateStats);

        return () => cancelAnimationFrame(frameRef.current);
    }, [renderer, tilesRef]);

    return (
        <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#0f0',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '5px 15px'
        }}>
            <div>DFS: {stats.fps}</div>
            <div>MEM: {stats.memory} MB</div>
            <div>GEO: {stats.geometries}</div>
            <div>TEX: {stats.textures}</div>
            <div>DRW: {stats.drawCalls}</div>
            <div>TRI: {stats.triangles.toLocaleString()}</div>
            <div>Tiles (Cache): {stats.tilesLoaded}</div>
            <div>Tiles (Vis): {stats.tilesActive}</div>
        </div>
    );
};
