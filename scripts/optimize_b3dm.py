import struct
import json
import os
import sys

def optimize_file(file_path):
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

    # Extract parts
    ft_json_data = data[ft_json_start:ft_bin_start]
    ft_bin_data = data[ft_bin_start:bt_json_start]
    bt_json_data = data[bt_json_start:bt_bin_start]
    bt_bin_data = data[bt_bin_start:glb_start]
    glb_data = data[glb_start:]

    # Optimize Batch Table JSON
    if bt_json_len > 0:
        try:
            bt_json = json.loads(bt_json_data.decode('utf-8'))
            if 'attributes' in bt_json:
                new_attributes = []
                for attr in bt_json['attributes']:
                    # We assume attr is a dict (JSON object)
                    # If it's a string (JSON stringified), parse it first
                    obj = attr
                    if isinstance(attr, str):
                        try:
                            obj = json.loads(attr)
                        except:
                            pass 
                    
                    new_obj = {}
                    if isinstance(obj, dict):
                        # Keep only necessary fields
                        # oorspronkelijkbouwjaar is critical
                        if 'oorspronkelijkbouwjaar' in obj:
                            new_obj['oorspronkelijkbouwjaar'] = obj['oorspronkelijkbouwjaar']
                        elif 'bouwjaar' in obj:
                            new_obj['oorspronkelijkbouwjaar'] = obj['bouwjaar']
                            
                        # Keep ID just in case
                        if 'identificatie' in obj:
                            new_obj['identificatie'] = obj['identificatie']
                    
                    new_attributes.append(new_obj)
                
                bt_json['attributes'] = new_attributes
                
                # Reserialize
                new_bt_json_str = json.dumps(bt_json, separators=(',', ':'))
                new_bt_json_bytes = new_bt_json_str.encode('utf-8')
                
                # Padding to 8-byte boundary
                # The total length of header + FT + BT should be 8-byte aligned usually?
                # Actually, in b3dm, the padding is part of the chunk.
                # BT JSON must end on 8-byte boundary relative to start of file? 
                # No, typically 4-byte or 8-byte alignment for the next chunk.
                # GLB usually requires 4-byte alignment, 8-byte is safer.
                
                remainder = len(new_bt_json_bytes) % 8
                padding = 0
                if remainder > 0:
                    padding = 8 - remainder
                
                new_bt_json_bytes += b' ' * padding
                
                new_bt_json_len = len(new_bt_json_bytes)
                
                # Reconstruct
                new_byte_length = 28 + ft_json_len + ft_bin_len + new_bt_json_len + bt_bin_len + len(glb_data)
                
                # New Header
                new_header = struct.pack('<4sIIIIII', magic, version, new_byte_length, 
                                         ft_json_len, ft_bin_len, new_bt_json_len, bt_bin_len)
                
                with open(file_path, 'wb') as f:
                    f.write(new_header)
                    f.write(ft_json_data)
                    f.write(ft_bin_data)
                    f.write(new_bt_json_bytes)
                    f.write(bt_bin_data)
                    f.write(glb_data)
                
                original_mb = byte_length / 1024 / 1024
                new_mb = new_byte_length / 1024 / 1024
                print(f"Optimized {file_path}: {original_mb:.2f} MB -> {new_mb:.2f} MB ({(1 - new_mb/original_mb)*100:.1f}%)")

        except Exception as e:
            print(f"Error optimizing {file_path}: {e}")

def main():
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if os.path.isfile(path):
            optimize_file(path)
        elif os.path.isdir(path):
            for root, dirs, files in os.walk(path):
                for file in files:
                    if file.endswith(".b3dm"):
                        optimize_file(os.path.join(root, file))
    else:
        print("Usage: python optimize_b3dm.py <file_or_directory>")

if __name__ == "__main__":
    main()
