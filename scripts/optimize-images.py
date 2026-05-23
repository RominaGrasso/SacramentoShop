#!/usr/bin/env python3
"""
Optimize SacramentoShop raster images: resize by usage tier, compress JPEG/PNG, emit WebP.
Updates HTML/CSS/JS references from .jpg/.jpeg/.png to .webp when a WebP was created.
Skips SVG, favicon, small logos, and files already small enough.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from PIL import Image, ImageFile, ImageOps

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "Assets" / "images"
REPORT_PATH = ROOT / "scripts" / "image-optimization-report.json"

SKIP_NAMES = {
    "favicon.png",
    "operador-turistico-registrado.png",
    "qr-code.png",
    "logoetaxi.jpg",
    "barbotlogo.jpg",
    "LogoFinal.png",
    "SacramentoLogo1.png",
    "SacramentoLogo2.png",
}

# CSS hero / full-bleed backgrounds (max width 1920)
HERO_FILES = {
    "colonia.jpg",
    "bed1.jpg",
    "romantic-dinner.jpg",
    "plaza.jpg",
    "ref161.jpg",
    "cab3.jpg",
    "lieb2121.jpg",
    "lieb1.jpg",
    "day2.jpg",
    "bruma2.jpg",
    "night2.jpg",
    "toros4.jpg",
    "mision1.jpg",
    "sushin.jpg",
    "sio1.jpg",
    "boat4.jpg",
    "asado12.jpg",
    "delrio1.jpg",
    "barbot-2.jpg",
    "matescon1.jpeg",
    "petit2.jpg",
    "barbtour.jpg",
}

# About / team portraits
TEAM_PREFIXES = (
    "romi",
    "romiperfil",
    "alan",
    "adri",
    "maru",
    "mati",
    "lau",
    "sele",
    "jack",
    "grupo",
    "SA-",
    "selenamaite",
)

TIERS = {
    "hero": 1920,
    "card": 1200,
    "team": 960,
    "default": 1400,
}

JPEG_QUALITY = 86
WEBP_QUALITY = 82
MIN_SKIP_BYTES = 45_000
MIN_SKIP_MAX_DIM = 900


def tier_for(name: str) -> str:
    lower = name.lower()
    if lower in HERO_FILES or lower.replace(".jpeg", ".jpg") in HERO_FILES:
        return "hero"
    for p in TEAM_PREFIXES:
        if lower.startswith(p.lower()):
            return "team"
    return "card"


def should_skip(path: Path, size: int) -> str | None:
    if path.suffix.lower() == ".svg":
        return "svg"
    if path.name in SKIP_NAMES:
        return "skip_list"
    if path.suffix.lower() == ".webp":
        return "already_webp"
    if path.stem.lower().startswith("logo") and size < 150_000:
        return "logo_small"
    if size < MIN_SKIP_BYTES:
        try:
            with Image.open(path) as im:
                w, h = im.size
            if max(w, h) <= MIN_SKIP_MAX_DIM:
                return "already_small"
        except Exception:
            return "read_error"
    return None


def resize_if_needed(im: Image.Image, max_w: int) -> Image.Image:
    w, h = im.size
    if w <= max_w:
        return im
    new_h = max(1, round(h * max_w / w))
    return im.resize((max_w, new_h), Image.Resampling.LANCZOS)


def save_jpeg(im: Image.Image, dest: Path) -> None:
    rgb = im.convert("RGB") if im.mode not in ("RGB", "L") else im
    rgb.save(
        dest,
        format="JPEG",
        quality=JPEG_QUALITY,
        optimize=True,
        progressive=True,
        subsampling="4:2:0",
    )


def save_webp(im: Image.Image, dest: Path) -> None:
    im.save(dest, format="WEBP", quality=WEBP_QUALITY, method=4)


def save_png(im: Image.Image, dest: Path) -> None:
    im.save(dest, format="PNG", optimize=True, compress_level=9)


def process_image(path: Path) -> dict:
    orig_size = path.stat().st_size
    skip = should_skip(path, orig_size)
    if skip:
        return {"file": path.name, "skipped": skip, "bytes_before": orig_size}

    tier = tier_for(path.name)
    max_w = TIERS["hero" if tier == "hero" else "team" if tier == "team" else "card"]

    ext = path.suffix.lower()
    webp_path = path.with_suffix(".webp")
    tmp_jpg = path.with_suffix(path.suffix + ".opt.tmp")

    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            im = resize_if_needed(im, max_w)

            webp_path.parent.mkdir(parents=True, exist_ok=True)
            save_webp(im, webp_path)
            webp_size = webp_path.stat().st_size

            kept_jpg = False
            jpg_after = orig_size
            if ext in (".jpg", ".jpeg"):
                save_jpeg(im, tmp_jpg)
                jpg_after = tmp_jpg.stat().st_size
                if jpg_after < orig_size * 0.98:
                    tmp_jpg.replace(path)
                    kept_jpg = True
                else:
                    tmp_jpg.unlink(missing_ok=True)
            elif ext == ".png":
                ptmp = path.with_name(path.stem + ".opt.png")
                save_png(im, ptmp)
                if ptmp.stat().st_size < orig_size * 0.98:
                    ptmp.replace(path)
                    jpg_after = path.stat().st_size
                else:
                    ptmp.unlink(missing_ok=True)

            use_webp = webp_size < min(jpg_after, orig_size) * 0.95 or ext in (".jpg", ".jpeg")
            return {
                "file": path.name,
                "tier": tier,
                "max_width": max_w,
                "bytes_before": orig_size,
                "bytes_after_jpg": jpg_after if kept_jpg or ext == ".png" else orig_size,
                "bytes_webp": webp_size,
                "webp": webp_path.name,
                "updated_to_webp": use_webp,
                "kept_jpg_fallback": ext in (".jpg", ".jpeg", ".png"),
            }
    except Exception as e:
        return {"file": path.name, "error": str(e), "bytes_before": orig_size}


def update_references(webp_names: set[str]) -> int:
    """Replace .jpg/.jpeg/.png with .webp in project sources when WebP exists."""
    patterns = []
    for w in webp_names:
        base = Path(w).stem
        for ext in (".jpg", ".jpeg", ".png"):
            patterns.append((re.compile(re.escape(base + ext), re.I), base + ".webp"))

    count = 0
    for glob in ("**/*.html", "**/*.css", "**/*.js"):
        for fpath in ROOT.glob(glob):
            if "node_modules" in fpath.parts or ".vendor" in fpath.parts:
                continue
            text = fpath.read_text(encoding="utf-8", errors="replace")
            orig = text
            for rx, repl in patterns:
                text = rx.sub(repl, text)
            if text != orig:
                fpath.write_text(text, encoding="utf-8")
                count += 1
    return count


def main() -> None:
    raster = sorted(
        p
        for p in IMG_DIR.iterdir()
        if p.is_file()
        and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
    )

    total_before = sum(p.stat().st_size for p in raster)
    results = [process_image(p) for p in raster if p.suffix.lower() != ".webp"]

    webp_created = {r["webp"] for r in results if r.get("webp")}
    files_updated = update_references(webp_created)

    total_after = sum(p.stat().st_size for p in IMG_DIR.rglob("*") if p.is_file())

    processed = [r for r in results if not r.get("skipped") and not r.get("error")]
    top_before = sorted(
        [r for r in results if r.get("bytes_before")],
        key=lambda x: x["bytes_before"],
        reverse=True,
    )[:25]

    report = {
        "total_bytes_before": total_before,
        "total_bytes_after_assets": total_after,
        "reduction_bytes": total_before - total_after,
        "reduction_percent": round(100 * (total_before - total_after) / total_before, 1)
        if total_before
        else 0,
        "files_processed": len(processed),
        "files_skipped": len([r for r in results if r.get("skipped")]),
        "files_errors": [r for r in results if r.get("error")],
        "reference_files_updated": files_updated,
        "top_before": top_before,
        "keep_jpg_recommendation": [
            "favicon.png (browser icon)",
            "operador-turistico-registrado.png, qr-code.png (UI badges)",
            "Partner logos (logoliebres, logobarbot, logosio, etc.)",
            "PNG with transparency if any remain",
            "JPEG fallback kept in-place where WebP is primary in HTML",
        ],
        "details": results,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in report if k != "details"}, indent=2))


if __name__ == "__main__":
    main()
