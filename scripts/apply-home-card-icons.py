#!/usr/bin/env python3
"""Patch Home/index.html + Home/index.js: card meta / badges / medical with SVG sprite + emoji-free copy."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "Home" / "index.html"
JS = ROOT / "Home" / "index.js"

# data-translate key -> space-separated symbol ids (Assets/icons/card-meta.svg)
CARD_META_ICONS = {
    "historic_meta_popular": "star",
    "historic_card_mate": "cup",
    "historic_meta_duration": "clock globe",
    "bike_meta_1": "clock globe utensils",
    "bike_meta_2": "fire sunset",
    "josefina_meta_view": "sunset",
    "josefina_meta_duration": "clock",
    "josefina_meta_favorite": "star",
    "bruma_home_meta_1": "sparkles",
    "bruma_home_meta_2": "wine",
    "asado_boat_home_meta_1": "star",
    "asado_boat_home_meta_2": "captain",
    "asado_boat_home_meta_3": "car clock",
    "walking_asado_card_meta_1": "star",
    "walking_asado_card_meta_2": "landmark fire",
    "walking_asado_card_meta_3": "walk clock",
    "food_card_meta_1": "star",
    "food_card_meta_2": "fire",
    "food_card_meta_3": "car clock",
    "plaza_meta_line": "car ticket clock",
    "lieb_home_meta_1": "clock utensils",
    "lieb_home_meta_2": "car leaf",
    "home_hist_lieb_meta_1": "landmark grapes",
    "home_hist_lieb_meta_2": "wine clock car",
    "home_cabalgata_meta_1": "star",
    "home_cabalgata_meta_2": "horse grapes",
    "home_cabalgata_meta_3": "wine",
    "home_cabalgata_meta_4": "clock car",
    "home_sio_meta_1": "star",
    "home_sio_meta_2": "sushi",
    "home_sio_meta_3": "mappin clock",
    "sunset_boat_card_meta_1": "star",
    "sunset_boat_card_meta_2": "sunset",
    "sunset_boat_card_meta_3": "captain",
    "sunset_boat_card_meta_4": "clock",
    "home_bar_meta_1": "clock cocktail beer",
    "home_bar_meta_2": "mappin",
    "home_bar_meta_3": "dance",
    "lupajack_card_meta": "clock drum utensils",
    "mate_asado_meta_1": "clock drum utensils",
    "mate_asado_meta_2": "fire",
    "home_shared_meta_activity": "clock drum utensils",
    "romantic_home_meta": "mappin moon wine",
    "fullday_card_meta_lang": "clock globe",
    "home_toros_night_meta_1": "moon utensils coffee",
    "home_toros_night_meta_2": "fire",
    "home_mision_meta_pf": "paw",
    "home_mision_meta_stay": "moon utensils coffee",
    "home_mision_meta_tour": "gift",
    "home_corp_boat_meta_1": "sunset boat utensils",
    "home_corp_boat_meta_2": "office car",
    "home_corp_boat_meta_3": "gift",
    "home_corp_boat_badge": "sparkles",
}

DISCOUNT_META = {
    "josefina_launch_badge": "rocket",
    "bruma_discount_badge": "percent",
}


def patch_html():
    t = HTML.read_text(encoding="utf-8")

    for key, icons in CARD_META_ICONS.items():
        pat = rf'(\s*)<p class="card-meta" data-translate="{re.escape(key)}">'
        cls = "card-meta card-meta--badge" if key == "home_corp_boat_badge" else "card-meta"
        rep = (
            rf'\1<p class="{cls}" data-card-meta="{icons}">'
            r'<span class="sprite-row" aria-hidden="true"></span>'
            rf'<span class="card-meta__text" data-translate="{key}">'
        )
        t, n = re.subn(pat, rep, t)
        if n < 1:
            raise SystemExit(f"card-meta HTML: no match for {key!r}")

    for key, icons in DISCOUNT_META.items():
        pat = rf'(\s*)<div class="discount-badge" data-translate="{re.escape(key)}">'
        rep = (
            rf'\1<div class="discount-badge" data-card-meta="{icons}">'
            r'<span class="sprite-row" aria-hidden="true"></span>'
            rf'<span class="discount-badge__text" data-translate="{key}">'
        )
        t_new, n = re.subn(pat, rep, t, count=1)
        if n != 1:
            raise SystemExit(f"discount HTML: expected 1 match for {key!r}, got {n}")
        t = t_new

    med_pat = r'(\s*)<p class="medical">🛡️\s*<span data-translate="'
    med_rep = r'\1<p class="medical" data-card-meta="shield"><span class="sprite-row" aria-hidden="true"></span><span data-translate="'
    t_new, n = re.subn(med_pat, med_rep, t)
    if n == 0:
        raise SystemExit("medical pattern missing")
    t = t_new

    t = re.sub(
        r'(<span class="discount-badge__text" data-translate="[^"]+">)([^<]*)</div>',
        r"\1\2</span></div>",
        t,
    )
    t = re.sub(
        r'(<span class="card-meta__text" data-translate="[^"]+">)([^<]*)</p>',
        r"\1\2</span></p>",
        t,
    )

    HTML.write_text(t, encoding="utf-8")
    print("patched", HTML)


# (key, en, es, pt) — plain text, no emojis
STRINGS = [
    ("historic_card_mate", "Optional mate available", "Mate opcional disponible", "Mate opcional disponível"),
    ("historic_meta_popular", "Most popular experience", "Experiencia más popular", "Experiência mais popular"),
    ("historic_meta_duration", "1.5 hours • English • Spanish • Portuguese", "1,5 horas • Inglés • español • portugués", "1,5 h • Inglês • espanhol • português"),
    ("bike_meta_1", "1.5 hours • English • Spanish • Portuguese • Traditional torta frita included", "1,5 hs • Inglés • español • portugués • Torta frita tradicional incluida", "1,5 h • Inglês • espanhol • português • Torta frita tradicional incluída"),
    ("bike_meta_2", "Active experience • Sunset option available", "Experiencia activa • Opción atardecer", "Experiência ativa • Opção pôr do sol"),
    ("josefina_meta_view", "Unforgettable Río de la Plata views — the setting is the highlight", "Vistas espectaculares al Río de la Plata — lo más destacado es el entorno", "Vista incrível para o Rio da Prata — o cenário é o grande destaque"),
    ("josefina_meta_duration", "The experience lasts 2 hours", "La experiencia dura 2 horas", "A experiência dura 2 horas"),
    ("josefina_meta_favorite", "A favorite among tourists", "Favorito de los turistas", "Favorita entre os turistas"),
    ("bruma_home_meta_1", "Perfect after your guided tour", "Ideal después de tu tour guiado", "Perfeito após seu tour guiado"),
    ("bruma_home_meta_2", "International cuisine by Chef Marcelo", "Cocina internacional del Chef Marcelo", "Cozinha internacional do Chef Marcelo"),
    ("asado_boat_home_meta_1", "Premium local experience", "Experiencia local premium", "Experiência local premium"),
    ("asado_boat_home_meta_2", "Hosted by Alejandro, owner & captain", "Con Alejandro, dueño y capitán", "Com Alejandro, proprietário e capitão"),
    ("asado_boat_home_meta_3", "Transfer included • Duration: 4 hours", "Traslado incluido • Duración: 4 horas", "Transfer incluído • Duração: 4 horas"),
    ("walking_asado_card_meta_1", "Premium local experience", "Experiencia local premium", "Experiência local premium"),
    ("walking_asado_card_meta_2", "Guided walk + Asado Experience (BBQ) at El Refugio", "Caminata guiada + Experiencia Asado (BBQ) en El Refugio", "Caminhada guiada + Experiência Asado (BBQ) no El Refugio"),
    ("walking_asado_card_meta_3", "All on foot in the Historic Quarter • Duration: about 4 hours", "Todo a pie en el Casco Histórico • Duración: unas 4 horas", "Tudo a pé no Centro Histórico • Duração: cerca de 4 horas"),
    ("food_card_meta_1", "Best value experience in Colonia", "Mejor relación precio-calidad en Colonia", "Melhor custo-benefício em Colonia"),
    ("food_card_meta_2", "3 experiences in 1", "3 experiencias en 1", "3 experiências em 1"),
    ("food_card_meta_3", "Transfer included • Duration: 4 hours", "Traslado incluido • Duración: 4 horas", "Transfer incluído • Duração: 4 horas"),
    ("plaza_meta_line", "Transfer included • Tickets included • Approx. 3 hours", "Traslado incluido • Entradas incluidas • ~3 hs aprox.", "Transfer incluído • Ingressos incluídos • ~3 h aprox."),
    ("lieb_home_meta_1", "3 - 4 hours • Signature dishes", "3 - 4 horas • Platos insignia", "3 - 4 horas • Pratos assinatura"),
    ("lieb_home_meta_2", "Transfer included • Boutique dining experience", "Traslado incluido • Experiencia boutique", "Transfer incluído • Experiência boutique"),
    ("home_hist_lieb_meta_1", "Guided walk in the old town • Vineyard & organic garden", "Caminata guiada en la ciudad vieja • Viñedo y huerta orgánica", "Caminhada guiada na cidade velha • Vinhedo e horta orgânica"),
    ("home_hist_lieb_meta_2", "Tasting or lunch • 3–4 hours duration • Transfer included", "Degustación o almuerzo • 3–4 horas • Traslado incluido", "Degustação ou almoço • 3–4 horas • Transfer incluído"),
    ("home_cabalgata_meta_1", "Boutique vineyard experience", "Experiencia en viñedo boutique", "Experiência em vinhedo boutique"),
    ("home_cabalgata_meta_2", "Cabalgata in Riachuelo (outside Colonia) • Then Las Liebres vineyard & garden", "Cabalgata en Riachuelo (fuera de Colonia) • Luego viñedo y huerta Las Liebres", "Cavalgada em Riachuelo (fora de Colonia) • Depois vinhedo e horta Las Liebres"),
    ("home_cabalgata_meta_3", "3 wines with food pairing", "3 vinos con maridaje", "3 vinhos com harmonização"),
    ("home_cabalgata_meta_4", "Duration: 3–4 hours • Transfer included", "Duración: 3–4 horas • Traslado incluido", "Duração: 3–4 horas • Transfer incluído"),
    ("home_sio_meta_1", "Premium dining experience", "Experiencia gastronómica premium", "Experiência gastronômica premium"),
    ("home_sio_meta_2", "International-level sushi in Colonia", "Sushi de nivel internacional en Colonia", "Sushi de nível internacional em Colonia"),
    ("home_sio_meta_3", "Historic Quarter • Duration: 2 hours", "Casco Histórico • Duración: 2 horas", "Centro Histórico • Duração: 2 horas"),
    ("sunset_boat_card_meta_1", "Relax & scenic experience", "Experiencia relajante y escénica", "Experiência relaxante e cênica"),
    ("sunset_boat_card_meta_2", "Río de la Plata sunset views", "Vistas al atardecer en el Río de la Plata", "Vistas ao pôr do sol no Rio da Prata"),
    ("sunset_boat_card_meta_3", "Hosted by Alejandro, owner & captain", "Con Alejandro, dueño y capitán", "Com Alejandro, proprietário e capitão"),
    ("sunset_boat_card_meta_4", "Duration: 1.5 hours", "Duración: 1,5 horas", "Duração: 1,5 horas"),
    ("home_bar_meta_1", "3 - 4 hours • Cocktails • Local beer", "3 - 4 horas • Cócteles • Cerveza artesanal", "3 - 4 horas • Coquetéis • Cerveja artesanal"),
    ("home_bar_meta_2", "Casa Viera • La Chopería • Barbot", "Casa Viera • La Chopería • Barbot", "Casa Viera • La Chopería • Barbot"),
    ("home_bar_meta_3", "Nightclub access included", "Ingreso a boliche incluido", "Entrada em balada incluída"),
    ("lupajack_card_meta", "1.5 hours • Drum lesson • Traditional torta frita included", "1,5 hs • Clase de tambores • Torta frita tradicional incluida", "1,5 h • Aula de tambores • Torta frita tradicional incluída"),
    ("mate_asado_meta_1", "1.5 hours • Drum lesson • Traditional torta frita included", "1,5 hs • Clase de tambores • Torta frita tradicional incluida", "1,5 h • Aula de tambores • Torta frita tradicional incluída"),
    ("mate_asado_meta_2", "2 experiences in 1", "2 experiencias en 1", "2 experiências em 1"),
    ("home_shared_meta_activity", "1.5 hours • Drum lesson • Traditional torta frita included", "1,5 hs • Clase de tambores • Torta frita tradicional incluida", "1,5 h • Aula de tambores • Torta frita tradicional incluída"),
    ("romantic_home_meta", "Casa Viera · Evening · Three-course dinner & premium wine", "Casa Viera · Noche · Cena de tres tiempos y vino premium", "Casa Viera · Noite · Jantar de três pratos e vinho premium"),
    ("fullday_card_meta_lang", "4-5 hours • English • Spanish • Portuguese", "4-5 horas • Inglés • español • portugués", "4-5 horas • Inglês • espanhol • português"),
    ("home_toros_night_meta_1", "1 night • Dinner included • Breakfast included", "1 noche • Cena incluida • Desayuno incluido", "1 noite • Jantar incluído • Café da manhã incluído"),
    ("home_toros_night_meta_2", "3 experiences in 1", "3 experiencias en 1", "3 experiências em 1"),
    ("home_mision_meta_pf", "Pet friendly", "Pet friendly", "Pet friendly"),
    ("home_mision_meta_stay", "1 night • Dinner included • Breakfast included", "1 noche • Cena incluida • Desayuno incluido", "1 noite • Jantar incluído • Café da manhã incluído"),
    ("home_mision_meta_tour", "Guided tour included", "Tour guiado incluido", "Tour guiado incluído"),
    ("home_corp_boat_badge", "Exclusive corporate experience", "Experiencia corporativa exclusiva", "Experiência corporativa exclusiva"),
    ("home_corp_boat_meta_1", "Sunset experience • Private boat with Captain Alejandro • Dinner included", "Atardecer • Barco privado con capitán Alejandro • Cena incluida", "Pôr do sol • Barco privado com capitão Alejandro • Jantar incluído"),
    ("home_corp_boat_meta_2", "Corporate & private groups • Transfers included", "Grupos corporativos y privados • Traslados incluidos", "Grupos corporativos e privados • Transfers incluídos"),
    ("home_corp_boat_meta_3", "Guided tour included", "Tour guiado incluido", "Tour guiado incluído"),
    ("bruma_discount_badge", "Launch price · 22% OFF", "Precio lanzamiento · 22% OFF", "Preço de lançamento · 22% OFF"),
    ("josefina_launch_badge", "Launch price · 30% OFF", "Precio lanzamiento · 30% OFF", "Preço de lançamento · 30% OFF"),
]


def json_escape(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def replace_js_value(block: str, key: str, value: str) -> str:
    esc = json_escape(value)
    pat1 = re.compile(rf"^(\s*{re.escape(key)}:\s*)(\"(?:[^\"\\]|\\.)*\")", re.MULTILINE)
    m = pat1.search(block)
    if m:
        return block[: m.start()] + m.group(1) + esc + block[m.end() :]
    pat2 = re.compile(rf"^(\s*{re.escape(key)}:\s*\n\s*)(\"(?:[^\"\\]|\\.)*\")", re.MULTILINE)
    m = pat2.search(block)
    if m:
        return block[: m.start()] + m.group(1) + esc + block[m.end() :]
    raise SystemExit(f"Could not find key {key!r} in language block")


def patch_js():
    text = JS.read_text(encoding="utf-8")
    mark_en = "    en: {\n"
    mark_es = "    es: {\n"
    mark_pt = "    pt: {\n"
    i0 = text.index(mark_en)
    i1 = text.index(mark_es)
    i2 = text.index(mark_pt)
    i3 = text.index("\n    }\n  };", i2)

    head = text[: i0 + len(mark_en)]
    en_body = text[i0 + len(mark_en) : i1]
    mid_es = text[i1 : i1 + len(mark_es)]
    es_body = text[i1 + len(mark_es) : i2]
    mid_pt = text[i2 : i2 + len(mark_pt)]
    pt_body = text[i2 + len(mark_pt) : i3]
    tail = text[i3:]

    for key, en, es, pt in STRINGS:
        en_body = replace_js_value(en_body, key, en)
        es_body = replace_js_value(es_body, key, es)
        pt_body = replace_js_value(pt_body, key, pt)

    new_text = head + en_body + mid_es + es_body + mid_pt + pt_body + tail
    JS.write_text(new_text, encoding="utf-8")
    print("patched", JS)


def main():
    patch_html()
    patch_js()


if __name__ == "__main__":
    main()
