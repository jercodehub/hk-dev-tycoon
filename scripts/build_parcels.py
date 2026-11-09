#!/usr/bin/env python3
"""Aggregate BD residential buildings into ~400 map parcels.

Source: Buildings Department open data (樓宇資料及樓齡紀錄), dataset
hk-bd-opendata-building-information. Only 住宅/綜合用途 records are kept
(座 and 平台). They are binned on a 0.01° grid per district — about one
kilometre — so the game draws a few hundred static parcels instead of
~40,000 interactive building markers.

Output records have no prices. Game money is calibrated later from RVD
region averages, never from a per-parcel or per-district official price.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

SOURCE_URL = (
    "https://static.csdi.gov.hk/csdi-webpage/download/"
    "0e55c533715b5da3ae0ca6e6024e90b4/csv"
)
DATASET_URL = (
    "https://data.gov.hk/en-data/dataset/hk-bd-opendata-building-information"
)
RESIDENTIAL_USAGE = "住宅/綜合用途"
GRID_DEGREES = 0.01
LAT_MIN, LAT_MAX = 22.08, 22.62
LNG_MIN, LNG_MAX = 113.75, 114.55

DISTRICTS = [
    "中西區",
    "灣仔區",
    "東區",
    "南區",
    "油尖旺區",
    "深水埗區",
    "九龍城區",
    "黃大仙區",
    "觀塘區",
    "沙田區",
    "大埔區",
    "北區",
    "元朗區",
    "屯門區",
    "荃灣區",
    "葵青區",
    "西貢區",
    "離島區",
]
DISTRICT_REGION = {
    "中西區": "港島",
    "灣仔區": "港島",
    "東區": "港島",
    "南區": "港島",
    "油尖旺區": "九龍",
    "深水埗區": "九龍",
    "九龍城區": "九龍",
    "黃大仙區": "九龍",
    "觀塘區": "九龍",
    "沙田區": "新界",
    "大埔區": "新界",
    "北區": "新界",
    "元朗區": "新界",
    "屯門區": "新界",
    "荃灣區": "新界",
    "葵青區": "新界",
    "西貢區": "新界",
    "離島區": "新界",
}
DISTRICT_CODE = {
    "中西區": "CW",
    "灣仔區": "WC",
    "東區": "EA",
    "南區": "SO",
    "油尖旺區": "YTM",
    "深水埗區": "SSP",
    "九龍城區": "KC",
    "黃大仙區": "WTS",
    "觀塘區": "KT",
    "沙田區": "ST",
    "大埔區": "TP",
    "北區": "NO",
    "元朗區": "YL",
    "屯門區": "TM",
    "荃灣區": "TW",
    "葵青區": "KWT",
    "西貢區": "SK",
    "離島區": "IS",
}


def canon_district(name: str) -> str | None:
    name = (name or "").strip()
    if name in DISTRICTS:
        return name
    if name and not name.endswith("區"):
        candidate = name + "區"
        if candidate in DISTRICTS:
            return candidate
    return None


def clean(value: str | None) -> str:
    return " ".join((value or "").replace("\u3000", " ").split())


def clean_address(value: str | None) -> str:
    text = clean(value)
    # A few BD rows append the literal token "null" after the address.
    if text.lower().endswith("null"):
        text = text[:-4].rstrip(" ,;")
    return text


def parse_year(value: str | None) -> int | None:
    text = (value or "").strip()
    if len(text) >= 4 and text[:4].isdigit() and (len(text) == 4 or text[4] == "-"):
        year = int(text[:4])
        if 1900 <= year <= 2100:
            return year
    return None


def usage_of(type_label: str) -> str:
    return type_label.split("（", 1)[0].strip()


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(
        url, headers={"User-Agent": "hk-dev-tycoon/build-parcels"}
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        dest.write_bytes(resp.read())


def iter_csv_rows(path: Path):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            names = [n for n in archive.namelist() if n.lower().endswith(".csv")]
            if not names:
                raise SystemExit(f"No CSV inside {path}")
            with archive.open(names[0]) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                yield from csv.DictReader(text)
        return
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def buildings_from_csv(path: Path) -> list[dict]:
    rows = []
    for row in iter_csv_rows(path):
        district = canon_district(row.get("SEARCH1_C") or "")
        if district is None:
            continue
        usage = clean(row.get("NSEARCH5_C")) or clean(row.get("NSEARCH5_E"))
        if usage != RESIDENTIAL_USAGE:
            continue
        year = parse_year(row.get("NSEARCH3_C") or row.get("NSEARCH3_E"))
        if year is None:
            continue
        try:
            lat = float((row.get("LATITUDE") or "").strip())
            lng = float((row.get("LONGITUDE") or "").strip())
        except ValueError:
            continue
        if not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
            continue
        address = clean_address(row.get("ADDRESS_C")) or clean_address(row.get("ADDRESS_E"))
        rows.append(
            {"district": district, "year": year, "lat": lat, "lng": lng, "addr": address}
        )
    return rows


def buildings_from_overview_json(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for district, items in payload.items():
        name = canon_district(district)
        if name is None or not isinstance(items, list):
            continue
        for item in items:
            if usage_of(str(item.get("type") or "")) != RESIDENTIAL_USAGE:
                continue
            rows.append(
                {
                    "district": name,
                    "year": int(item["year"]),
                    "lat": float(item["lat"]),
                    "lng": float(item["lng"]),
                    "addr": clean_address(item.get("addr")),
                }
            )
    return rows


def aggregate(buildings: list[dict], grid: float) -> tuple[list[dict], dict]:
    buckets: dict[tuple, list[dict]] = defaultdict(list)
    for building in buildings:
        key = (
            building["district"],
            round(building["lat"] / grid),
            round(building["lng"] / grid),
        )
        buckets[key].append(building)

    grouped: dict[str, list[dict]] = defaultdict(list)
    for (district, _lat_i, _lng_i), members in buckets.items():
        lat = sum(item["lat"] for item in members) / len(members)
        lng = sum(item["lng"] for item in members) / len(members)
        years = sorted(item["year"] for item in members)
        median_year = years[len(years) // 2]
        sample = min(
            members,
            key=lambda item: (item["lat"] - lat) ** 2 + (item["lng"] - lng) ** 2,
        )
        grouped[district].append(
            {
                "district": district,
                "region": DISTRICT_REGION[district],
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "buildings": len(members),
                "medianYear": median_year,
                "sampleAddress": sample["addr"],
            }
        )

    parcels = []
    for district in DISTRICTS:
        cells = sorted(grouped.get(district, []), key=lambda item: (item["lat"], item["lng"]))
        code = DISTRICT_CODE[district]
        width = max(2, len(str(len(cells))))
        for index, cell in enumerate(cells, start=1):
            cell["id"] = f"{code}-{index:0{width}d}"
            parcels.append(cell)

    stats = {
        "residentialBuildings": len(buildings),
        "parcelCount": len(parcels),
        "byDistrict": {
            district: sum(1 for parcel in parcels if parcel["district"] == district)
            for district in DISTRICTS
        },
    }
    return parcels, stats


def build_payload(buildings: list[dict], grid: float) -> dict:
    parcels, stats = aggregate(buildings, grid)
    if not 300 <= stats["parcelCount"] <= 500:
        raise SystemExit(
            f"Expected roughly 400 parcels at grid {grid}, got {stats['parcelCount']}"
        )
    return {
        "source": {
            "provider": "屋宇署",
            "providerEn": "Buildings Department",
            "dataset": "hk-bd-opendata-building-information",
            "datasetUrl": DATASET_URL,
            "downloadUrl": SOURCE_URL,
            "usage": RESIDENTIAL_USAGE,
            "usageNote": (
                "屋宇署私人住宅標成「住宅/綜合用途」，沒有再拆純住宅。"
                "座同平台都計入聚合，寫字樓、工業、其他唔計。"
            ),
            "gridDegrees": grid,
            "aggregation": (
                "每區按約 0.01 度網格聚合。地圖只畫呢幾百個地段，"
                "唔係五萬個可點樓宇標記。"
            ),
            "noPrices": "地段檔沒有樓價。遊戲數值另行用差餉署全港指數同港島／九龍／新界平均售價校準。",
            "residentialBuildings": stats["residentialBuildings"],
            "parcelCount": stats["parcelCount"],
            "byDistrict": stats["byDistrict"],
        },
        "parcels": parcels,
    }


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--buildings",
        type=Path,
        help="Overview-style buildings.json keyed by district. Downloads the BD CSV when omitted.",
    )
    parser.add_argument(
        "--csv",
        type=Path,
        help="Local BD CSV or zip. Used when --buildings is omitted and a download is not wanted.",
    )
    parser.add_argument("--url", default=SOURCE_URL)
    parser.add_argument("--grid", type=float, default=GRID_DEGREES)
    parser.add_argument("--output", type=Path, default=Path("data/parcels.json"))
    args = parser.parse_args()

    if args.buildings is not None:
        buildings = buildings_from_overview_json(args.buildings)
    else:
        csv_path = args.csv
        if csv_path is None:
            csv_path = Path("/tmp/hk-bd-building-information.csv")
            print(f"Downloading {args.url}", file=sys.stderr)
            download(args.url, csv_path)
        buildings = buildings_from_csv(csv_path)

    if not buildings:
        raise SystemExit("No residential buildings to aggregate")

    payload = build_payload(buildings, args.grid)
    write_json(args.output, payload)
    print(
        json.dumps(
            {
                "output": str(args.output),
                "bytes": args.output.stat().st_size,
                "residentialBuildings": payload["source"]["residentialBuildings"],
                "parcelCount": payload["source"]["parcelCount"],
                "shaTin": payload["source"]["byDistrict"]["沙田區"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
