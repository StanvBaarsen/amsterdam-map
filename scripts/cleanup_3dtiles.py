import json
import os
from pathlib import Path

DIRS_TO_CLEAN = [
    "public/amsterdam_3dtiles_lod22",
    "public/amsterdam_3dtiles_lod12",
    "public/amsterdam_3dtiles_lod13"
]

def get_referenced_files(tileset_path):
    with open(tileset_path, 'r') as f:
        tileset = json.load(f)
    
    referenced = set()
    referenced.add("tileset.json")
    
    def traverse(node):
        if "content" in node:
            uri = node["content"]["uri"]
            referenced.add(uri)
            # Also add the directory structure leading to it?
            # No, we just check files.
            
        if "children" in node:
            for child in node["children"]:
                traverse(child)
                
    traverse(tileset["root"])
    return referenced

def cleanup_directory(dir_path):
    dir_path = Path(dir_path)
    if not dir_path.exists():
        print(f"Directory {dir_path} does not exist.")
        return

    tileset_path = dir_path / "tileset.json"
    if not tileset_path.exists():
        print(f"No tileset.json found in {dir_path}")
        return

    print(f"Cleaning {dir_path}...")
    referenced_files = get_referenced_files(tileset_path)
    print(f"  Tileset references {len(referenced_files)} files.")
    
    deleted_count = 0
    
    # Walk the directory
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            # Get relative path from dir_path
            abs_path = Path(root) / file
            rel_path = abs_path.relative_to(dir_path)
            
            # Convert to string and forward slashes for comparison
            rel_path_str = str(rel_path).replace("\\", "/")
            
            if rel_path_str not in referenced_files:
                # print(f"  Deleting unreferenced file: {rel_path_str}")
                abs_path.unlink()
                deleted_count += 1
                
    # Clean empty directories
    for root, dirs, files in os.walk(dir_path, topdown=False):
        for name in dirs:
            d = Path(root) / name
            if not any(d.iterdir()):
                d.rmdir()
                # print(f"  Removed empty directory: {d}")

    print(f"  Deleted {deleted_count} unreferenced files.")

def main():
    for d in DIRS_TO_CLEAN:
        cleanup_directory(d)

if __name__ == "__main__":
    main()
