import subprocess
import sys
from pathlib import Path

def run_script(script_name):
    print(f"--- Running {script_name} ---")
    script_path = Path(__file__).parent / script_name
    result = subprocess.run([sys.executable, str(script_path)], check=False)
    if result.returncode != 0:
        print(f"Error running {script_name}")
        sys.exit(result.returncode)
    print(f"--- Finished {script_name} ---\n")

def main():
    print("Starting setup...")
    
    # 1. Download Basemap
    run_script("download_basemap.py")
    
    # 2. Download LOD 2.2
    run_script("download_amsterdam.py")
    
    # 3. Download LOD 1.2/1.3
    run_script("download_amsterdam_lods.py")
    
    print("Setup complete! Map data is ready.")

if __name__ == "__main__":
    main()
