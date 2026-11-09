#!/usr/bin/env python3
"""Refresh the open-data files the game reads.

  data/market-stats.json   RVD unit counts, territory price index,
                           and 港島／九龍／新界 average $/m² only
  data/parcels.json        ~400 parcels aggregated from BD 住宅/綜合用途

Needs network unless you pass local files through to the builders.

  python3 scripts/refresh_data.py
  python3 scripts/refresh_data.py --buildings /path/to/buildings.json
  python3 scripts/refresh_data.py --stock-csv a.csv --prices-csv b.csv --index-csv c.csv --csv buildings.csv
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(argv: list[str]) -> None:
    print("+", " ".join(argv), flush=True)
    subprocess.run(argv, cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--buildings", type=Path, help="Skip the BD download and aggregate this buildings.json.")
    parser.add_argument("--csv", type=Path, help="Local BD building CSV/zip.")
    parser.add_argument("--stock-csv", type=Path, help="Local RVD district stock CSV.")
    parser.add_argument("--prices-csv", type=Path, help="Local RVD 1.2M average-price CSV.")
    parser.add_argument("--index-csv", type=Path, help="Local RVD 1.4M price-index CSV.")
    args = parser.parse_args()

    market_cmd = [sys.executable, "scripts/build_market_stats.py"]
    if args.stock_csv:
        market_cmd += ["--input", str(args.stock_csv)]
    if args.prices_csv:
        market_cmd += ["--prices-input", str(args.prices_csv)]
    if args.index_csv:
        market_cmd += ["--index-input", str(args.index_csv)]
    run(market_cmd)

    parcel_cmd = [sys.executable, "scripts/build_parcels.py"]
    if args.buildings:
        parcel_cmd += ["--buildings", str(args.buildings)]
    elif args.csv:
        parcel_cmd += ["--csv", str(args.csv)]
    run(parcel_cmd)


if __name__ == "__main__":
    main()
