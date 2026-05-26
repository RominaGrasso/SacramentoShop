#!/usr/bin/env python3
"""Split multi-icon card meta into .card-meta-stack + one .card-meta-line per icon."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "Home" / "index.html"


def main():
    t = HTML.read_text(encoding="utf-8")

    subs = [
        (
            """          <p class="card-meta" data-card-meta="clock globe"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="historic_meta_duration">
            ⏱ 1.5 hours • 🌍 English • Spanish • Portuguese 
            </span></p>""",
            """          <div class="card-meta-stack">
          <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="historic_meta_duration_t">1.5 hours</span></p>
          <p class="card-meta-line" data-card-meta="globe"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="historic_meta_duration_l">English • Spanish • Portuguese</span></p>
          </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="clock globe utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="bike_meta_1">
        ⏱ 1.5 hours • 🌍 English • Spanish • Portuguese • Traditional torta frita included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="bike_meta_1_t">1.5 hours</span></p>
      <p class="card-meta-line" data-card-meta="globe"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="bike_meta_1_l">English • Spanish • Portuguese</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="bike_meta_1_f">Traditional torta frita included</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="fire sunset"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="bike_meta_2">
        🔥 Active experience • 🌅 Sunset option available
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="fire"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="bike_meta_2_a">Active experience</span></p>
      <p class="card-meta-line" data-card-meta="sunset"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="bike_meta_2_b">Sunset option available</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="car clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="asado_boat_home_meta_3">
        🚗 Transfer included ⏱ Duration: 4 hours
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="asado_boat_home_meta_3_transfer">Transfer included</span></p>
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="asado_boat_home_meta_3_time">Duration: 4 hours</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="landmark fire"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="walking_asado_card_meta_2">
        🏛 Guided walk + 🔥 traditional asado at El Refugio
      </span></p>""",
            """      <p class="card-meta-line" data-card-meta="landmark"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="walking_asado_card_meta_2">Guided walk + traditional asado at El Refugio</span></p>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="walk clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="walking_asado_card_meta_3">
        🚶 All on foot in the Historic Quarter ⏱ Duration: about 4 hours
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="walk"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="walking_asado_card_meta_3_a">All on foot in the Historic Quarter</span></p>
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="walking_asado_card_meta_3_b">Duration: about 4 hours</span></p>
      </div>""",
        ),
        (
            """          <p class="card-meta" data-card-meta="car clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="food_card_meta_3">
            🚗 Transfer included ⏱ Duration: 4 hours
            </span></p>""",
            """          <div class="card-meta-stack">
          <p class="card-meta-line" data-card-meta="car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="food_card_meta_3_transfer">Transfer included</span></p>
          <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="food_card_meta_3_time">Duration: 4 hours</span></p>
          </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="car ticket clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="plaza_meta_line">
        🚗 Transfer included • 🎫 Tickets included • ⏱ Approx. 3 hours
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="plaza_meta_transfer">Transfer included</span></p>
      <p class="card-meta-line" data-card-meta="ticket"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="plaza_meta_tickets">Tickets included</span></p>
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="plaza_meta_time">Approx. 3 hours</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="clock utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lieb_home_meta_1">
        ⏱ 3 - 4 hours • 🍽 Signature dishes
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lieb_home_meta_1_time">3 - 4 hours</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lieb_home_meta_1_food">Signature dishes</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="car leaf"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lieb_home_meta_2">
        🚗 Transfer included • 🌿 Boutique dining experience
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lieb_home_meta_2_transfer">Transfer included</span></p>
      <p class="card-meta-line" data-card-meta="leaf"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lieb_home_meta_2_style">Boutique dining experience</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="landmark grapes"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_hist_lieb_meta_1">
        🏛 Historic Quarter walking tour • 🍇 Vineyard &amp; organic garden
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="landmark"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_hist_lieb_meta_1_town">Historic Quarter walking tour</span></p>
      <p class="card-meta-line" data-card-meta="grapes"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_hist_lieb_meta_1_vine">Vineyard & organic garden</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="wine clock car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_hist_lieb_meta_2">
        🍷 Tasting or lunch • ⏱ 3–4 hours duration • 🚗 Transfer included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="wine"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_hist_lieb_meta_2_taste">Tasting or lunch</span></p>
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_hist_lieb_meta_2_time">3–4 hours duration</span></p>
      <p class="card-meta-line" data-card-meta="car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_hist_lieb_meta_2_transfer">Transfer included</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="horse grapes"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_cabalgata_meta_2">
        🐎 Horseback riding outside Colonia • 🍇 Then Las Liebres vineyard &amp; garden
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="horse"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_cabalgata_meta_2_ride">Horseback riding outside Colonia</span></p>
      <p class="card-meta-line" data-card-meta="grapes"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_cabalgata_meta_2_vine">Then Las Liebres vineyard & garden</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="clock car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_cabalgata_meta_4">
        ⏱ Duration: 3–4 hours • 🚗 Transfer included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_cabalgata_meta_4_time">Duration: 3–4 hours</span></p>
      <p class="card-meta-line" data-card-meta="car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_cabalgata_meta_4_transfer">Transfer included</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="mappin clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_sio_meta_3">
        📍 Historic Quarter ⏱ Duration: 2 hours
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="mappin"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_sio_meta_3_place">Historic Quarter</span></p>
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_sio_meta_3_time">Duration: 2 hours</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="clock cocktail beer"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_bar_meta_1">
        ⏱️ 3 - 4 hours • 🍸 Cocktails • 🍺 Local beer
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_bar_meta_1_time">3 - 4 hours</span></p>
      <p class="card-meta-line" data-card-meta="cocktail"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_bar_meta_1_cocktails">Cocktails</span></p>
      <p class="card-meta-line" data-card-meta="beer"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_bar_meta_1_beer">Local beer</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="clock drum utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lupajack_card_meta">
        ⏱ 1.5 hours • 🥁 Drum lesson • Traditional torta frita included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lupajack_card_meta_t">1.5 hours</span></p>
      <p class="card-meta-line" data-card-meta="drum"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lupajack_card_meta_d">Drum lesson</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="lupajack_card_meta_f">Traditional torta frita included</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="clock drum utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="mate_asado_meta_1">
        ⏱ 1.5 hours • 🥁 Drum lesson • Traditional torta frita included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="mate_asado_meta_1_t">1.5 hours</span></p>
      <p class="card-meta-line" data-card-meta="drum"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="mate_asado_meta_1_d">Drum lesson</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="mate_asado_meta_1_f">Traditional torta frita included</span></p>
      </div>""",
        ),
        # Candombe (correct copy)
        (
            """      <h3 data-translate="candombe_title">
        Candombe Drum Experience
      </h3>
  
      <p class="card-meta" data-card-meta="clock drum utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_shared_meta_activity">
        ⏱ 1.5 hours • 🥁 Drum lesson • Traditional torta frita included
      </span></p>""",
            """      <h3 data-translate="candombe_title">
        Candombe Drum Experience
      </h3>
  
      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_shared_meta_t">1.5 hours</span></p>
      <p class="card-meta-line" data-card-meta="drum"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_shared_meta_d">Drum lesson</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_shared_meta_f">Traditional torta frita included</span></p>
      </div>""",
        ),
        # Mate only
        (
            """      <h3 data-translate="mateonly_title">
        Traditional Mate Experience
      </h3>

      <p class="card-meta" data-card-meta="clock drum utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_shared_meta_activity">
        ⏱ 1.5 hours • 🥁 Drum lesson • Traditional torta frita included
      </span></p>""",
            """      <h3 data-translate="mateonly_title">
        Traditional Mate Experience
      </h3>

      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="mateonly_home_meta_t">About 1–1.5 hours</span></p>
      <p class="card-meta-line" data-card-meta="cup"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="mateonly_home_meta_m">Mate ritual & tasting with locals</span></p>
      </div>""",
        ),
        # Horse riding
        (
            """      <h3 data-translate="horse_title">
        Horseback Riding Through Colonia’s Countryside
      </h3>

      <p class="card-meta" data-card-meta="clock drum utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_shared_meta_activity">
        ⏱ 1.5 hours • 🥁 Drum lesson • Traditional torta frita included
      </span></p>""",
            """      <h3 data-translate="horse_title">
        Horseback Riding Through Colonia’s Countryside
      </h3>

      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="horse_home_meta_t">About 2 hours</span></p>
      <p class="card-meta-line" data-card-meta="leaf"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="horse_home_meta_n">Countryside trails & nature</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="mappin moon wine"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="romantic_home_meta">
        📍 Casa Viera · Evening · Three-course dinner &amp; premium wine
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="mappin"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="romantic_home_meta_place">Casa Viera</span></p>
      <p class="card-meta-line" data-card-meta="moon"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="romantic_home_meta_evening">Evening</span></p>
      <p class="card-meta-line" data-card-meta="wine"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="romantic_home_meta_menu">Three-course dinner & premium wine</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="clock globe"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="fullday_card_meta_lang">
        ⏱ 4-5 hours • 🌍 English • Spanish • Portuguese
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="clock"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="fullday_card_meta_time">4-5 hours</span></p>
      <p class="card-meta-line" data-card-meta="globe"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="fullday_card_meta_langs">English • Spanish • Portuguese</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="moon utensils coffee"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_toros_night_meta_1">
        🌙 1 night • 🍽 Dinner included • ☕ Breakfast included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="moon"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_toros_night_meta_1_night">1 night</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_toros_night_meta_1_dinner">Dinner included</span></p>
      <p class="card-meta-line" data-card-meta="coffee"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_toros_night_meta_1_breakfast">Breakfast included</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="moon utensils coffee"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_mision_meta_stay">
        🌙 1 night • 🍽 Dinner included • ☕ Breakfast included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="moon"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_mision_meta_stay_night">1 night</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_mision_meta_stay_dinner">Dinner included</span></p>
      <p class="card-meta-line" data-card-meta="coffee"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_mision_meta_stay_breakfast">Breakfast included</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="sunset boat utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_corp_boat_meta_1">
        🌅 Sunset experience • 🚤 Private boat with Captain Alejandro • 🍽 Dinner included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="sunset"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_corp_boat_meta_1_sunset">Sunset experience</span></p>
      <p class="card-meta-line" data-card-meta="boat"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_corp_boat_meta_1_boat">Private boat with Captain Alejandro</span></p>
      <p class="card-meta-line" data-card-meta="utensils"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_corp_boat_meta_1_dinner">Dinner included</span></p>
      </div>""",
        ),
        (
            """      <p class="card-meta" data-card-meta="office car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_corp_boat_meta_2">
        🏢 Corporate & private groups • 🚗 Transfers included
      </span></p>""",
            """      <div class="card-meta-stack">
      <p class="card-meta-line" data-card-meta="office"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_corp_boat_meta_2_groups">Corporate & private groups</span></p>
      <p class="card-meta-line" data-card-meta="car"><span class="sprite-row" aria-hidden="true"></span><span class="card-meta__text" data-translate="home_corp_boat_meta_2_transfer">Transfers included</span></p>
      </div>""",
        ),
    ]

    for old, new in subs:
        if old not in t:
            raise SystemExit(f"Block not found:\n{old[:200]}...")
        n = t.count(old)
        t = t.replace(old, new)
        print(f"replaced {n}x")

    t = t.replace('class="card-meta card-meta--badge"', 'class="card-meta-line card-meta-line--badge"')
    t = t.replace('<p class="card-meta" ', '<p class="card-meta-line" ')

    HTML.write_text(t, encoding="utf-8")
    print("Wrote", HTML)


if __name__ == "__main__":
    main()
