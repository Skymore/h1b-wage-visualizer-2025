#!/usr/bin/env python3
"""
Extract H1B wage levels for Software Developers and Petroleum Engineers
from OFLC 2025-2026 wage data files.
"""

import pandas as pd
import sys

# 40 major metro areas to analyze
METRO_AREAS = [
    "New York-Newark-Jersey City, NY-NJ",
    "Los Angeles-Long Beach-Anaheim, CA",
    "Chicago-Naperville-Elgin, IL-IN",
    "Dallas-Fort Worth-Arlington, TX",
    "Houston-Pasadena-The Woodlands, TX",
    "Washington-Arlington-Alexandria, DC-VA-MD-WV",
    "Miami-Fort Lauderdale-West Palm Beach, FL",
    "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
    "Atlanta-Sandy Springs-Roswell, GA",
    "Phoenix-Mesa-Chandler, AZ",
    "Boston-Cambridge-Newton, MA-NH",
    "San Francisco-Oakland-Fremont, CA",
    "Riverside-San Bernardino-Ontario, CA",
    "Detroit-Warren-Dearborn, MI",
    "Seattle-Tacoma-Bellevue, WA",
    "Minneapolis-St. Paul-Bloomington, MN-WI",
    "San Diego-Chula Vista-Carlsbad, CA",
    "Tampa-St. Petersburg-Clearwater, FL",
    "Denver-Aurora-Centennial, CO",
    "St. Louis, MO-IL",
    "Baltimore-Columbia-Towson, MD",
    "Charlotte-Concord-Gastonia, NC-SC",
    "Orlando-Kissimmee-Sanford, FL",
    "San Antonio-New Braunfels, TX",
    "Portland-Vancouver-Hillsboro, OR-WA",
    "Sacramento-Roseville-Folsom, CA",
    "Pittsburgh, PA",
    "Austin-Round Rock-San Marcos, TX",
    "Las Vegas-Henderson-North Las Vegas, NV",
    "Cincinnati, OH-KY-IN",
    "Kansas City, MO-KS",
    "Columbus, OH",
    "Indianapolis-Carmel-Greenwood, IN",
    "Cleveland, OH",
    "San Jose-Sunnyvale-Santa Clara, CA",
    "Nashville-Davidson--Murfreesboro--Franklin, TN",
    "Jacksonville, FL",
    "Raleigh-Cary, NC",
    "Milwaukee-Waukesha, WI",
    "Madison, WI",
]

# SOC codes for the two occupations
SOC_CODES = {
    "Software Developers": "15-1252",
    "Petroleum Engineers": "17-2171",
}


def load_geography_mapping():
    """Load geography data and create area code to name mapping."""
    print("Loading geography data...", file=sys.stderr)
    geo_df = pd.read_csv("Geography.csv", dtype=str)

    # Create mapping of area name to area code
    # Group by Area to get unique area codes and their names
    area_mapping = geo_df.groupby('Area')['AreaName'].first().to_dict()

    return area_mapping


def find_metro_area_codes(area_mapping, metro_areas):
    """Find area codes for specified metro areas."""
    metro_codes = {}

    for metro in metro_areas:
        # Try to find exact match
        found = False
        for area_code, area_name in area_mapping.items():
            if metro.lower() in area_name.lower() or area_name.lower() in metro.lower():
                # More precise matching
                metro_core = metro.split(',')[0].strip()
                area_core = area_name.split(',')[0].strip()

                if metro_core.lower() == area_core.lower():
                    metro_codes[metro] = area_code
                    found = True
                    break

        if not found:
            print(f"Warning: Could not find area code for {metro}", file=sys.stderr)

    return metro_codes


def extract_wage_data(soc_code, metro_codes):
    """Extract wage data for a specific SOC code across metro areas."""
    print(f"Loading wage data for SOC {soc_code}...", file=sys.stderr)

    # Read the ALC_Export.csv file
    # We'll read it in chunks to handle the large file size
    wage_data = []

    area_codes_set = set(metro_codes.values())

    for chunk in pd.read_csv("ALC_Export.csv", chunksize=10000, dtype={'Area': str, 'SocCode': str}):
        # Filter for our SOC code and metro areas
        filtered = chunk[
            (chunk['SocCode'] == soc_code) &
            (chunk['Area'].isin(area_codes_set))
        ]

        if not filtered.empty:
            wage_data.append(filtered)

    if not wage_data:
        print(f"No data found for SOC {soc_code}", file=sys.stderr)
        return pd.DataFrame()

    wage_df = pd.concat(wage_data, ignore_index=True)

    return wage_df


def process_occupation(occupation_name, soc_code, metro_codes):
    """Process wage data for one occupation."""
    print(f"\n{'='*80}", file=sys.stderr)
    print(f"Processing: {occupation_name} ({soc_code})", file=sys.stderr)
    print(f"{'='*80}", file=sys.stderr)

    wage_df = extract_wage_data(soc_code, metro_codes)

    if wage_df.empty:
        print(f"No wage data found for {occupation_name}", file=sys.stderr)
        return None

    # Create reverse mapping from area code to metro name
    code_to_metro = {v: k for k, v in metro_codes.items()}

    # Add metro name column
    wage_df['Metro'] = wage_df['Area'].map(code_to_metro)

    # Convert hourly wages to annual (multiply by 2080)
    wage_df['L1_yr'] = wage_df['Level1'].astype(float) * 2080
    wage_df['L2_yr'] = wage_df['Level2'].astype(float) * 2080
    wage_df['L3_yr'] = wage_df['Level3'].astype(float) * 2080
    wage_df['L4_yr'] = wage_df['Level4'].astype(float) * 2080

    # Select and sort columns
    result_df = wage_df[['Metro', 'Area', 'L1_yr', 'L2_yr', 'L3_yr', 'L4_yr']].copy()
    result_df = result_df.sort_values('L2_yr')

    return result_df


def format_currency(value):
    """Format number as currency."""
    return f"${value:,.0f}"


def print_table(df, occupation_name):
    """Print formatted table."""
    print(f"\n{occupation_name}")
    print("=" * 120)
    print(f"{'Metro Area':<50} {'Area Code':>10} {'L1 (Annual)':>15} {'L2 (Annual)':>15} {'L3 (Annual)':>15} {'L4 (Annual)':>15}")
    print("-" * 120)

    for _, row in df.iterrows():
        print(f"{row['Metro']:<50} {row['Area']:>10} {format_currency(row['L1_yr']):>15} {format_currency(row['L2_yr']):>15} {format_currency(row['L3_yr']):>15} {format_currency(row['L4_yr']):>15}")

    print()


def main():
    """Main processing function."""
    # Load geography mapping
    area_mapping = load_geography_mapping()

    # Find area codes for metro areas
    print("\nFinding area codes for metro areas...", file=sys.stderr)
    metro_codes = find_metro_area_codes(area_mapping, METRO_AREAS)
    print(f"Found {len(metro_codes)} out of {len(METRO_AREAS)} metro areas", file=sys.stderr)

    # Process each occupation
    results = {}
    for occupation_name, soc_code in SOC_CODES.items():
        result_df = process_occupation(occupation_name, soc_code, metro_codes)
        if result_df is not None:
            results[occupation_name] = result_df
            print_table(result_df, occupation_name)

            # Also save to CSV
            filename = f"{occupation_name.replace(' ', '_')}_wages.csv"
            result_df.to_csv(filename, index=False)
            print(f"Saved to {filename}", file=sys.stderr)

    print("\nProcessing complete!", file=sys.stderr)


if __name__ == "__main__":
    main()
