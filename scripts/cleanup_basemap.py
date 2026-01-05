import os
import shutil
import math
import xml.etree.ElementTree as ET
from pathlib import Path
try:
    from config import get_amsterdam_bounds
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).parent))
    from config import get_amsterdam_bounds

# Configuration
AMSTERDAM_BOUNDS = get_amsterdam_bounds(buffer_percent=0.6)
print(f"Using bounds: {AMSTERDAM_BOUNDS}")

TILES_DIR = Path("public/basemap/tiles")
CAPABILITIES_FILE = Path("public/basemap/capabilities.xml")
TILE_MATRIX_SET = "EPSG:28992"

NAMESPACES = {
    "wmts": "http://www.opengis.net/wmts/1.0",
    "ows": "http://www.opengis.net/ows/1.1"
}

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
        
        pixel_size = scale_denom * 0.00028
        
        matrices[identifier] = {
            "identifier": identifier,
            "top_left_x": top_left_x,
            "top_left_y": top_left_y,
            "tile_span_x": tile_width * pixel_size,
            "tile_span_y": tile_height * pixel_size,
            "matrix_width": matrix_width,
            "matrix_height": matrix_height
        }
    return matrices

def main():
    if not CAPABILITIES_FILE.exists():
        print("Capabilities file not found.")
        return

    tree = ET.parse(CAPABILITIES_FILE)
    root = tree.getroot()
    tms_element = get_tile_matrix_set(root)
    if not tms_element:
        print("TileMatrixSet not found.")
        return

    matrices = parse_tile_matrices(tms_element)
    
    deleted_files = 0
    deleted_dirs = 0

    # Iterate over level directories
    if not TILES_DIR.exists():
        print("Tiles directory not found.")
        return

    for level_dir in TILES_DIR.iterdir():
        if not level_dir.is_dir():
            continue
            
        level_id = level_dir.name
        if level_id not in matrices:
            print(f"Unknown level {level_id}, skipping...")
            continue
            
        matrix = matrices[level_id]
        
        # Calculate valid range
        min_col = math.floor((AMSTERDAM_BOUNDS["min_x"] - matrix["top_left_x"]) / matrix["tile_span_x"])
        max_col = math.floor((AMSTERDAM_BOUNDS["max_x"] - matrix["top_left_x"]) / matrix["tile_span_x"])
        
        min_row = math.floor((matrix["top_left_y"] - AMSTERDAM_BOUNDS["max_y"]) / matrix["tile_span_y"])
        max_row = math.floor((matrix["top_left_y"] - AMSTERDAM_BOUNDS["min_y"]) / matrix["tile_span_y"])
        
        # Clamp
        min_col = max(0, min_col)
        max_col = min(matrix["matrix_width"] - 1, max_col)
        min_row = max(0, min_row)
        max_row = min(matrix["matrix_height"] - 1, max_row)
        
        print(f"Level {level_id}: Valid Cols {min_col}-{max_col}, Valid Rows {min_row}-{max_row}")
        
        # Check columns
        for col_dir in level_dir.iterdir():
            if not col_dir.is_dir():
                continue
                
            try:
                col = int(col_dir.name)
            except ValueError:
                continue
                
            if col < min_col or col > max_col:
                shutil.rmtree(col_dir)
                deleted_dirs += 1
                # print(f"Deleted column {col} in level {level_id}")
                continue
                
            # Check rows in valid column
            for tile_file in col_dir.iterdir():
                if tile_file.suffix != ".png":
                    continue
                    
                try:
                    row = int(tile_file.stem)
                except ValueError:
                    continue
                    
                if row < min_row or row > max_row:
                    tile_file.unlink()
                    deleted_files += 1
                    # print(f"Deleted tile {level_id}/{col}/{row}")
            
            # Remove empty column dir
            if not any(col_dir.iterdir()):
                col_dir.rmdir()
                deleted_dirs += 1

    print(f"Cleanup complete. Deleted {deleted_files} files and {deleted_dirs} directories.")

if __name__ == "__main__":
    main()
