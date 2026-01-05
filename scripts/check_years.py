import struct
import json
import sys
import os

def check_years(file_path):
    with open(file_path, 'rb') as f:
        # Header
        magic = f.read(4).decode('utf-8')
        version = struct.unpack('<I', f.read(4))[0]
        byte_length = struct.unpack('<I', f.read(4))[0]
        feature_table_json_byte_length = struct.unpack('<I', f.read(4))[0]
        feature_table_binary_byte_length = struct.unpack('<I', f.read(4))[0]
        batch_table_json_byte_length = struct.unpack('<I', f.read(4))[0]
        batch_table_binary_byte_length = struct.unpack('<I', f.read(4))[0]

        # Skip Feature Table
        f.seek(28 + feature_table_json_byte_length + feature_table_binary_byte_length)

        # Read Batch Table JSON
        if batch_table_json_byte_length > 0:
            batch_table_json_data = f.read(batch_table_json_byte_length)
            try:
                batch_table = json.loads(batch_table_json_data.decode('utf-8'))
                
                years = []
                if 'attributes' in batch_table:
                    attrs = batch_table['attributes']
                    for attr in attrs:
                        data = attr
                        if isinstance(attr, str):
                            try:
                                data = json.loads(attr)
                            except:
                                data = {}
                        
                        year = data.get('oorspronkelijkbouwjaar') or data.get('bouwjaar') or 0
                        years.append(year)
                
                total = len(years)
                valid = sum(1 for y in years if y > 0)
                
                print(f"File: {os.path.basename(file_path)}")
                print(f"Total buildings: {total}")
                print(f"Valid years: {valid} ({valid/total*100:.1f}%)")
                
                # Histogram
                if valid > 0:
                    print("Sample years:", [y for y in years if y > 0][:10])
                
            except Exception as e:
                print(f"Error parsing Batch Table JSON: {e}")
        else:
            print("No Batch Table JSON")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_years.py <path_to_b3dm>")
    else:
        check_years(sys.argv[1])
