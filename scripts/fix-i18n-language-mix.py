#!/usr/bin/env python3
"""Fix mixed-language strings in Home/index.js after partner anonymization."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "Home" / "index.js"

# Longest-first per language block
EN_FIXES: list[tuple[str, str]] = [
    ("Private candlelight dinner in the Historic Quarter in the Historic Quarter", "Private candlelight dinner in the Historic Quarter"),
    ("A boutique vineyard restaurant", "a boutique vineyard restaurant"),
    ("A boutique vineyard estate", "a boutique vineyard estate"),
    ("A boutique winery", "a boutique winery"),
    ("A premium sushi restaurant", "the premium sushi restaurant"),
    ("A partner restaurant", "a partner restaurant"),
    ("A partner café", "a partner café"),
    ("A local grill in the Historic Quarter", "a local grill in the Historic Quarter"),
    ("A wine shop in the Historic Quarter", "a wine shop in the Historic Quarter"),
    ("A local craft brewery", "a local craft brewery"),
    ("A boutique posada", "a boutique posada"),
    ("Enjoy an elegant lunch or dinner experience at a boutique vineyard restaurant, a boutique restaurant", "Enjoy an elegant lunch or dinner experience at a boutique vineyard restaurant"),
    ("Enjoy a unique dining experience at a boutique restaurant, a boutique restaurant", "Enjoy a unique dining experience at a boutique restaurant"),
    ("Hello! I'd like to book Try our Chivito at", "Hello! I'd like to book our Chivito at"),
    ("Hello! I'd like to book Historic Quarter + a boutique vineyard restaurant:", "Hello! I'd like to book Historic Quarter + vineyard visit:"),
    ("Hello! I'd like to book the The premium sushi restaurant", "Hello! I'd like to book the premium sushi"),
    ("Historic Quarter & a boutique vineyard restaurant", "Historic Quarter & vineyard visit"),
    ("Guided visit to a boutique vineyard restaurant vineyard", "Guided visit to the vineyard"),
    ("Inside a boutique winery boutique winery", "Inside the boutique winery"),
    ("a boutique winery boutique winery", "the boutique winery"),
    ("a boutique winery winery visit", "boutique winery visit"),
    ("a boutique winery wine tasting", "boutique winery wine tasting"),
    ("a boutique winery vineyard and", "boutique winery vineyard and"),
    ("Your boat captain", "your captain"),
    ("Enjoy an exclusive sunset boat experience along the river with your captain,", "Enjoy an exclusive sunset boat experience along the river with your captain,"),
    ("Enjoy a unique gastronomic experience at a boutique restaurant, a boutique restaurant", "Enjoy a unique gastronomic experience at a boutique restaurant"),
    ("A boutique restaurant offers", "The restaurant offers"),
    ("Where to find A boutique restaurant", "Where to find the restaurant"),
    ("for A boutique restaurant's location", "for the restaurant's location"),
    ('bruma_about_name_word: "A boutique restaurant"', 'bruma_about_name_word: "The restaurant"'),
    ('mision_about_name_bruma: "A boutique restaurant"', 'mision_about_name_bruma: "a partner restaurant"'),
    ('mision_about_name_posada: "A boutique posada"', 'mision_about_name_posada: "a boutique posada"'),
    ('mision_about_name_chef: "The owners"', 'mision_about_name_chef: "the owners"'),
]

ES_FIXES: list[tuple[str, str]] = [
    ("A family winery and olive estate near Colonia", "una bodega familiar con olivares cerca de Colonia"),
    ("A boutique vineyard restaurant", "un restaurante boutique en una bodega"),
    ("A boutique vineyard estate", "una bodega boutique"),
    ("A boutique winery", "una bodega boutique"),
    ("A premium sushi restaurant", "un restaurante de sushi premium"),
    ("The premium sushi restaurant", "el restaurante de sushi premium"),
    ("A partner restaurant", "un restaurante seleccionado"),
    ("A partner café", "un café seleccionado"),
    ("A local grill in the Historic Quarter", "una parrilla local del Barrio Histórico"),
    ("A wine shop in the Historic Quarter", "una vinoteca del Barrio Histórico"),
    ("A local craft brewery", "una cervecería artesanal local"),
    ("A boutique posada", "una posada boutique"),
    ("A boutique restaurant", "un restaurante boutique"),
    ("House charcuterie board", "picada de la casa"),
    ("House dessert", "postre de la casa"),
    ("White blend (Blanc de blancs)", "Blend de blancos"),
    ("Red blend", "Corte de tintas"),
    ("Premium Sushi Experience", "Experiencia de sushi premium"),
    ("Boutique Stay & Sushi Dinner", "Estadía boutique y cena de sushi"),
    ("Boutique Stay & Dinner", "Estadía boutique y cena"),
    ("Historic Quarter Night Experience", "Experiencia nocturna en el Barrio Histórico"),
    ("Wine Tasting in the Historic Quarter", "Cata de vinos en el Barrio Histórico"),
    ("Local craft brewery experience", "Experiencia en cervecería artesanal"),
    ("Historic Quarter Brewpub", "Brewpub del Barrio Histórico"),
    ("Award-winning craft beer brewpub", "Brewpub de cerveza artesanal premiada"),
    ("Waterfront lunch or dinner", "Almuerzo o cena frente al agua"),
    ("Partner waterfront restaurant menu", "Menú del restaurante frente al agua"),
    ("The owner", "La anfitriona"),
    ("The owners", "Los dueños"),
    ("The chefs", "Los cocineros"),
    ("Your captain", "Tu capitán"),
    ("Your host", "Tu anfitrión"),
    ("Guided by your host", "Con guía del anfitrión"),
    ("Glass of local wine", "Copa de vino local"),
    ("Historic Quarter", "Barrio Histórico"),
    ("Boutique Winery & Tasting", "Bodega boutique y degustación"),
    ("Boutique restaurant experience", "Experiencia gastronómica boutique"),
    ("Local walking experience", "Paseo local con anfitriones"),
    ("Local hosts", "Anfitriones locales"),
    ("Horseback riding & wine tasting · un restaurante boutique en una bodega", "Cabalgata y degustación en bodega boutique"),
    ("Experiencia restaurante un restaurante boutique", "Experiencia en restaurante boutique"),
    ("Proba nuestro Chivito · una parrilla local del Barrio Histórico", "Probá nuestro chivito · parrilla local del Barrio Histórico"),
    ("Hola! Me gustaría", "¡Hola! Me gustaría"),
    ("Casco Histórico + un restaurante boutique en una bodega", "Casco Histórico + visita a bodega"),
    ("Casco Histórico y un restaurante boutique en una bodega", "Casco Histórico y bodega boutique"),
    ("Tour guiado por el Casco Histórico + un restaurante boutique en una bodega", "Tour guiado por el Casco Histórico + visita a bodega"),
    ("Hacia un restaurante boutique en una bodega:", "Hacia la bodega:"),
    ("Dónde queda un restaurante boutique en una bodega", "Dónde queda la bodega"),
    ("Mapa: un restaurante boutique en una bodega,", "Mapa: bodega boutique,"),
    ("Viñedo y huerta un restaurante boutique en una bodega", "Viñedo y huerta de la bodega"),
    ("una bodega boutique · Bodega boutique y degustación", "Bodega boutique y degustación"),
    ("una bodega boutique está ubicada", "La bodega boutique está ubicada"),
    ("Bodega boutique una bodega boutique", "Bodega boutique"),
    ("Interior de la bodega boutique una bodega boutique", "Interior de la bodega boutique"),
    ("Degustación en una vinoteca del Barrio Histórico", "Cata de vinos en el Barrio Histórico"),
    ("Degustación en una vinoteca del Barrio Histórico |", "Cata de vinos en el Barrio Histórico |"),
    ("Llegá a una vinoteca del Barrio Histórico:", "Llegá a la vinoteca del Barrio Histórico:"),
    ("en A wine shop", "en la vinoteca"),
    ("A wine shop", "la vinoteca"),
    ("Walking Tour", "Tour a pie"),
    ("BrewMaster", "Maestro cervecero"),
    ("Special Night", "Noche especial"),
    ("walking tour", "recorrido a pie"),
    ("Try our Chivito", "Probá nuestro chivito"),
    ("¡¡¡Hola!", "¡Hola!"),
    ("¡¡Hola!", "¡Hola!"),
    ("Proba nuestro Chivito", "Probá nuestro chivito"),
    ("Proba nuestro chivito", "Probá nuestro chivito"),
    ('home_cat_nav_fullday: "Full Day"', 'home_cat_nav_fullday: "Día completo"'),
]

PT_FIXES: list[tuple[str, str]] = [
    ("A family winery and olive estate near Colonia", "uma vinícola familiar com olivais perto de Colonia"),
    ("A boutique vineyard restaurant", "um restaurante boutique em uma vinícola"),
    ("A boutique vineyard estate", "uma vinícola boutique"),
    ("A boutique winery", "uma vinícola boutique"),
    ("A premium sushi restaurant", "um restaurante de sushi premium"),
    ("The premium sushi restaurant", "o restaurante de sushi premium"),
    ("A partner restaurant", "um restaurante selecionado"),
    ("A partner café", "um café selecionado"),
    ("A local grill in the Historic Quarter", "uma churrascaria local do Bairro Histórico"),
    ("A wine shop in the Historic Quarter", "uma vinícola do Bairro Histórico"),
    ("A local craft brewery", "uma cervejaria artesanal local"),
    ("A boutique posada", "uma pousada boutique"),
    ("A boutique restaurant", "um restaurante boutique"),
    ("House charcuterie board", "tábua de frios da casa"),
    ("House dessert", "sobremesa da casa"),
    ("White blend (Blanc de blancs)", "Blend de brancos"),
    ("Red blend", "Corte de tintos"),
    ("Premium Sushi Experience", "Experiência de sushi premium"),
    ("Boutique Stay & Sushi Dinner", "Estadia boutique e jantar de sushi"),
    ("Boutique Stay & Dinner", "Estadia boutique e jantar"),
    ("Historic Quarter Night Experience", "Experiência noturna no Bairro Histórico"),
    ("Wine Tasting in the Historic Quarter", "Degustação de vinhos no Bairro Histórico"),
    ("Local craft brewery experience", "Experiência em cervejaria artesanal"),
    ("Historic Quarter Brewpub", "Brewpub do Bairro Histórico"),
    ("Waterfront lunch or dinner", "Almoço ou jantar à beira da água"),
    ("The owner", "A anfitriã"),
    ("The owners", "Os proprietários"),
    ("The chefs", "Os chefs"),
    ("Your captain", "Seu capitão"),
    ("Your host", "Seu anfitrião"),
    ("Guided by your host", "Com guia do anfitrião"),
    ("Glass of local wine", "Taça de vinho local"),
    ("Historic Quarter", "Bairro Histórico"),
    ("Historic Quarter café", "Café do Bairro Histórico"),
    ("Boutique Winery & Tasting", "Vinícola boutique e degustação"),
    ("Local hosts", "Anfitriões locais"),
    ("Almoço ou jantar no um restaurante boutique em uma vinícola", "Almoço ou jantar em restaurante boutique"),
    ("Experiência restaurante um restaurante boutique", "Experiência em restaurante boutique"),
    ("Prove nosso Chivito · uma churrascaria local do Bairro Histórico", "Prove nosso chivito · churrascaria local do Bairro Histórico"),
    ("Centro Histórico + um restaurante boutique em uma vinícola", "Centro Histórico + visita à vinícola"),
    ("Centro Histórico e um restaurante boutique em uma vinícola", "Centro Histórico e vinícola boutique"),
    ("Tour guiado pelo Centro Histórico + um restaurante boutique em uma vinícola", "Tour guiado pelo Centro Histórico + visita à vinícola"),
    ("Rumo a um restaurante boutique em uma vinícola:", "Rumo à vinícola:"),
    ("Onde fica um restaurante boutique em uma vinícola", "Onde fica a vinícola"),
    ("Mapa: um restaurante boutique em uma vinícola,", "Mapa: vinícola boutique,"),
    ("Vinhedo e horta um restaurante boutique em uma vinícola", "Vinhedo e horta da vinícola"),
    ("uma vinícola boutique · Vinícola boutique e degustação", "Vinícola boutique e degustação"),
    ("O uma vinícola boutique está", "A vinícola boutique está"),
    ("O A boutique winery está", "A vinícola boutique está"),
    ("Vinícola boutique A boutique winery", "Vinícola boutique"),
    ("na A boutique winery", "na vinícola boutique"),
    ("no A boutique winery", "na vinícola boutique"),
    ("do A boutique winery", "da vinícola boutique"),
    ("da A local craft brewery", "da cervejaria artesanal local"),
    ("a A local craft brewery", "a cervejaria artesanal local"),
    ("Uma cerveceria artesanal local", "uma cervejaria artesanal local"),
    ("Degustação no uma vinícola do Bairro Histórico", "Degustação de vinhos no Bairro Histórico"),
    ("Chegue ao uma vinícola do Bairro Histórico:", "Chegue à vinícola do Bairro Histórico:"),
    ("Hello! ", "Olá! "),
    ("restaurante parrilla local", "churrascaria local"),
    ("Chegue ao uma churrascaria", "Chegue a uma churrascaria"),
    ("Ambiente do uma churrascaria", "Ambiente da churrascaria"),
    ("no uma churrascaria", "na churrascaria"),
    ("ao uma churrascaria", "a uma churrascaria"),
    ("Prove nosso Chivito no restaurante parrilla local", "Prove nosso chivito na churrascaria local"),
]

HTML_VISIBLE_FIXES: list[tuple[str, str]] = [
    ("Anita's café", "A partner café"),
    ("Café Anita", "Historic Quarter café"),
    ("Las Liebres", "A boutique vineyard restaurant"),
    ("Bruma", "A boutique restaurant"),
    ("Barbot", "A local craft brewery"),
    ("El Refugio", "A local grill in the Historic Quarter"),
    ("El Legado", "A boutique winery"),
    ("Vinos del Mundo", "A wine shop in the Historic Quarter"),
    ("La Josefina", "A waterfront partner restaurant"),
    ("Casa Viera", "A partner restaurant"),
    ("Casa Petit", "A partner restaurant"),
    ("SIO", "A premium sushi restaurant"),
    ("La Misión", "A boutique posada"),
    ("Viñedos y Olivares del Quintón", "A family winery and olive estate near Colonia"),
    ("Destilería S34", "Artisan gin distillery"),
    ("S34 Gin", "Artisan gin"),
]

TECH_LINE = re.compile(
    r"(getElementById|querySelector|popupId|closeBtnId|createBtnId|saveBtnId|"
    r"bookNowBottomId|orderSummaryId|selectedDateKey|data-booking-date-key|"
    r'\bid=["\']|for=["\']|#popup|#close|#bookNow|function |const |window\.|'
    r"experienceId|storageKey|popupBruma|popupAnita|popupLegado|popupBarbot|"
    r"PlazaAnita|closeAnita|closeBruma|closePlaza|createPlaza|bookNowBottomPlaza|"
    r"name=\"plaza|name=\"josefina)"
)


def apply_fixes(text: str, fixes: list[tuple[str, str]]) -> str:
    for old, new in fixes:
        text = text.replace(old, new)
    return text


def split_index(content: str) -> tuple[str, str, str, str]:
    m_es = re.search(r"\n    es: \{", content)
    m_pt = re.search(r"\n    pt: \{", content)
    if not m_es or not m_pt:
        raise SystemExit("Could not find es/pt blocks in index.js")
    return content[: m_es.start()], content[m_es.start() : m_pt.start()], content[m_pt.start() :], ""


TRUSTED_START = '<section class="partners">'
TRUSTED_END = "<!-- ================= USEFUL SERVICES"


def fix_html_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    trusted = None
    body = original
    if path.name == "index.html":
        start = body.find(TRUSTED_START)
        end = body.find(TRUSTED_END, start) if start != -1 else -1
        if start != -1 and end != -1:
            trusted = body[start:end]
            body = body[:start] + "\n__TRUSTED__\n" + body[end:]

    lines = []
    for line in body.splitlines(keepends=True):
        if TECH_LINE.search(line):
            lines.append(line)
        else:
            fixed = line
            for old, new in HTML_VISIBLE_FIXES:
                fixed = fixed.replace(old, new)
            lines.append(fixed)
    updated = "".join(lines)
    if trusted is not None:
        updated = updated.replace("\n__TRUSTED__\n", trusted)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> None:
    content = INDEX.read_text(encoding="utf-8")
    en_part, es_part, pt_part, _ = split_index(content)

    en_part = apply_fixes(en_part, EN_FIXES)
    es_part = apply_fixes(es_part, ES_FIXES)
    pt_part = apply_fixes(pt_part, PT_FIXES)

    INDEX.write_text(en_part + es_part + pt_part, encoding="utf-8")

    html_changed = []
    for path in sorted((ROOT / "Actividades").glob("*.html")):
        if fix_html_file(path):
            html_changed.append(path.name)
    for path in [ROOT / "Home" / "index.html"]:
        if fix_html_file(path):
            html_changed.append(path.name)

    print("Fixed Home/index.js (en/es/pt blocks)")
    for name in html_changed:
        print(f"Fixed Actividades/{name}" if name.endswith(".html") else f"Fixed {name}")


if __name__ == "__main__":
    main()
