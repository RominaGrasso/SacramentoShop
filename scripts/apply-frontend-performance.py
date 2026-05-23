#!/usr/bin/env python3
"""
Apply frontend performance attributes across HTML:
- loading=lazy / decoding=async on below-the-fold images
- preserve eager loading for hero, logo, first carousel slide
- cache-bust ?v= on styles.css and core JS
- optional width/height for gallery/carousel CLS
"""
from __future__ import annotations

import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
PERF_VERSION = "20260522perf"

CORE_JS = (
    "index.js",
    "orders.js",
    "whatsapp.js",
    "payments-api-config.js",
    "language-init.js",
    "booking-date-picker.js",
    "category-landing.js",
    "day-page.js",
    "night-page.js",
    "aftertour-page.js",
    "payment-pages.js",
)

HTML_GLOB = [
    "Home/*.html",
    "Actividades/*.html",
    "index.html",
]

SKIP_HTML_PARTS = (
    "/Assets/images/",
    "saved_resource",
)


def should_process(path: Path) -> bool:
    s = str(path)
    return path.suffix == ".html" and not any(p in s for p in SKIP_HTML_PARTS)


def collect_html_files() -> list[Path]:
    out: list[Path] = []
    for pattern in HTML_GLOB:
        out.extend(ROOT.glob(pattern))
    return sorted({p.resolve() for p in out if should_process(p)})


def parent_classes(elem) -> str:
    parts: list[str] = []
    p = elem.parent
    while p and getattr(p, "name", None):
        parts.extend(p.get("class") or [])
        p = p.parent
    return " ".join(parts)


def in_selector(elem, *tokens: str) -> bool:
    blob = parent_classes(elem) + " " + " ".join(elem.get("class") or [])
    return any(t in blob for t in tokens)


def is_header_logo(img) -> bool:
    p = img.parent
    while p and getattr(p, "name", None):
        if p.name == "header":
            return True
        if "logo" in (p.get("class") or []):
            return True
        p = p.parent
    return False


def carousel_track(img):
    p = img.parent
    while p and getattr(p, "name", None):
        if "carousel-track" in (p.get("class") or []):
            return p
        p = p.parent
    return None


def is_first_carousel_image(img) -> bool:
    track = carousel_track(img)
    if not track:
        return False
    imgs = track.find_all("img")
    return bool(imgs) and imgs[0] is img


def is_critical_image(img, path: Path) -> bool:
    if is_header_logo(img):
        return True
    if in_selector(img, "whatsapp-float", "taxi-float"):
        return True
    if in_selector(img, "hero") or "hero-floating-img" in (img.get("class") or []):
        return True
    if img.get("id") in ("lightboxImg",):
        return True
    if in_selector(img, "lightbox-overlay", "lightbox-content") and img.get("id") == "lightboxImg":
        return True
    if is_first_carousel_image(img):
        return True
    src = (img.get("src") or "").lower()
    if src.endswith(".svg"):
        return True
    return False


def apply_image_dims(img) -> None:
    if img.get("width") and img.get("height"):
        return
    if in_selector(img, "carousel-track", "gallery-grid", "card-image", "coffee-gallery"):
        img["width"] = "1200"
        img["height"] = "220"
    elif in_selector(img, "home-about-collage", "home-about-mobile-gallery"):
        if not img.get("width"):
            img["width"] = "400"
            img["height"] = "300"
    elif "hero-floating-img" in (img.get("class") or []):
        img["width"] = "190"
        img["height"] = "240"
    elif in_selector(img, "footer-partners", "partners-strip"):
        img["width"] = "120"
        img["height"] = "48"


def apply_image_attrs(soup: BeautifulSoup, path: Path) -> int:
    changed = 0
    for img in soup.find_all("img"):
        before = str(img.attrs)
        apply_image_dims(img)

        critical = is_critical_image(img, path)
        if critical:
            if img.has_attr("loading"):
                del img["loading"]
            img["decoding"] = "async"
            if "hero-floating-img" in (img.get("class") or []):
                img["fetchpriority"] = "high"
        else:
            img["loading"] = "lazy"
            img["decoding"] = "async"
            if img.has_attr("fetchpriority"):
                del img["fetchpriority"]

        if str(img.attrs) != before:
            changed += 1
    return changed


