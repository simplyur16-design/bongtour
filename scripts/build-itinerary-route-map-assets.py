#!/usr/bin/env python3
"""Natural Earth 10m land/lakes → data/itinerary-route-maps/*.json (offline bake)."""

from __future__ import annotations

import json
from pathlib import Path

import shapefile  # pyshp
from shapely.geometry import MultiPolygon, Polygon, box, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
LAND_SHP = ROOT / "tmp/geo-src/land10/ne_10m_land.shp"
LAKES_SHP = ROOT / "tmp/geo-src/lakes10/ne_10m_lakes.shp"
OUT_DIR = ROOT / "data/itinerary-route-maps"

REGIONS = {
    "kansai": {
        "bbox": [134.15, 33.85, 136.55, 35.75],
        "simplify": 0.0035,
        "min_area": 0.0008,
        "max_rings": 8,
        "featureLabels": [
            {"ko": "비와호", "lon": 136.18, "lat": 35.25, "kind": "lake"},
            {"ko": "오사카만", "lon": 135.22, "lat": 34.52, "kind": "sea"},
            {"ko": "아와지섬", "lon": 134.92, "lat": 34.28, "kind": "land"},
            {"ko": "기이반도", "lon": 135.85, "lat": 34.2, "kind": "land"},
        ],
        "areaLabels": [
            {"ko": "오사카", "lon": 135.48, "lat": 34.62, "rx": 0.22, "ry": 0.14},
            {"ko": "교토", "lon": 135.72, "lat": 35.08, "rx": 0.2, "ry": 0.13},
            {"ko": "고베", "lon": 135.12, "lat": 34.72, "rx": 0.14, "ry": 0.09},
            {"ko": "나라", "lon": 135.82, "lat": 34.52, "rx": 0.14, "ry": 0.1},
        ],
        "seaLabel": {"ko": "세토내해", "lon": 134.5, "lat": 34.35},
    },
    "kanto": {
        "bbox": [138.6, 34.9, 140.9, 36.4],
        "simplify": 0.004,
        "min_area": 0.001,
        "max_rings": 6,
        "featureLabels": [{"ko": "도쿄만", "lon": 139.85, "lat": 35.4, "kind": "sea"}],
        "seaLabel": {"ko": "태평양", "lon": 140.5, "lat": 35.05},
    },
    "central-vietnam": {
        "bbox": [107.75, 15.55, 108.85, 16.45],
        "simplify": 0.002,
        "min_area": 0.0003,
        "max_rings": 4,
        "featureLabels": [],
        "areaLabels": [
            {"ko": "다낭", "lon": 108.18, "lat": 16.08, "rx": 0.12, "ry": 0.1},
            {"ko": "호이안", "lon": 108.35, "lat": 15.86, "rx": 0.1, "ry": 0.08},
        ],
        "seaLabel": {"ko": "남중국해", "lon": 108.65, "lat": 16.0},
    },
    "japan": {
        "bbox": [128.5, 30.5, 146.0, 45.8],
        "simplify": 0.025,
        "min_area": 0.03,
        "max_rings": 12,
        "featureLabels": [{"ko": "일본", "lon": 138.0, "lat": 36.5, "kind": "land"}],
        "seaLabel": {"ko": "태평양", "lon": 143.5, "lat": 34.5},
    },
    "vietnam": {
        "bbox": [102.0, 8.3, 109.8, 23.5],
        "simplify": 0.015,
        "min_area": 0.01,
        "max_rings": 8,
        "featureLabels": [{"ko": "베트남", "lon": 106.5, "lat": 16.0, "kind": "land"}],
        "seaLabel": {"ko": "남중국해", "lon": 109.0, "lat": 15.0},
    },
}


def load_polygons(shp_path: Path):
    sf = shapefile.Reader(str(shp_path))
    geoms = []
    for sr in sf.iterShapeRecords():
        geom = shape(sr.shape.__geo_interface__)
        if geom.is_empty:
            continue
        if not geom.is_valid:
            geom = make_valid(geom)
        geoms.append(geom)
    return unary_union(geoms)


def rings_from_geom(geom, min_area: float, max_rings: int):
    if geom is None or geom.is_empty:
        return []
    polys = []
    if isinstance(geom, Polygon):
        polys = [geom]
    elif isinstance(geom, MultiPolygon):
        polys = list(geom.geoms)
    else:
        for g in getattr(geom, "geoms", []):
            if isinstance(g, Polygon):
                polys.append(g)
            elif isinstance(g, MultiPolygon):
                polys.extend(list(g.geoms))

    rings = []
    for poly in sorted(polys, key=lambda p: p.area, reverse=True):
        if poly.area < min_area:
            continue
        coords = list(poly.exterior.coords)
        if len(coords) > 1 and coords[0] == coords[-1]:
            coords = coords[:-1]
        # densify-cap: keep readable but not huge
        if len(coords) > 400:
            step = max(1, len(coords) // 320)
            coords = coords[::step]
        rings.append([[round(float(x), 5), round(float(y), 5)] for x, y in coords])
        if len(rings) >= max_rings:
            break
    return rings


def clip_region(land, lakes, cfg):
    west, south, east, north = cfg["bbox"]
    # 뷰 bbox보다 넓게 잘라 직선 클립 엣지가 프레임 밖으로 나가게 함
    span = max(east - west, north - south)
    pad = span * 0.22
    clip = box(west - pad, south - pad, east + pad, north + pad)
    land_c = land.intersection(clip)
    lakes_c = lakes.intersection(clip)
    if not land_c.is_empty:
        land_c = land_c.simplify(cfg["simplify"], preserve_topology=True)
    land_rings = rings_from_geom(land_c, cfg["min_area"], cfg["max_rings"])
    lake_rings = []
    if lakes_c is not None and not lakes_c.is_empty:
        lakes_c = lakes_c.simplify(max(0.001, cfg["simplify"] * 0.6), preserve_topology=True)
        lake_rings = rings_from_geom(lakes_c, cfg["min_area"] * 0.2, 4)
    return land_rings, lake_rings


def main():
    print("loading land 10m…", LAND_SHP)
    land = load_polygons(LAND_SHP)
    print("loading lakes 10m…", LAKES_SHP)
    lakes = load_polygons(LAKES_SHP)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for rid, cfg in REGIONS.items():
        land_rings, lake_rings = clip_region(land, lakes, cfg)
        out = {
            "id": rid,
            "bbox": cfg["bbox"],
            "landRings": land_rings,
            "lakeRings": lake_rings,
            "featureLabels": cfg.get("featureLabels", []),
            "areaLabels": cfg.get("areaLabels", []),
            "seaLabel": cfg.get("seaLabel"),
            "source": "naturalearth_10m",
        }
        path = OUT_DIR / f"{rid}.json"
        path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(
            f"wrote {path.name}: land={len(land_rings)} lakes={len(lake_rings)} "
            f"pts={[len(r) for r in land_rings[:4]]} size={path.stat().st_size}"
        )


if __name__ == "__main__":
    main()
