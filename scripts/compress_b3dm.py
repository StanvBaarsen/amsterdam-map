import struct
import json
import os
import sys
import subprocess
import shutil

def compress_file(file_path):
    print(f"Processing {file_path}...")
    with open(file_path, 'rb') as f:
        data = f.read()

    # Parse Header
    magic = data[0:4]
    if magic != b'b3dm':
        print(f"Skipping {file_path}: Not a b3dm file.")
        return

    version = struct.unpack('<I', data[4:8])[0]
    byte_length = struct.unpack('<I', data[8:12])[0]
    ft_json_len = struct.unpack('<I', data[12:16])[0]
    ft_bin_len = struct.unpack('<I', data[16:20])[0]
    bt_json_len = struct.unpack('<I', data[20:24])[0]
    bt_bin_len = struct.unpack('<I', data[24:28])[0]

    # Offsets
    ft_json_start = 28
    ft_bin_start = ft_json_start + ft_json_len
    bt_json_start = ft_bin_start + ft_bin_len
    bt_bin_start = bt_json_start + bt_json_len
    glb_start = bt_bin_start + bt_bin_len

    # Extract GLB
    glb_data = data[glb_start:]
    
    # Save GLB to temp file
    temp_glb = "temp.glb"
    temp_out_glb = "temp_draco.glb"
    
    with open(temp_glb, 'wb') as f:
        f.write(glb_data)
        
    # Compress with gltf-pipeline
    # -d for Draco, --draco.compressionLevel 10 for max compression
    try:
        # Check if already compressed (heuristic: check extensions in inspect_b3dm, but here we just try to compress)
        # Using npx gltf-pipeline
        result = subprocess.run(
            ["npx", "gltf-pipeline", "-i", temp_glb, "-o", temp_out_glb, "-d", "--draco.compressionLevel", "10"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"Error compressing GLB: {result.stderr}")
            os.remove(temp_glb)
            return

        with open(temp_out_glb, 'rb') as f:
            new_glb_data = f.read()
            
        # Clean up temp files
        os.remove(temp_glb)
        os.remove(temp_out_glb)
        
        # Reconstruct B3DM
        # Header + FT + BT + New GLB
        
        # We need to keep alignment. 
        # The previous parts (FT/BT) are already aligned from the previous file structure 
        # (assuming they were correct). We just append the new GLB.
        # However, checking alignment of the GLB start again just in case.
        
        padding_needed = glb_start % 8
        if padding_needed != 0:
            # This shouldn't happen if the file was valid, 
            # but if we modified BT before, we ensured padding there.
            pass

        # Construct new file data
        new_data = data[0:glb_start] + new_glb_data
        
        # Update byteLength in header (pos 8-12)
        new_byte_length = len(new_data)
        new_byte_length_packed = struct.pack('<I', new_byte_length)
        
        new_data = new_data[0:8] + new_byte_length_packed + new_data[12:]
        
        # Write back
        with open(file_path, 'wb') as f:
            f.write(new_data)
            
        original_mb = len(data) / 1024 / 1024
        new_mb = len(new_data) / 1024 / 1024
        print(f"Compressed {file_path}: {original_mb:.2f} MB -> {new_mb:.2f} MB ({(1 - new_mb/original_mb)*100:.1f}%)")

    except Exception as e:
        print(f"Exception during compression: {e}")
        if os.path.exists(temp_glb): os.remove(temp_glb)
        if os.path.exists(temp_out_glb): os.remove(temp_out_glb)

def main():
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if os.path.isfile(path):
            compress_file(path)
        elif os.path.isdir(path):
            files = []
            for root, dirs, f_list in os.walk(path):
                for file in f_list:
                    if file.endswith(".b3dm"):
                        files.append(os.path.join(root, file))
            
            print(f"Found {len(files)} files to compress.")
            for i, f in enumerate(files):
                print(f"[{i+1}/{len(files)}] ", end='')
                compress_file(f)
    else:
        print("Usage: python compress_b3dm.py <file_or_directory>")

if __name__ == "__main__":
    main()
