#!/usr/bin/env python3
"""Safe visible-text anonymization: never touch HTML/JS identifiers (id, for, getElementById, keys)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Visible-text replacements only (longest first). Avoid short tokens like "Bruma", "Legado", "Barbot" alone.
VISIBLE_REPLACEMENTS: list[tuple[str, str]] = [
    ("Viñedos y Olivares del Quintón", "A family winery and olive estate near Colonia"),
    ("Picada Quintón", "House charcuterie board"),
    ("Postre Quintón", "House dessert"),
    ("Las Liebres", "A boutique vineyard restaurant"),
    ("Comarca Las Liebres", "A boutique vineyard estate"),
    ("Barbot Brewpub · award-winning craft beer", "Award-winning craft beer brewpub"),
    ("Barbot Brewery Guided Tour", "Local craft brewery guided tour"),
    ("Barbot Brewery Experience", "Local craft brewery experience"),
    ("Barbot Brewery", "A local craft brewery"),
    ("Cervecería Barbot", "Una cervecería artesanal local"),
    ("Barbot Brewpub", "Historic Quarter brewpub"),
    ("Discover the story behind Barbot Brewery", "Discover the story behind the local brewery"),
    ("Two distinct experiences at Barbot Brewery", "Two distinct experiences at the brewery"),
    ("Create your Barbot experience", "Create your brewery experience"),
    ("Build your menu at Barbot", "Build your menu at the brewpub"),
    ("Barbot & brewery", "Craft beer & brewery"),
    ("Bonavena Strong Ale", "Award-winning strong ale"),
    ("Bruma Restaurant Experience", "Boutique restaurant experience"),
    ("La Misión Stay, Bruma Dinner", "Boutique stay & dinner"),
    ("La Misión Stay, SIO Sushi Dinner", "Boutique stay & sushi dinner"),
    ("La Misión Night Experience", "Historic Quarter night experience"),
    ("La Misión posada", "Boutique posada"),
    ("La Misión Stay", "Boutique overnight stay"),
    ("Stay at <strong>La Misión</strong>", "Stay at <strong>a historic posada</strong>"),
    ("La Misión", "A boutique posada"),
    ("Destilería S34 Gin Experience", "Artisan gin distillery experience"),
    ("S34 Gin Experience", "Artisan gin distillery experience"),
    ("Create your S34 experience", "Create your gin distillery experience"),
    ("S34 Gin is an artisan distillery", "This artisan distillery"),
    ("S34 Gin", "Artisan gin"),
    ("Destilería S34", "Artisan gin distillery"),
    ("SIO Sushi Experience", "Premium sushi experience"),
    ("La Misión + SIO Night Experience", "Boutique stay + sushi night"),
    ("SIO's Special Night sushi menu", "Special Night sushi menu"),
    ("dinner at <strong>SIO</strong>", "dinner at <strong>a partner restaurant</strong>"),
    ("dinner at <strong>Bruma</strong>", "dinner at <strong>a partner restaurant</strong>"),
    ("at SIO", "at the restaurant"),
    ("Casa Viera · Romantic Dinner", "Romantic dinner experience"),
    ("Private candlelight dinner at Casa Viera", "Private candlelight dinner in the Historic Quarter"),
    ("Dinner at Casa Petit", "Included dinner"),
    ("Casa Petit by Mercedes", "A partner restaurant"),
    ("premium dinner at Casa Petit by Mercedes", "premium dinner at a partner restaurant"),
    ("Casa Viera", "A partner restaurant"),
    ("Casa Petit", "A partner restaurant"),
    ("La Josefina · Yachting de Colonia", "Waterfront lunch or dinner"),
    ("Restaurante La Josefina", "Partner waterfront restaurant"),
    ("Real Club Náutico", "Local yacht club"),
    ("Colonia Yacht Club", "Local yacht club"),
    ("Chivito El Yachting", "House chivito"),
    ("Try our Chivito · El Refugio", "Try our Chivito"),
    ("El Refugio · Historic Quarter", "Historic Quarter restaurant"),
    ("sandwich at El Refugio", "sandwich at a local grill"),
    ("asado at El Refugio", "asado at a partner grill"),
    ("Reserved table at El Refugio", "Reserved table"),
    ("Arrive at El Refugio", "Arrive at the restaurant"),
    ("El Refugio", "A local grill in the Historic Quarter"),
    ("Wine Tasting at Vinos del Mundo", "Wine tasting in the Historic Quarter"),
    ("Arrive at Vinos del Mundo", "Arrive at the wine shop"),
    ("Vinos del Mundo", "A wine shop in the Historic Quarter"),
    ("Plaza de Toros Experience with Anita's coffee", "Plaza de Toros experience with café stop"),
    ("Anita's café", "A partner café"),
    ("Café Anita", "Historic Quarter café"),
    ("Legado · Boutique winery & tasting", "Boutique winery & tasting"),
    ("Legado · Boutique winery", "Boutique winery experience"),
    ("El Legado is located", "The winery is located"),
    ("El Legado", "A boutique winery"),
    ("La Chopería", "A partner beer hall"),
    ("Café del Río", "A riverside bar"),
    ("Walk with Lupa & Jack · Experience Colonia Like a Local", "Walk with local hosts · Experience Colonia like a local"),
    ("Walk with Lupa & Jack", "Local walking experience"),
    ("Lupa and Jack dog walking experience", "Dog walking experience in Colonia"),
    ("Lupa & Jack", "Local hosts"),
    ("Hosted by Alejandro, owner & captain", "Hosted by your captain"),
    ("Captain Alejandro", "Your boat captain"),
    ("captain Alejandro", "your captain"),
    ("prepared by <strong>Alejandro</strong>", "prepared by <strong>your host</strong>"),
    ("Chefs Bruno and Marcelo", "The chefs"),
    ("Guided by Francisco", "Guided by your host"),
    ("Francisco, distillery manager", "The distillery manager"),
    ("Glass of Deicas wine", "Glass of local wine"),
    ("Horseback riding — Cabal", "Horseback riding in the countryside"),
    ("Gabino — horseback riding", "Horseback riding"),
    ("Refugio experience photo", "Experience photo"),
    ("Refugio experience video", "Experience video"),
    ("The Barbot Brewpub is closed", "The brewpub is closed"),
    ("Hello! I'd like to book Barbot Brewpub", "Hello! I'd like to book the brewpub experience"),
    ("Cervecería Barbot", "cervecería artesanal local"),
    ("visita guiada a la Cervecería Barbot", "visita guiada a una cervecería artesanal local"),
]

# Skip lines that look like identifiers / technical
TECH_LINE = re.compile(
    r"(getElementById|querySelector|popupId|closeBtnId|createBtnId|saveBtnId|"
    r"bookNowBottomId|orderSummaryId|selectedDateKey|data-booking-date-key|"
    r'\bid=["\']|for=["\']|#popup|#close|#bookNow|function |const POPUP|'
    r"window\.|experienceId|storageKey|patterns:|restaurant:)"
)

TRUSTED_START = '<section class="partners">'
TRUSTED_END = "<!-- ================= USEFUL SERVICES"

HTML_FILES = [
    ROOT / "Actividades" / "barbot.html",
    ROOT / "Actividades" / "legado.html",
    ROOT / "Actividades" / "food1.html",
    ROOT / "Actividades" / "walkingtour.html",
    ROOT / "Home" / "barbot-brewpub-hours.js",
    ROOT / "Home" / "barbot-brewpub-order.js",
]


def protect_trusted(content: str) -> tuple[str, str | None]:
    start = content.find(TRUSTED_START)
    if start == -1:
        return content, None
    end = content.find(TRUSTED_END, start)
    if end == -1:
        return content, None
    return content[:start] + "\n__TRUSTED__\n" + content[end:], content[start:end]


def replace_visible_line(line: str) -> str:
    if TECH_LINE.search(line):
        return line
    for old, new in VISIBLE_REPLACEMENTS:
        line = line.replace(old, new)
    return line


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    protected, trusted = protect_trusted(original)
    lines = protected.splitlines(keepends=True)
    updated = "".join(replace_visible_line(ln) for ln in lines)
    if trusted is not None:
        updated = updated.replace("\n__TRUSTED__\n", trusted)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def cleanup_index_js() -> bool:
    path = ROOT / "Home" / "index.js"
    text = path.read_text(encoding="utf-8")
    fixes = [
        ("A boutique winery boutique winery", "A boutique winery"),
        ("A family winery and olive estate near Colonia winery near Colonia", "Family winery and olive estate near Colonia"),
        ("A wine shop in the Historic Quarter wine shop in Colonia", "Wine shop in Colonia's Historic Quarter"),
        ("A boutique restaurant restaurant", "Boutique restaurant"),
        ("a la Una cervecería artesanal local", "a una cervecería artesanal local"),
        ("Experiencia Una cervecería artesanal local", "Experiencia en cervecería artesanal local"),
        ("la Una cervecería artesanal local", "una cervecería artesanal local"),
        ("A local craft brewery’s", "The brewery’s"),
        ("at A local craft brewery in", "at the local brewery in"),
        ("at A local craft brewery ", "at the local brewery "),
        ("to A local craft brewery ", "to the local brewery "),
        ("A local craft brewery —", "Local craft brewery —"),
        ("Your A local craft brewery experience", "Your brewery experience"),
        ("Your A local craft brewery", "Your brewery"),
        ("A local craft brewery and", "The local brewery and"),
        ("A local craft brewery with", "The local brewery with"),
        ("A local craft brewery in", "Local craft brewery in"),
        ("A local craft brewery ", "A local craft brewery "),  # keep for titles
        ("A premium sushi restaurant ", "The premium sushi restaurant "),
        ("Hello! I'd like to book the A premium sushi restaurant", "Hello! I'd like to book the premium sushi"),
        ("The nearby winery estate ", "A family winery and olive estate near Colonia "),
    ]
    for old, new in fixes:
        text = text.replace(old, new)
    # Lowercase mid-sentence "A local craft brewery" when after prepositions in EN review
    text = text.replace("visit to A local craft brewery", "visit to a local craft brewery")
    path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    changed = []
    for path in HTML_FILES:
        if path.exists() and process_file(path):
            changed.append(str(path.relative_to(ROOT)))
    cleanup_index_js()
    changed.append("Home/index.js (cleanup)")
    for p in changed:
        print(p)


if __name__ == "__main__":
    main()
