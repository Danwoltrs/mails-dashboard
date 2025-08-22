#!/usr/bin/env python3
"""
Script to split CSV files by month, keeping headers and removing duplicates.
"""

import pandas as pd
import os
from datetime import datetime
from pathlib import Path
import glob

def split_csv_by_month(input_file_path, output_dir):
    """Split a CSV file by month based on origin_timestamp_utc column."""
    
    print(f"Processing: {input_file_path}")
    
    try:
        # Read the CSV file
        df = pd.read_csv(input_file_path)
        
        # Check if the required column exists
        if 'origin_timestamp_utc' not in df.columns:
            print(f"  Warning: 'origin_timestamp_utc' column not found in {input_file_path}")
            return
        
        # Convert timestamp column to datetime
        df['origin_timestamp_utc'] = pd.to_datetime(df['origin_timestamp_utc'])
        
        # Remove duplicates based on all columns
        initial_count = len(df)
        df = df.drop_duplicates()
        duplicate_count = initial_count - len(df)
        if duplicate_count > 0:
            print(f"  Removed {duplicate_count} duplicate rows")
        
        # Extract year-month for grouping
        df['year_month'] = df['origin_timestamp_utc'].dt.to_period('M')
        
        # Get the base filename without extension
        base_filename = Path(input_file_path).stem
        
        # Group by month and save each group
        for period, group in df.groupby('year_month'):
            # Drop the temporary year_month column
            group = group.drop('year_month', axis=1)
            
            # Create output filename
            output_filename = f"{base_filename}_{period}.csv"
            output_path = os.path.join(output_dir, output_filename)
            
            # Save the group to CSV
            group.to_csv(output_path, index=False)
            print(f"  Created: {output_filename} ({len(group)} rows)")
            
    except Exception as e:
        print(f"  Error processing {input_file_path}: {str(e)}")

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

if __name__ == "__main__":
    main()