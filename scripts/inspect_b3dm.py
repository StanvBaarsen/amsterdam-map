import struct
import json
import sys
import os

def read_b3dm(file_path):
    with open(file_path, 'rb') as f:
        magic = f.read(4).decode('utf-8')
        version = struct.unpack('<I', f.read(4))[0]
        byte_length = struct.unpack('<I', f.read(4))[0]
        ft_json_len = struct.unpack('<I', f.read(4))[0]
        ft_bin_len = struct.unpack('<I', f.read(4))[0]
        bt_json_len = struct.unpack('<I', f.read(4))[0]
        bt_bin_len = struct.unpack('<I', f.read(4))[0]

        print(f"File: {file_path}")
        print(f"Total Size: {byte_length / 1024 / 1024:.2f} MB")
        print(f"FT JSON: {ft_json_len}, FT BIN: {ft_bin_len}")
        print(f"BT JSON: {bt_json_len}, BT BIN: {bt_bin_len}")
        print(f"GLB (est): {(byte_length - 28 - ft_json_len - ft_bin_len - bt_json_len - bt_bin_len) / 1024 / 1024:.2f} MB")

        # Skip Feature Table
        f.seek(28 + ft_json_len + ft_bin_len)
        
        # Read Batch Table JSON
        if bt_json_len > 0:
            bt_json_data = f.read(bt_json_len)
            try:
                bt_json = json.loads(bt_json_data.decode('utf-8'))
                print("Batch Table Keys:", list(bt_json.keys()))
            except Exception as e:
                print(f"Error parsing BT JSON: {e}")
        
        # Skip Batch Table Binary
        f.seek(bt_bin_len, 1)

        # GLB Header
        glb_magic = f.read(4)
        if glb_magic == b'glTF':
            glb_version = struct.unpack('<I', f.read(4))[0]
            glb_length = struct.unpack('<I', f.read(4))[0]
            print(f"GLB Version: {glb_version}, Length: {glb_length}")
            
            # GLB Chunks
            while f.tell() < 28 + ft_json_len + ft_bin_len + bt_json_len + bt_bin_len + glb_length:
                try:
                    chunk_len = struct.unpack('<I', f.read(4))[0]
                    chunk_type = f.read(4)
                    
                    if chunk_type == b'JSON':
                        json_data = f.read(chunk_len)
                        glb_json = json.loads(json_data.decode('utf-8'))
                        print(f"GLB Extensions Used: {glb_json.get('extensionsUsed', [])}")
                        print(f"GLB Extensions Required: {glb_json.get('extensionsRequired', [])}")
                        break # Just want the JSON
                    else:
                        f.seek(chunk_len, 1)
                except:
                    break
        else:
            print("No valid GLB found (magic mismatch)")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        read_b3dm(sys.argv[1])
    else:
        # Find a default file to test
        for root, dirs, files in os.walk("data"):
            for file in files:
                if file.endswith(".b3dm"):
                    read_b3dm(os.path.join(root, file))
                    sys.exit(0)
