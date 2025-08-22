#!/usr/bin/env python3
"""
Script to split CSV files by month using only standard library modules.
Keeps headers and removes duplicates.
"""

import csv
import os
from datetime import datetime
from pathlib import Path
import glob
from collections import defaultdict

def parse_timestamp(timestamp_str):
    """Parse timestamp string to datetime object."""
    try:
        # Handle the format: 2022-02-15T19:30:03.5628781Z
        # Remove the 'Z' and parse
        timestamp_str = timestamp_str.rstrip('Z')
        if '.' in timestamp_str:
            # Split at the decimal point and limit microseconds to 6 digits
            date_part, microseconds = timestamp_str.split('.')
            microseconds = microseconds[:6].ljust(6, '0')  # Pad or truncate to 6 digits
            timestamp_str = f"{date_part}.{microseconds}"
            return datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
        else:
            return datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
    except ValueError as e:
        print(f"    Warning: Could not parse timestamp '{timestamp_str}': {e}")
        return None

def get_year_month(dt):
    """Get year-month string from datetime object."""
    if dt is None:
        return "unknown"
    return dt.strftime('%Y-%m')

def split_csv_by_month(input_file_path, output_dir):
    """Split a CSV file by month based on origin_timestamp_utc column."""
    
    print(f"Processing: {os.path.basename(input_file_path)}")
    
    # Try different encodings
    encodings_to_try = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    
    for encoding in encodings_to_try:
        try:
            # Read the CSV file and group by month
            monthly_data = defaultdict(list)
            headers = None
            timestamp_col_index = None
            seen_rows = set()  # For duplicate detection
            duplicate_count = 0
            total_rows = 0
            
            with open(input_file_path, 'r', encoding=encoding, newline='') as csvfile:
                reader = csv.reader(csvfile)
                
                # Read headers
                headers = next(reader)
                
                # Find the timestamp column index
                try:
                    timestamp_col_index = headers.index('origin_timestamp_utc')
                except ValueError:
                    print(f"  Warning: 'origin_timestamp_utc' column not found in {input_file_path}")
                    return
                
                # Process each row
                for row in reader:
                    total_rows += 1
                    
                    # Create a tuple of the row for duplicate detection
                    row_tuple = tuple(row)
                    
                    # Check for duplicates
                    if row_tuple in seen_rows:
                        duplicate_count += 1
                        continue
                    seen_rows.add(row_tuple)
                    
                    # Parse timestamp and get year-month
                    if timestamp_col_index < len(row):
                        timestamp_str = row[timestamp_col_index]
                        dt = parse_timestamp(timestamp_str)
                        year_month = get_year_month(dt)
                    else:
                        year_month = "unknown"
                    
                    # Add row to the appropriate month group
                    monthly_data[year_month].append(row)
            
            if duplicate_count > 0:
                print(f"  Removed {duplicate_count} duplicate rows")
            
            # Get the base filename without extension
            base_filename = Path(input_file_path).stem
            
            # Write each month's data to a separate file
            for year_month, rows in monthly_data.items():
                if not rows:
                    continue
                    
                output_filename = f"{base_filename}_{year_month}.csv"
                output_path = os.path.join(output_dir, output_filename)
                
                with open(output_path, 'w', encoding='utf-8', newline='') as csvfile:
                    writer = csv.writer(csvfile)
                    
                    # Write headers
                    writer.writerow(headers)
                    
                    # Write data rows
                    writer.writerows(rows)
                
                print(f"  Created: {output_filename} ({len(rows)} rows)")
            
            # If we get here, the encoding worked
            print(f"  Successfully processed using {encoding} encoding")
            return
                
        except UnicodeDecodeError:
            # Try next encoding
            continue
        except Exception as e:
            print(f"  Error processing {input_file_path} with {encoding}: {str(e)}")
            break
    
    # If we get here, none of the encodings worked
    print(f"  Could not process {input_file_path} with any encoding")

def main():
    # Define paths
    input_dir = "/Users/danielwolthers/Documents/GitHub/mails-dashboard/all reports"
    output_dir = "/Users/danielwolthers/Documents/GitHub/mails-dashboard/all reports/split_by_month"
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all CSV files in the input directory
    csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
    
    print(f"Found {len(csv_files)} CSV files to process")
    print(f"Output directory: {output_dir}")
    print("-" * 50)
    
    # Process each CSV file
    for csv_file in csv_files:
        split_csv_by_month(csv_file, output_dir)
        print()
    
    print("Processing complete!")
    
    # Show summary of output directory
    output_files = glob.glob(os.path.join(output_dir, "*.csv"))
    print(f"Generated {len(output_files)} split files")

if __name__ == "__main__":
    main()