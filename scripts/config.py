import re
from pathlib import Path

def get_amsterdam_bounds(buffer_percent=0.6):
    """
    Parses the bounds from ThreeViewer.tsx and returns them with an optional buffer.
    """
    viewer_path = Path(__file__).parent.parent / "src/components/ThreeViewer.tsx"
    
    with open(viewer_path, 'r') as f:
        content = f.read()
        
    # Regex to find the bounds definitions
    # const minRDX = 119000;
    bounds = {}
    for var in ["minRDX", "maxRDX", "minRDY", "maxRDY"]:
        match = re.search(f"const {var} = (\d+);", content)
        if match:
            bounds[var] = int(match.group(1))
        else:
            raise ValueError(f"Could not find {var} in ThreeViewer.tsx")
            
    # Map to the keys used in scripts
    # min_x, max_x, min_y, max_y
    
    width = bounds["maxRDX"] - bounds["minRDX"]
    height = bounds["maxRDY"] - bounds["minRDY"]
    
    # Calculate buffer
    # buffer_percent of 4.0 means we fetch 4x the width on each side
    # e.g. center + (0.5 + 4.0) * width
    effective_buffer = max(buffer_percent, 4.0)
    
    buffer_x = width * effective_buffer
    buffer_y = height * effective_buffer
    
    return {
        "min_x": int(bounds["minRDX"] - buffer_x),
        "max_x": int(bounds["maxRDX"] + buffer_x),
        "min_y": int(bounds["minRDY"] - buffer_y),
        "max_y": int(bounds["maxRDY"] + buffer_y)
    }

if __name__ == "__main__":
    print("Parsed Bounds (with 20% buffer):")
    print(get_amsterdam_bounds())
