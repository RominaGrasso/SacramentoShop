#!/usr/bin/env python3
"""Final language-consistency pass for Home/index.js (en / es / pt blocks)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "Home" / "index.js"

EN_FIXES = [
    ("The nearby winery estate", "A family winery and olive estate near Colonia"),
    ("the The premium sushi restaurant", "the premium sushi restaurant"),
    (
        'mision_sio_doc_title: "a boutique posada + The premium sushi restaurant Night Experience"',
        'mision_sio_doc_title: "Boutique posada + premium sushi night experience"',
    ),
    (
        'mision_sio_hero_title: "🏛 🍣 a boutique posada + The premium sushi restaurant Night Experience"',
        'mision_sio_hero_title: "🏛 🍣 Boutique posada + premium sushi night experience"',
    ),
    (
        "Hello! I'd like to book the a boutique posada + The premium sushi restaurant night package (stay, The premium sushi restaurant Special Night menu, breakfast & walking tour):",
        "Hello! I'd like to book the boutique posada + premium sushi night package (stay, Special Night menu, breakfast & walking tour):",
    ),
    ("This artisan distillery recognized", "This artisan distillery is recognized"),
    ("International cuisine by The chef", "International cuisine by the chefs"),
    ("South Beer Cup the Champions", "South Beer Cup — Champions"),
    (
        "The restaurant is run by its owners, Pablo and Luis. Luis is incredibly friendly and welcoming, and Pablo is wonderful — often working alongside his son, Guzmán.",
        "The restaurant is run by its owners, who welcome guests personally and deliver warm, attentive service.",
    ),
]

ES_FIXES = [
    ("Artisan Gin Distillery Experience", "Experiencia en destilería artesanal de gin"),
    ("Artisan gin", "gin artesanal"),
    ("The nearby winery estate", "Bodega familiar con olivares cerca de Colonia"),
    ("restaurante parrilla local", "parrilla local del Barrio Histórico"),
    ('home_quinton_title: "Bodega familiar con olivares cerca de Colonia · visita guiada a la bodega"', 'home_quinton_title: "Bodega familiar con olivares · visita guiada"'),
    ("Beer Tasting Experience", "Experiencia de degustación de cerveza"),
    ("Beer Tasting (", "Degustación de cerveza ("),
    ("Beer Tasting —", "Degustación de cerveza —"),
    ("Maestro cervecero Talk", "Charla con el maestro cervecero"),
    ("✔ Late checkout", "✔ Checkout tardío"),
    (
        'mision_sio_doc_title: "una posada boutique + el restaurante de sushi premium Noche"',
        'mision_sio_doc_title: "Posada boutique + noche de sushi premium"',
    ),
    (
        'mision_sio_hero_title: "🏛 🍣 una posada boutique + el restaurante de sushi premium Noche"',
        'mision_sio_hero_title: "🏛 🍣 Posada boutique + noche de sushi premium"',
    ),
    ("Full Day Colonia", "Día completo en Colonia"),
    ("Full Day ·", "Día completo ·"),
    ("grupo Full Day", "grupo de día completo"),
    ("Grupo Full Day", "Grupo de día completo"),
    ("tu grupo Full Day", "tu grupo de día completo"),
    ("un grupo Full Day", "un grupo de día completo"),
    ('home_cat_nav_fullday: "Full Day"', 'home_cat_nav_fullday: "Día completo"'),
    ("experiencia Full Day Colonia", "experiencia Día completo en Colonia"),
    ("Cocina internacional del The chef", "Cocina internacional del chef"),
    ("en the restaurant, un restaurante boutique", "en un restaurante boutique"),
    ("en the restaurant, restaurante boutique", "en un restaurante boutique"),
    ("un restaurante boutique ofrece un ambiente", "el restaurante ofrece un ambiente"),
    ("Mapa: the restaurant,", "Mapa: el restaurante,"),
    ("Walking tour guiado", "Recorrido a pie guiado"),
    ("Walking tour de regalo", "Recorrido a pie de regalo"),
    ("Mate Experience", "Experiencia de mate"),
    ("South Beer Cup the Champions", "South Beer Cup — Campeones"),
    ('bruma_about_owner_names: "Bruno y Marcelo"', 'bruma_about_owner_names: "Los dueños"'),
    ('bruma_about_name_word: "un restaurante boutique"', 'bruma_about_name_word: "el restaurante"'),
    ("✔ Mesa reservada en restaurante un restaurante boutique", "✔ Mesa reservada en el restaurante"),
    ("Dónde queda un restaurante boutique", "Dónde encontrar el restaurante"),
    ("ubicación de un restaurante boutique en", "ubicación del restaurante en"),
    ('mision_about_name_chef: "Bruno y Marcelo"', 'mision_about_name_chef: "Los dueños"'),
    ("Pablo y Luis. Luis es hiper simpático", "Los dueños. Son muy simpáticos"),
    ("Pablo es excelente y suele estar junto a su hijo Guzmán", "Atienden personalmente y su servicio es excelente"),
]

PT_FIXES = [
    ('home_cat_nav_fullday: "Full Day"', 'home_cat_nav_fullday: "Dia inteiro"'),
    ("Artisan Gin Distillery Experience", "Experiência em destilaria artesanal de gin"),
    ("Artisan gin", "gin artesanal"),
    ("The nearby winery estate", "Vinícola familiar com olivais perto de Colonia"),
    (
        'home_quinton_title: "Vinícola familiar com olivais perto de Colonia · visita guiada à vinícola"',
        'home_quinton_title: "Vinícola familiar com olivais · visita guiada"',
    ),
    ("Guiado por tu anfitrión", "Guiado pelo anfitrião"),
    ("Beer Tasting Experience", "Experiência de degustação de cerveja"),
    ("Beer Tasting (", "Degustação de cerveja ("),
    ("Beer Tasting —", "Degustação de cerveja —"),
    ("BrewMaster Talk", "Palestra do mestre cervejeiro"),
    ("experiência premium BrewMaster Talk", "experiência premium com o mestre cervejeiro"),
    ("✔ Late checkout", "✔ Checkout tardio"),
    ("Special Night", "Noite Especial"),
    ("Grupo Walking Tour", "Grupo tour a pé"),
    ("Full Day Colonia", "Dia inteiro em Colonia"),
    ("Full Day ·", "Dia inteiro ·"),
    ("grupo Full Day", "grupo de dia inteiro"),
    ("Grupo Full Day", "Grupo de dia inteiro"),
    ("seu grupo Full Day", "seu grupo de dia inteiro"),
    ("um grupo Full Day", "um grupo de dia inteiro"),
    ("experiência Full Day Colonia", "experiência Dia inteiro em Colonia"),
    (" no uma ", " na "),
    ("Jantar no um ", "Jantar no "),
    ("Jantar no o ", "Jantar no "),
    (" no o ", " no "),
    ("na uma ", "na "),
    (
        'mision_sio_doc_title: "uma pousada boutique + o restaurante de sushi premium Noite"',
        'mision_sio_doc_title: "Pousada boutique + noite de sushi premium"',
    ),
    (
        'mision_sio_hero_title: "🏛 🍣 uma pousada boutique + o restaurante de sushi premium Noite"',
        'mision_sio_hero_title: "🏛 🍣 Pousada boutique + noite de sushi premium"',
    ),
    ("Cozinha internacional do The chef", "Cozinha internacional do chef"),
    ("no the restaurant, um restaurante boutique", "em um restaurante boutique"),
    ("no the restaurant, restaurante boutique", "em um restaurante boutique"),
    ("o um restaurante boutique oferece", "o restaurante oferece"),
    ("Mapa: the restaurant,", "Mapa: o restaurante,"),
    ("Walking tour guiado", "Passeio a pé guiado"),
    ("walking tour", "passeio a pé"),
    ("Walking tour", "Passeio a pé"),
    ("Mate Experience", "Experiência de mate"),
    ("South Beer Cup the Champions", "South Beer Cup — Campeões"),
    ('bruma_about_owner_names: "Bruno e Marcelo"', 'bruma_about_owner_names: "Os proprietários"'),
    ('mision_about_name_chef: "Bruno e Marcelo"', 'mision_about_name_chef: "Os proprietários"'),
    ("Pablo e Luis. Luis é super simpático", "Os proprietários. São muito simpáticos"),
    ("Pablo é ótimo e costuma estar ao lado do filho Guzmán", "Atendem pessoalmente e o serviço é excelente"),
    ("jantar no um restaurante boutique", "jantar em um restaurante boutique"),
    ("Jantar inesquecível no um", "Jantar inesquecível no"),
    ("destaque no um", "destaque no"),
    ("Preparação no um", "Preparação no"),
    ("Seleção de sushi no um", "Seleção de sushi no"),
    ("degustação no um", "degustação no"),
    ("menu Noite especial no um", "menu Noite Especial no"),
    ("premium no um restaurante", "premium no restaurante"),
]

HTML_FIXES = [
    ("Barbot Brewpub · award-winning craft beer", "Historic Quarter brewpub · award-winning craft beer"),
    ("Barbot Brewpub recently won gold with Bonavena Strong Ale", "This brewpub recently won gold with its award-winning strong ale"),
    ("Barbot Brewpub pours honest craft beer", "The brewpub pours honest craft beer"),
    ("Build your menu at Barbot", "Build your menu at the brewpub"),
    ("Chorizos a la Malta Barbot", "House sausages braised in beer"),
    ("Barbot malta beer", "house malt beer"),
    ("Uruguayan Chivito Barbot", "Uruguayan chivito"),
    ("Barbot Classic", "house classic"),
    ("Barbot braised pork shoulder", "Beer-braised pork shoulder"),
    ('experienceName: "Barbot Brewpub"', 'experienceName: "Historic Quarter brewpub"'),
    ("Bonavena Strong", "award-winning strong ale"),
]


def split_index(content: str) -> tuple[str, str, str]:
    m_es = re.search(r"\n    es: \{", content)
    m_pt = re.search(r"\n    pt: \{", content)
    if not m_es or not m_pt:
        raise SystemExit("Could not find es/pt blocks in index.js")
    return content[: m_es.start()], content[m_es.start() : m_pt.start()], content[m_pt.start() :]


def apply(text: str, fixes: list[tuple[str, str]]) -> str:
    for old, new in fixes:
        text = text.replace(old, new)
    return text


TECH_LINE = re.compile(
    r"(getElementById|querySelector|popupId|closeBtnId|selectedDateKey|"
    r'data-booking-date-key|\bid=["\']|popupBarbot|selectedDateBarbot|'
    r"saveBarbotMenu|sacramentoBarbot)"
)


def fix_html(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    lines = []
    for line in original.splitlines(keepends=True):
        if TECH_LINE.search(line):
            lines.append(line)
        else:
            fixed = line
            for old, new in HTML_FIXES:
                fixed = fixed.replace(old, new)
            lines.append(fixed)
    updated = "".join(lines)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> None:
    content = INDEX.read_text(encoding="utf-8")
    en, es, pt = split_index(content)
    en = apply(en, EN_FIXES)
    es = apply(es, ES_FIXES)
    pt = apply(pt, PT_FIXES)
    INDEX.write_text(en + es + pt, encoding="utf-8")

    html_changed = []
    brewpub = ROOT / "Actividades" / "barbot-brewpub.html"
    if brewpub.exists() and fix_html(brewpub):
        html_changed.append("Actividades/barbot-brewpub.html")

    print("Updated Home/index.js (en/es/pt)")
    for p in html_changed:
        print(f"Updated {p}")


if __name__ == "__main__":
    main()