def apply_video_preload(soup: BeautifulSoup) -> int:
    changed = 0
    for video in soup.find_all("video"):
        track = None
        p = video.parent
        while p and getattr(p, "name", None):
            if "carousel-track" in (p.get("class") or []):
                track = p
                break
            p = p.parent
        if not track:
            continue
        slides = track.find_all(["img", "video"], recursive=False)
        if not slides:
            slides = track.find_all(["img", "video"])
        if slides and slides[0] is not video:
            if video.get("preload") != "none":
                video["preload"] = "none"
                changed += 1
    return changed


def bump_url_in_attr(url: str) -> str:
    if not url or url.startswith("data:") or url.startswith("#"):
        return url
    if "?" in url:
        base = url.split("?", 1)[0]
    else:
        base = url
    name = base.rsplit("/", 1)[-1]
    if name == "styles.css" or name in CORE_JS:
        return f"{base}?v={PERF_VERSION}"
    return url


def bump_style_backgrounds(style: str) -> str:
    def repl(m: re.Match) -> str:
        url = m.group(1).strip("'\"")
        if "Assets/images/" not in url or "?v=" in url:
            return m.group(0)
        sep = "&" if "?" in url else "?"
        return f"url('{url}{sep}v={PERF_VERSION}')"
    return re.sub(r"url\((['\"]?)([^)'\"]+)\1\)", repl, style)


def process_html(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    soup = BeautifulSoup(raw, "html.parser")

    img_changes = apply_image_attrs(soup, path)
    vid_changes = apply_video_preload(soup)

    for tag in soup.find_all(style=True):
        new_style = bump_style_backgrounds(tag["style"])
        if new_style != tag["style"]:
            tag["style"] = new_style

    out = str(soup)

    # Cache-bust link[rel=stylesheet] and script[src] for core assets
    def link_repl(m: re.Match) -> str:
        return f'{m.group(1)}{bump_url_in_attr(m.group(2))}{m.group(3)}'

    out = re.sub(
        r'(<link[^>]+href=["\'])([^"\']*styles\.css[^"\']*)(["\'])',
        link_repl,
        out,
        flags=re.I,
    )
    for js in CORE_JS:
        out = re.sub(
            rf'(<script[^>]+src=["\'])([^"\']*{re.escape(js)}[^"\']*)(["\'])',
            link_repl,
            out,
            flags=re.I,
        )

    out = re.sub(r"</img>", "", out, flags=re.I)

    if out != raw:
        path.write_text(out, encoding="utf-8")

    return {"file": str(path.relative_to(ROOT)), "images": img_changes, "videos": vid_changes, "written": out != raw}


def bump_stylesheet_urls() -> int:
    css_path = ROOT / "Styles" / "styles.css"
    text = css_path.read_text(encoding="utf-8")
    def repl(m: re.Match) -> str:
        url = m.group(1)
        if "Assets/images/" not in url:
            return m.group(0)
        if "?v=" in url:
            base = url.split("?", 1)[0]
            return f'url("{base}?v={PERF_VERSION}")'
        return f'url("{url}?v={PERF_VERSION}")'

    new_text = re.sub(r'url\(["\']?(\.\./Assets/images/[^"\')?]+)["\']?\)', repl, text)
    if new_text != text:
        css_path.write_text(new_text, encoding="utf-8")
    return int(new_text != text)


def main() -> None:
    results = [process_html(p) for p in collect_html_files()]
    css_bumped = bump_stylesheet_urls()
    touched = [r for r in results if r["written"]]
    print(f"PERF_VERSION={PERF_VERSION}")
    print(f"HTML files updated: {len(touched)} / {len(results)}")
    print(f"styles.css background cache-bust: {css_bumped}")
    total_img = sum(r["images"] for r in results)
    print(f"Image attribute updates: {total_img}")


if __name__ == "__main__":
    main()
