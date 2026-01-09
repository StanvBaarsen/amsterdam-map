# Copilot Instructions for Amsterdam 2030 Map

This is a React 19 application for visualizing a 3D map of Amsterdam using OGC 3D Tiles. The stack includes Vite, TypeScript, Three.js, and `3d-tiles-renderer`.

## 🏗 Project Architecture

### **Frontend (src/)**
- **Core Component**: `src/components/ThreeViewer.tsx` is the orchestrator. It manages the Three.js scene, camera, and overlay state.
- **Rendering Engine**: Uses raw Three.js with `3d-tiles-renderer` for tile management. It does NOT use `react-three-fiber`.
- **State Management**: Heavily relies on Custom Hooks (`src/hooks/`) for isolating logic (e.g., `useTilesLoader`, `useBasemap`).
- **Coordinate System**: 
  - **Internal**: Three.js world space.
  - **External**: WGS84 (Lat/Lon). 
  - **Conversion**: Uses `src/utils/coords.ts` to convert WGS84 to Dutch RD coordinates (EPSG:28992) for placement. Ideally, logic should respect this projection.

### **Data & Assets (scripts/ & data/)**
- **Data Pipeline**: Python scripts in `scripts/` handle downloading public datasets (PDOK, etc.) and uploading them to Cloudflare R2.
- **Hybrid Hosting**:
  - **Production**: Tiles are served from an external R2 bucket (`VITE_TILE_HOST`).
  - **Development**: If `data/` exists locally, Vite mocks the R2 bucket path to serve files from `/data`.

## 💻 Critical Developer Workflows

### **1. Setup & Data**
Before running the app, ensuring data availability is key.
- Check `scripts/setup.py` for the definitive list of data sources.
- **Local Data**: Place tiles in `data/amsterdam_3dtiles_lod12/` to trigger local serving mode. This sets the global `__USE_LOCAL_DATA__` flag.

### **2. Development Server**
- Run `npm run dev`.
- **Note**: The `vite.config.ts` contains custom middleware (`serve-local-data`) to serve `.b3dm` and `.json` files from the `data/` directory with correct MIME types.

### **3. Coordinate Operations**
When placing markers or cameras:
- **Input**: Typically WGS84 (Lat/Lon).
- **Process**: Convert to RD (Rijksdriehoek) using `wgs84ToRd` from `utils/coords.ts` before mapping to Three.js units.
- **Example**:
  ```typescript
  import { wgs84ToRd } from '../utils/coords';
  const { x, y } = wgs84ToRd(52.37, 4.90);
  // Use x, y for positioning relative to the tile center
  ```

## 🧩 Key Patterns & Conventions

### **3D Tiles Integration**
- **Loading**: Handled by `useTilesLoader.ts`. It initializes `TilesRenderer`, configures the Draco loader, and attaches it to the scene.
- **Re-rendering**: The renderer does not auto-loop. We use a `needsRerender` ref (number) to trigger frames only when necessary (progressive loading).
- **Materials**: Shader injection happens in `useTileShaders.ts` or callbacks in `ThreeViewer.tsx`. We replace materials on the fly to support features like "feature highlighting" or "year filtering".

### **Global Constants**
Globals injected by Vite (defined in `declarations.d.ts`):
- `__USE_LOCAL_DATA__`: Boolean. True if `data/` folder exists in dev.
- `__USE_LOCAL_BASEMAP__`: Boolean.
- `__USE_LOCAL_TILES__`: Boolean.

### **Styling**
- Standard CSS modules or global `App.css`.
- Tailwind is NOT currently in use; stick to standard CSS or existing patterns.

## 🚀 Common Tasks

**Adding a new Overlay**
1. Create a component in `src/components/overlays/`.
2. Import and condition its render in `ThreeViewer.tsx`.
3. Use the `TweneViewerProps` pattern to pass callback handlers (e.g., `onClose`, `onAction`).

**Modifying Tile Appearance**
- Do NOT modify `3d-tiles-renderer` internals.
- Instead, update the `currentYear` or styling props in `ThreeViewer.tsx`, which propagates to `useTileShaders` to update uniform values on existing materials.
