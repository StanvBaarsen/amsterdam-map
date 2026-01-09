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
                if 'attributes' in bt_json:
                    print("Example 'attributes' entry:", bt_json['attributes'][0] if len(bt_json['attributes']) > 0 else "Empty")
                # Check for large fields
                for k, v in bt_json.items():
                    if isinstance(v, list):
                        print(f"Field '{k}' has {len(v)} elements.")
            except Exception as e:
                print(f"Error parsing BT JSON: {e}")

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
