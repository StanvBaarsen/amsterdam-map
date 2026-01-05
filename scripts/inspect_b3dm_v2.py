import struct
import json
import sys
import os

def read_b3dm(file_path):
    with open(file_path, 'rb') as f:
        # Header
        magic = f.read(4).decode('utf-8')
        version = struct.unpack('<I', f.read(4))[0]
        byte_length = struct.unpack('<I', f.read(4))[0]
        feature_table_json_byte_length = struct.unpack('<I', f.read(4))[0]
        feature_table_binary_byte_length = struct.unpack('<I', f.read(4))[0]
        batch_table_json_byte_length = struct.unpack('<I', f.read(4))[0]
        batch_table_binary_byte_length = struct.unpack('<I', f.read(4))[0]

        print(f"Magic: {magic}")
        print(f"Version: {version}")
        print(f"Batch Table JSON Length: {batch_table_json_byte_length}")

        # Skip Feature Table
        f.seek(28 + feature_table_json_byte_length + feature_table_binary_byte_length)

        # Read Batch Table JSON
        if batch_table_json_byte_length > 0:
            batch_table_json_data = f.read(batch_table_json_byte_length)
            try:
                batch_table = json.loads(batch_table_json_data.decode('utf-8'))
                print("\nBatch Table Keys:", list(batch_table.keys()))
                if 'attributes' in batch_table:
                    print("\n'attributes' found. First item:")
                    attrs = batch_table['attributes']
                    if len(attrs) > 0:
                        print(attrs[0])
                else:
                    print("\n'attributes' NOT found in Batch Table.")
                    # Print first few keys/values to see what's there
                    for k, v in list(batch_table.items())[:5]:
                        print(f"{k}: {v[:5] if isinstance(v, list) else v}")
            except Exception as e:
                print(f"Error parsing Batch Table JSON: {e}")
        else:
            print("No Batch Table JSON")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_b3dm.py <path_to_b3dm>")
    else:
        read_b3dm(sys.argv[1])