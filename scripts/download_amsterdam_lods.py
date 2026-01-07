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
AMSTERDAM_BOUNDS = get_amsterdam_bounds()
print(f"Using bounds: {AMSTERDAM_BOUNDS}")

LODS = {
    "lod12": "https://data.3dbag.nl/v20250903/3dtiles/lod12/",
    "lod13": "https://data.3dbag.nl/v20250903/3dtiles/lod13/",
    "lod22": "https://data.3dbag.nl/v20250903/3dtiles/lod22/"
}

def download_file(url, dest_path):
    if os.path.exists(dest_path):
        return False # Skipped
        
    try:
        response = requests.get(url, stream=True, timeout=30)
        if response.status_code == 200:
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        else:
            print(f"Failed to download {url}: {response.status_code}")
            return False
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def is_in_bounds(box, offset_x, offset_y):
    # Box is [cx, cy, cz, extent_x, 0, 0, 0, extent_y, 0, 0, 0, extent_z]
    # Center in Local Space
    cx, cy = box[0], box[1]
    
    # Convert to World (RD)
    world_x = cx + offset_x
    world_y = cy + offset_y
    
    # Check if center is in bounds
    # We can be a bit loose here since we want tiles that *intersect*
    # The box extents are box[3] (x-radius) and box[7] (y-radius) roughly
    radius_x = box[3]
    radius_y = box[7]
    
    min_box_x = world_x - radius_x
    max_box_x = world_x + radius_x
    min_box_y = world_y - radius_y
    max_box_y = world_y + radius_y
    
    # Intersection check
    return not (max_box_x < AMSTERDAM_BOUNDS["min_x"] or
                min_box_x > AMSTERDAM_BOUNDS["max_x"] or
                max_box_y < AMSTERDAM_BOUNDS["min_y"] or
                min_box_y > AMSTERDAM_BOUNDS["max_y"])

def process_node(node, offset_x, offset_y, content_urls, base_url):
    # Check bounding volume
    if "box" in node["boundingVolume"]:
        box = node["boundingVolume"]["box"]
        
        if is_in_bounds(box, offset_x, offset_y):
            if "content" in node:
                uri = node["content"]["uri"]
                content_urls.append(uri)
            
            if "children" in node:
                # Filter children in place to remove those out of bounds
                valid_children = []
                for child in node["children"]:
                    if process_node(child, offset_x, offset_y, content_urls, base_url):
                        valid_children.append(child)
                node["children"] = valid_children
                return True # This node is valid
            return True # Leaf node in bounds
        else:
            return False # Node out of bounds
    return False

def process_lod(lod_name, base_url):
    print(f"Processing {lod_name}...")
    output_dir = Path(f"data/amsterdam_3dtiles_{lod_name}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    tileset_url = base_url + "tileset.json"
    tileset_path = output_dir / "tileset.json"
    
    print(f"Downloading tileset.json from {tileset_url}...")
    # Always download fresh tileset.json to ensure we start clean
    if os.path.exists(tileset_path):
        os.remove(tileset_path)
        
    if not download_file(tileset_url, tileset_path):
        return

    with open(tileset_path, 'r') as f:
        tileset = json.load(f)

    root = tileset["root"]
    
    # Handle Root Transform
    root_transform = root.get("transform", [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])
    offset_x = root_transform[12]
    offset_y = root_transform[13]
    
    print(f"Root Offset: X={offset_x}, Y={offset_y}")
    
    content_urls = []
    
    # Prune the tree
    if process_node(root, offset_x, offset_y, content_urls, base_url):
        print(f"Found {len(content_urls)} tiles in bounds.")
        
        # Save pruned tileset
        with open(tileset_path, 'w') as f:
            json.dump(tileset, f, indent=2)
            
        # Download content files
        downloaded_count = 0
        skipped_count = 0
        total_files = len(content_urls)
        
        for i, uri in enumerate(content_urls):
            file_url = base_url + uri
            file_path = output_dir / uri
            
            # Handle nested directories in URI
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            if download_file(file_url, file_path):
                downloaded_count += 1
            else:
                skipped_count += 1
                
            if (i + 1) % 50 == 0:
                print(f"Progress: {downloaded_count} downloaded, {skipped_count} skipped / {total_files} total...")
        
        print(f"Finished {lod_name}: {downloaded_count} new, {skipped_count} skipped.")
    else:
        print(f"No tiles found in bounds for {lod_name}.")

def main():
    for lod_name, url in LODS.items():
        process_lod(lod_name, url)

if __name__ == "__main__":
    main()
