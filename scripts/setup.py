import subprocess
import sys
import os
import shutil
from pathlib import Path

def load_env_file():
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        print(f"Loading environment variables from {env_path}")
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

def check_env_vars():
    required_vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    missing_vars = [var for var in required_vars if var not in os.environ]
    
    if missing_vars:
        print("Error: Missing required environment variables:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\nPlease set them in your .env file or environment.")
        sys.exit(1)
    print("Environment variables check passed.")

def run_script(script_name, args=None, is_node=False):
    print(f"--- Running {script_name} ---")
    script_dir = Path(__file__).parent.resolve()
    script_path = script_dir / script_name
    project_root = script_dir.parent
    
    if is_node:
        cmd = ["node", str(script_path)]
    else:
        cmd = [sys.executable, str(script_path)]

    if args:
        cmd.extend(args)
        
    # Run from project root so "data/" paths are relative to root
    result = subprocess.run(cmd, check=False, cwd=str(project_root))
    if result.returncode != 0:
        print(f"Error running {script_name}")
        sys.exit(result.returncode)
    print(f"--- Finished {script_name} ---\n")

def main():
    print("Starting setup...")
    
    load_env_file()
    check_env_vars()
    
    # 1. Download Basemap
    run_script("download_basemap.py")
    
    # 2. Download LOD 1.2 and 2.2
    run_script("download_amsterdam_lods.py")

    # 3. Optimize B3DM files
    print("Optimization will strip unused attributes to reduce file size.")
    run_script("optimize_b3dm.py", args=["data/amsterdam_3dtiles_lod12/tiles/"])
    run_script("optimize_b3dm.py", args=["data/amsterdam_3dtiles_lod22/tiles/"])
    
    # 4. Upload to R2
    # ask if user wants to upload
    user_input = input("Do you want to upload the map data to R2 now? (y/n): ")
    if user_input.lower() == 'y':
        run_script("upload_to_r2.js", is_node=True)
    else:
        print("Skipping upload to R2.")

    
    print("Setup complete! Map data is ready and uploaded.")

if __name__ == "__main__":
    main()
