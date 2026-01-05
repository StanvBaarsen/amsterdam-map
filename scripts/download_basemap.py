import os
import math
import requests
import xml.etree.ElementTree as ET
import time
from pathlib import Path
try:
    from config import get_amsterdam_bounds
except ImportError:
    # Fallback if running from root
    import sys
    sys.path.append(str(Path(__file__).parent))
    from config import get_amsterdam_bounds

# PDOK BRT Achtergrondkaart
WMTS_BASE_URL = "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0"
LAYER_NAME = "pastel" # Options: standaard, grijs, pastel, water
TILE_MATRIX_SET = "EPSG:28992"
OUTPUT_DIR = Path("public/basemap/tiles")
CAPABILITIES_FILE = Path("public/basemap/capabilities.xml")

NAMESPACES = {
    "wmts": "http://www.opengis.net/wmts/1.0",
    "ows": "http://www.opengis.net/ows/1.1"
}

def get_buffer_for_level(level_id):
    try:
        level = int(level_id)
    except ValueError:
        return 0.2 # Default
    
    if level <= 9:
        return 2.5 # 250%
    elif level == 10:
        return 1.5 # 150%
    elif level == 11:
        return 0.5 # 50%
    elif level == 12:
        return 0.25 # 25%
    else:
        return 0.1 # 10%

def get_tile_matrix_set(root):
    for tms in root.findall(".//wmts:TileMatrixSet", NAMESPACES):
        ident = tms.find("ows:Identifier", NAMESPACES)
        if ident is not None and ident.text == TILE_MATRIX_SET:
            return tms
    return None

def parse_tile_matrices(tms_element):
    matrices = {}
    for tm in tms_element.findall("wmts:TileMatrix", NAMESPACES):
        identifier = tm.find("ows:Identifier", NAMESPACES).text
        scale_denom = float(tm.find("wmts:ScaleDenominator", NAMESPACES).text)
        top_left = tm.find("wmts:TopLeftCorner", NAMESPACES).text.split()
        top_left_x = float(top_left[0])
        top_left_y = float(top_left[1])
        tile_width = int(tm.find("wmts:TileWidth", NAMESPACES).text)
        tile_height = int(tm.find("wmts:TileHeight", NAMESPACES).text)
        matrix_width = int(tm.find("wmts:MatrixWidth", NAMESPACES).text)
        matrix_height = int(tm.find("wmts:MatrixHeight", NAMESPACES).text)
        
        # OGC standard pixel size is 0.28mm (0.00028m)
        pixel_size = scale_denom * 0.00028
        
        matrices[identifier] = {
            "identifier": identifier,
            "scale_denom": scale_denom,
            "top_left_x": top_left_x,
            "top_left_y": top_left_y,
            "tile_width": tile_width,
            "tile_height": tile_height,
            "matrix_width": matrix_width,
            "matrix_height": matrix_height,
            "pixel_size": pixel_size,
            "tile_span_x": tile_width * pixel_size,
            "tile_span_y": tile_height * pixel_size
        }
    return matrices

def download_tile(layer, tms, matrix, col, row, output_path):
    if output_path.exists():
        return # Skip if already exists
    
    url = f"{WMTS_BASE_URL}/{layer}/{tms}/{matrix}/{col}/{row}.png"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(response.content)
            # print(f"Downloaded {url}")
            time.sleep(0.05) # Be nice to the server
        else:
            print(f"Failed to download {url}: {response.status_code}")
    except Exception as e:
        print(f"Error downloading {url}: {e}")

def main():
    if not CAPABILITIES_FILE.exists():
        print(f"Capabilities file not found at {CAPABILITIES_FILE}")
        return

    tree = ET.parse(CAPABILITIES_FILE)
    root = tree.getroot()
    
    tms_element = get_tile_matrix_set(root)
    if tms_element is None:
        print(f"TileMatrixSet {TILE_MATRIX_SET} not found")
        return
        
    matrices = parse_tile_matrices(tms_element)
    print(f"Found {len(matrices)} tile matrices for {TILE_MATRIX_SET}")
    
    target_levels = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14"] 
    
    total_downloaded = 0
    
    for level_id in target_levels:
        if level_id not in matrices:
            continue
            
        matrix = matrices[level_id]
        buffer_percent = get_buffer_for_level(level_id)
        bounds = get_amsterdam_bounds(buffer_percent=buffer_percent)
        
        print(f"Processing level {level_id} (Scale: {matrix['scale_denom']}) with buffer {buffer_percent*100}%")
        
        min_col = math.floor((bounds["min_x"] - matrix["top_left_x"]) / matrix["tile_span_x"])
        max_col = math.floor((bounds["max_x"] - matrix["top_left_x"]) / matrix["tile_span_x"])
        
        min_row = math.floor((matrix["top_left_y"] - bounds["max_y"]) / matrix["tile_span_y"])
        max_row = math.floor((matrix["top_left_y"] - bounds["min_y"]) / matrix["tile_span_y"])
        
        # Clamp to matrix dimensions
        min_col = max(0, min_col)
        max_col = min(matrix["matrix_width"] - 1, max_col)
        min_row = max(0, min_row)
        max_row = min(matrix["matrix_height"] - 1, max_row)
        
        print(f"  Tile range: Col {min_col}-{max_col}, Row {min_row}-{max_row}")
        
        count = 0
        for col in range(min_col, max_col + 1):
            for row in range(min_row, max_row + 1):
                file_path = OUTPUT_DIR / level_id / str(col) / f"{row}.png"
                download_tile(LAYER_NAME, TILE_MATRIX_SET, level_id, col, row, file_path)
                count += 1
                if count % 100 == 0:
                    print(f"  Downloaded {count} tiles...")
        
        print(f"  Finished level {level_id}: {count} tiles")
        total_downloaded += count

    print(f"Total tiles downloaded: {total_downloaded}")

if __name__ == "__main__":
    main()
