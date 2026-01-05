import json
import os
import requests
import math
from pathlib import Path
try:
    from config import get_amsterdam_bounds
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).parent))
    from config import get_amsterdam_bounds

# Configuration
AMSTERDAM_BOUNDS = get_amsterdam_bounds(buffer_percent=0.5)
print(f"Using bounds: {AMSTERDAM_BOUNDS}")

BASE_URL = "https://data.3dbag.nl/v20250903/3dtiles/lod22/"
TILESET_URL = BASE_URL + "tileset.json"
OUTPUT_DIR = "data/amsterdam_3dtiles_lod22"

def download_file(url, dest_path):
    if os.path.exists(dest_path):
        return True

    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    else:
        print(f"Failed to download {url}: {response.status_code}")
        return False

def is_in_bounds(box):
    # Box is [cx, cy, cz, extent_x, 0, 0, 0, extent_y, 0, 0, 0, extent_z]
    # Center
    cx, cy = box[0], box[1]
    # Extents (half-sizes usually in 3D Tiles box definition, but let's check spec)
    # 3D Tiles box: center (3), x-axis (3), y-axis (3), z-axis (3)
    # The vectors define the oriented bounding box.
    # Assuming axis aligned for simplicity or just checking center for now.
    
    # We need to handle the transform if present, but usually leaf tiles in 3DBAG are in RD or similar local grid.
    # Let's assume the box coordinates are comparable to RD if we account for the root transform.
    
    # For now, let's just check if the center is roughly in the box.
    # We might need to be more precise later.
    
    return (AMSTERDAM_BOUNDS["min_x"] <= cx <= AMSTERDAM_BOUNDS["max_x"] and
            AMSTERDAM_BOUNDS["min_y"] <= cy <= AMSTERDAM_BOUNDS["max_y"])

def process_node(node, parent_transform, content_urls):
    # Update transform if present
    # (Simplification: we assume we don't need to compose transforms for the bounding box check 
    # if the tiles are already in a spatial subdivision structure that aligns with the world)
    
    # Check bounding volume
    if "box" in node["boundingVolume"]:
        box = node["boundingVolume"]["box"]
        # If it's a leaf or has content, check if we want it
        if is_in_bounds(box):
            if "content" in node:
                uri = node["content"]["uri"]
                content_urls.append(uri)
            
            if "children" in node:
                for child in node["children"]:
                    process_node(child, None, content_urls)
        else:
            # If parent is not in bounds, children might still be? 
            # Only if the parent covers a larger area that *contains* the bounds.
            # But here we are checking if the tile *intersects* the bounds.
            # If the tile is completely outside, its children are too (usually).
            
            # However, the box check above is "is center in bounds". 
            # A large tile might have center outside but overlap.
            # Let's improve the check.
            pass

def main():
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    print(f"Downloading tileset.json from {TILESET_URL}...")
    tileset_path = os.path.join(OUTPUT_DIR, "tileset.json")
    if not download_file(TILESET_URL, tileset_path):
        return

    with open(tileset_path, 'r') as f:
        tileset = json.load(f)

    root = tileset["root"]
    
    # Handle Root Transform
    root_transform = root.get("transform", [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])
    
    # Extract translation (assuming simple translation/scale, but usually it's just translation for 3DBAG)
    # Matrix is column-major
    # 0  4  8  12
    # 1  5  9  13
    # 2  6  10 14
    # 3  7  11 15
    
    offset_x = root_transform[12]
    offset_y = root_transform[13]
    offset_z = root_transform[14]
    
    print(f"Root Transform Offset: {offset_x}, {offset_y}, {offset_z}")
    
    # Convert Amsterdam Bounds to Local Space
    local_bounds = {
        "min_x": AMSTERDAM_BOUNDS["min_x"] - offset_x,
        "max_x": AMSTERDAM_BOUNDS["max_x"] - offset_x,
        "min_y": AMSTERDAM_BOUNDS["min_y"] - offset_y,
        "max_y": AMSTERDAM_BOUNDS["max_y"] - offset_y
    }
    
    print(f"Local Bounds: {local_bounds}")
    
    print("Analyzing tileset structure...")
    
    # We will collect all URIs that we need to download
    content_uris = []
    
    # Recursive function to traverse and filter
    def traverse(node):
        box = node["boundingVolume"]["box"]
        # Box: center_x, center_y, center_z, x_axis_x, ...
        cx, cy, cz = box[0], box[1], box[2]
        
        # Half-extents (assuming axis aligned for rough check)
        # The box is defined by center and 3 vectors (half-axes)
        # We take the length of these vectors as half-size
        hx = math.sqrt(box[3]**2 + box[4]**2 + box[5]**2)
        hy = math.sqrt(box[6]**2 + box[7]**2 + box[8]**2)
        
        # Check intersection with local_bounds
        # Tile interval: [cx-hx, cx+hx]
        # Bounds interval: [min_x, max_x]
        
        overlap_x = (cx - hx) <= local_bounds["max_x"] and (cx + hx) >= local_bounds["min_x"]
        overlap_y = (cy - hy) <= local_bounds["max_y"] and (cy + hy) >= local_bounds["min_y"]
        
        if overlap_x and overlap_y:
            if "content" in node:
                content_uris.append(node["content"]["uri"])
            
            if "children" in node:
                for child in node["children"]:
                    traverse(child)
    
    traverse(root)
    
    print(f"Found {len(content_uris)} tiles to download.")
    
    # Download content files
    for i, uri in enumerate(content_uris):
        url = BASE_URL + uri
        # uri might contain subdirectories like "tiles/12/34.b3dm"
        local_path = os.path.join(OUTPUT_DIR, uri)
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        
        if not os.path.exists(local_path):
            print(f"[{i+1}/{len(content_uris)}] Downloading {uri}...")
            download_file(url, local_path)
        else:
            # print(f"[{i+1}/{len(content_uris)}] Skipping {uri} (already exists)")
            pass

    # We also need to rewrite the tileset.json to remove nodes that we didn't download?
    # Or just keep it as is? If we keep it as is, the viewer will try to load missing tiles and get 404s.
    # Better to prune the tree.
    
    print("Pruning tileset.json...")
    
    def prune(node):
        # Return True if node should be kept (intersects bounds)
        box = node["boundingVolume"]["box"]
        cx, cy, cz = box[0], box[1], box[2]
        hx = math.sqrt(box[3]**2 + box[4]**2 + box[5]**2)
        hy = math.sqrt(box[6]**2 + box[7]**2 + box[8]**2)
        
        overlap_x = (cx - hx) <= local_bounds["max_x"] and (cx + hx) >= local_bounds["min_x"]
        overlap_y = (cy - hy) <= local_bounds["max_y"] and (cy + hy) >= local_bounds["min_y"]
        
        if not (overlap_x and overlap_y):
            return False
            
        if "children" in node:
            node["children"] = [child for child in node["children"] if prune(child)]
            
        return True

    if prune(root):
        tileset["root"] = root
        with open(os.path.join(OUTPUT_DIR, "tileset.json"), 'w') as f:
            json.dump(tileset, f, indent=2)
        print("Saved pruned tileset to tileset.json")
    else:
        print("Error: Root node was pruned! Check bounds.")

if __name__ == "__main__":
    main()
