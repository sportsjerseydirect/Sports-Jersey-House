# Sports Jersey House — Catalogue Data Quality Audit

**Date:** 2026-08-26  
**Scope:** Published Shopify-imported products only (`3872` products).  
**Mode:** Audit + safe autofix applied  
**Constraints:** No title rewrites, no invented SKU/size/taxonomy, no catalogue expansion, no Shopify sync.

---

## Summary

| Metric | Count |
| --- | ---: |
| **TOTAL PUBLISHED (Shopify)** | 3872 |
| **READY** | 3560 |
| **NEEDS_REVIEW** | 312 |
| **BLOCKED** | 0 |

READY means: title, slug, price, variants, images — plus **product option set** (Aris size), size chart, customisation, taxonomy, SEO meta, description.

**SKU is optional** (SJD Shopify variants often have null SKUs). **Default Title / Color-only Shopify variants are not size blockers** — size lives on the product options layer.

**Honest assessment:** 3560/3872 products are genuinely customer-ready under the options-layer model. Products without a linked option set (e.g. Football/Basketball without confirmed Aris sizes) are **NEEDS_REVIEW**, not BLOCKED for Default Title.

---

## Autofix summary

| Category | Rows changed |
| --- | ---: |
| **AUTOFIXED (this run)** | 7365 |
| **FLAGGED (requires human/supplier)** | 314+ |
| **NOT SAFE TO AUTOMATE** | SKU invention, size invention, title rewrites, collection renames |

### Autofixes applied

- **size_label_from_options:** 0
- **sku_from_shopify_raw:** 0
- **sport_filled_null_only:** 0
- **league_filled_null_only:** 50
- **size_charts_linked:** 0
- **customisation_profile_linked:** 0
- **image_alt_from_title:** 211
- **seo_records_created:** 0
- **seo_canonical_repaired:** 0
- **collection_memberships_from_payload:** 7104

---

## Issue areas

### SKU (optional — not a readiness blocker)
| | Count |
| --- | ---: |
| Variants missing SKU (informational) | 11356 |
| Products with any missing SKU | 3872 |
| Duplicate SKU groups | 2 |
| Shopify raw payload variants with SKU | 0 / 1645 |

**Root cause:** SJD Shopify source has **null SKUs**. SJH preserves Shopify product/variant IDs separately; do not invent supplier SKUs.

### PRODUCT OPTIONS / SIZE (Aris model)
| | Count |
| --- | ---: |
| Variants titled "Default Title" (colour axis N/A — OK) | 902 |
| Products **with** size option set | 3560 |
| Products **missing** option set (**NEEDS_REVIEW**) | 312 |

**Model:** Size is a product option (Aris), not a Shopify variant. Default Title / Color-only variants are expected.

**Products needing option-set review (312):**

- `12s-seattle-seahawks-2025-rivalries-collection-game-jersey-wolf-gray-nfl`
- `aaron-rodgers-pittsburgh-steelers-game-jersey-black-nfl`
- `ahmad-sauce-gardner-new-york-jets-2025-rivalries-collection-limited-jersey-gotham-green-nfl`
- `ahmad-sauce-gardner-new-york-jets-alternate-game-jersey-legacy-black-nfl`
- `akeem-davis-gaither-arizona-cardinals-team-game-jersey-cardinal-nfl`
- `alvin-kamara-new-orleans-saints-alternate-game-jersey-white-nfl`
- `alvin-kamara-new-orleans-saints-fashion-game-jersey-carbon-black-nfl`
- `alvin-kamara-new-orleans-saints-game-jersey-black-nfl`
- `alvin-kamara-new-orleans-saints-gameday-golds-alternate-game-player-jersey-gold-nfl`
- `amon-ra-st-brown-detroit-lions-2nd-alternate-game-jersey-black-nfl`
- `amon-ra-st-brown-detroit-lions-game-jersey-blue-nfl`
- `anquan-boldin-arizona-cardinals-mitchell-ness-legacy-replica-jersey-cardinal-nfl`
- `anthony-richardson-sr-indianapolis-colts-2025-salute-to-service-limited-jersey-olive-nfl`
- `arizona-cardinals-custom-game-jersey-white-nhl`
- `atlanta-falcons-custom-game-jersey-black-nfl`
- `baker-mayfield-76-tampa-bay-buccaneers-vapor-f-u-s-e-player-limited-jersey-white-nfl`
- `baker-mayfield-tampa-bay-buccaneers-2025-salute-to-service-limited-jersey-olive-nfl`
- `baker-mayfield-tampa-bay-buccaneers-team-game-jersey-red-nfl`
- `baker-mayfield-tampa-bay-buccaneers-throwback-game-jersey-orange-nfl`
- `baltimore-ravens-custom-game-jersey-purple-nfl`
- `baltimore-ravens-custom-game-jersey-white-nfl`
- `baron-browning-arizona-cardinals-team-game-jersey-cardinal-nfl`
- `bijan-robinson-7-atlanta-falcons-football-jersey`
- `bijan-robinson-atlanta-falcons-game-jersey-black-nfl`
- `blake-gillikin-arizona-cardinals-team-game-jersey-cardinal-nfl`
- `bo-jackson-las-vegas-raiders-1990-mitchell-ness-authentic-throwback-retired-player-jersey-black-nfl`
- `bo-nix-denver-broncos-2025-salute-to-service-limited-jersey-olive-nfl`
- `bo-nix-denver-broncos-alternate-game-jersey-navy-nfl`
- `bo-nix-denver-broncos-game-jersey-white-nfl`
- `bo-nix-denver-broncos-player-game-jersey-orange-nfl`
- `brian-thomas-jr-jacksonville-jaguars-player-game-jersey-teal-nfl`
- `brock-bowers-las-vegas-raiders-2025-salute-to-service-limited-jersey-olive-nfl`
- `brock-bowers-las-vegas-raiders-player-game-jersey-black-nfl`
- `brock-purdy-49ers-2025-rivalries-black-game-jersey`
- `bryce-young-carolina-panthers-2025-salute-to-service-limited-jersey-olive-nfl`
- `bryce-young-carolina-panthers-team-game-jersey-black-nfl`
- `budda-baker-arizona-cardinals-2025-rivalries-collection-game-jersey-natural-nhl`
- `budda-baker-arizona-cardinals-game-jersey-black`
- `budda-baker-arizona-cardinals-game-jersey-black-nhl`
- `budda-baker-arizona-cardinals-game-player-jersey`
- `budda-baker-arizona-cardinals-game-player-jersey-cardinal-nhl`
- `buffalo-bills-custom-game-jersey-royal-nfl`
- `buffalo-bills-custom-game-jersey-white-nfl`
- `buffalo-bills-khalil-shakir-10-gray-football-jersey`
- `c-j-stroud-houston-texans-2025-salute-to-service-limited-jersey-olive-nfl`
- `calais-campbell-arizona-cardinals-team-game-jersey-cardinal-nhl`
- `caleb-williams-chicago-bears-2025-salute-to-service-limited-jersey-olive-nfl`
- `caleb-williams-chicago-bears-first-round-pick-player-game-jersey-white-nfl`
- `caleb-williams-chicago-bears-player-game-jersey-navy-nfl`
- `cam-skattebo-44-new-york-giants-royal-football-jersey`
- _…and 262 more_

### VARIANT STRUCTURE (Color vs Size)
| | Count |
| --- | ---: |
| Products with **Color-only** variants (no Size option) | 2965 |
| Products with **Size-only** variants | 5 |
| Products with both Color and Size | 0 |

**Note:** MLB/NHL/soccer products often use **Color** (or Default Title) as the Shopify variant axis. Apparel **Size** is provided by the product options layer (Aris optionsets), not Shopify variants. Do not map Color → `size_label`.

### SIZE CHART
| | Count |
| --- | ---: |
| Products missing size chart | 0 |

Linked only when `sport` is confidently set (NFL→nfl-adult, NHL→nhl-adult, etc.). All 500 already linked.

### TAXONOMY
| | Count |
| --- | ---: |
| Missing sport | 0 |
| Missing league | 2 |
| Missing team | 128 |
| Missing player | 3373 |

**Remaining missing league (2):**

- `julian-alvarez-man-city-19-jersey (Julian Alvarez Man City 19 Jersey)`
- `penny-hardaway-memphis-state-25-jersey (Penny Hardaway Memphis State 25 Jersey)`

### CUSTOMISATION
| | Count |
| --- | ---: |
| Missing customisation profile | 0 |

All 500 published products have `jersey-standard` customisation profile linked.

### IMAGES
| | Count |
| --- | ---: |
| Products with no images | 0 |
| Products with missing alt text | 0 |

All products have Shopify CDN images with alt text from product title.

### COLLECTIONS
| | Count |
| --- | ---: |
| Published products with zero collections | 0 |

#### `all-products-chatgpt-ai-product-description`
- **Title:** All Products (ChatGPT-AI Product Description)
- **Status:** published
- **Shopify ID:** gid://shopify/Collection/650101588277
- **Total memberships:** 3872
- **Published products in collection:** 3872
- **Origin:** Migrated Shopify collection handle — bulk AI description export bucket from SJD Shopify
- **Customer reachable:** Yes via `/collections/all-products-chatgpt-ai-product-description`
- **Indexed:** Public collection page; not disallowed in robots.txt
- **Recommended action:** Merchandising decision — rename/replace/hide when approved. **Not auto-changed.**

### DESCRIPTIONS
| | Count |
| --- | ---: |
| Empty description | 0 |

All 500 have descriptions. No placeholder-only or broken HTML detected at bulk scan level.

### SEO
| | Count |
| --- | ---: |
| Missing meta description (≥40 chars) | 0 |
| Missing canonical | 0 |

All products have SEO records with meta description and canonical `/products/{slug}`.

### DUPLICATES

| Confidence | Count | Notes |
| --- | ---: | --- |
| Duplicate Shopify product IDs | 0 | None |
| Duplicate slugs | 0 | None |
| Duplicate SKU groups | 2 | N/A (no SKUs) |
| **HIGH** — identical normalized title | 112 | Same title, different Shopify IDs |
| **MEDIUM** — slug suffix pairs | 20 | e.g. `-1` suffix duplicates |
| **LOW** — near-title pairs | 30 | Similar titles, different products |

#### HIGH confidence
- **"new york yankees toque"** (6 products): mlb-new-york-yankees-toque, mlb-new-york-yankees-toque-1, mlb-new-york-yankees-toque-2, mlb-new-york-yankees-toque-3, mlb-new-york-yankees-toque-4, mlb-new-york-yankees-toque-5
- **"los angeles dodgers toque"** (5 products): mlb-los-angeles-dodgers-toque, mlb-los-angeles-dodgers-toque-1, mlb-los-angeles-dodgers-toque-2, mlb-los-angeles-dodgers-toque-3, mlb-los-angeles-dodgers-toque-4
- **"new york mets toque"** (3 products): mlb-new-york-mets-toque, mlb-new-york-mets-toque-1, mlb-new-york-mets-toque-2
- **"chicago white sox toque"** (3 products): mlb-chicago-white-sox-toque, mlb-chicago-white-sox-toque-1, mlb-chicago-white-sox-toque-2
- **"cleveland indians toque"** (3 products): mlb-cleveland-indians-toque, mlb-cleveland-indians-toque-1, mlb-cleveland-indians-toque-2
- **"atlanta braves toque"** (3 products): mlb-atlanta-braves-toque, mlb-atlanta-braves-toque-1, mlb-atlanta-braves-toque-2
- **"tony gwynn san diego padres 19 jersey"** (3 products): mlb-tony-gwynn-san-diego-19-jersey, mlb-tony-gwynn-san-diego-padres-19-jersey, mlb-tony-gwynn-san-diego-padres-19-jersey-1
- **"pittsburg pirates toque"** (3 products): mlb-pittsburg-pirates-toque, mlb-pittsburg-pirates-toque-1, mlb-pittsburg-pirates-toque-2
- **"toronto blue jays toque"** (3 products): mlb-toronto-blue-jays-toque, mlb-toronto-blue-jays-toque-1, mlb-toronto-blue-jays-toque-2
- **"dave mcnally baltimore orioles 19 jersey"** (3 products): mlb-dave-mcnally-baltimore-orioles-19-jersey, mlb-dave-mcnally-baltimore-orioles-19-jersey-1, mlb-dave-mcnally-baltimore-orioles-19-jersey-2
- **"boston red sox toque"** (3 products): mlb-boston-red-sox-toque, mlb-boston-red-sox-toque-1, mlb-boston-red-sox-toque-2
- **"ryne sandberg chicago cubs 23 jersey"** (3 products): mlb-ryne-sandberg-chicago-cubs-23-jersey, mlb-ryne-sandberg-chicago-cubs-23-jersey-1, mlb-ryne-sandberg-chicago-cubs-23-jersey-2
- **"kansas city royals toque"** (3 products): mlb-kansas-city-royals-toque, mlb-kansas-city-royals-toque-1, mlb-kansas-city-royals-toque-2
- **"george brett kansas city royals 5 jersey"** (3 products): mlb-george-brett-kansas-city-royals-5-jersey, mlb-george-brett-kansas-city-royals-5-jersey-1, mlb-george-brett-kansas-city-royals-5-jersey-2
- **"san diego padres toque"** (3 products): mlb-san-diego-padres-toque, mlb-san-diego-padres-toque-1, mlb-san-diego-padres-toque-2
- **"chicago cubs toque"** (3 products): mlb-chicago-cubs-toque, mlb-chicago-cubs-toque-1, mlb-chicago-cubs-toque-2
- **"san francisco giants toque"** (3 products): mlb-san-francisco-giants-toque, mlb-san-francisco-giants-toque-1, mlb-san-francisco-giants-toque-2
- **"detroit tigers toque"** (3 products): mlb-detroit-tigers-toque, mlb-detroit-tigers-toque-1, mlb-detroit-tigers-toque-2
- **"corbin carroll arizona diamondbacks 7 jersey"** (2 products): mlb-corbin-carroll-arizona-diamondbacks-7-jersey, mlb-corbin-carroll-arizona-diamondbacks-7-jersey-1
- **"curt schilling boston red sox 38 jersey"** (2 products): mlb-curt-schilling-boston-red-sox-38-jersey, mlb-curt-schilling-boston-red-sox-38-jersey-1
- **"danny jansen toronto blue jays 9 jersey"** (2 products): mlb-danny-jansen-toronto-blue-jays-9-jersey, mlb-danny-jansen-toronto-blue-jays-9-jersey-1
- **"daulton varsho toronto blue jays 25 jersey"** (2 products): mlb-daulton-varsho-toronto-blue-jays-25-jersey, mlb-daulton-varsho-toronto-blue-jays-25-jersey-1
- **"dave righetti san francisco giants 19 jersey"** (2 products): mlb-dave-righetti-san-francisco-giants-19-jersey, mlb-dave-righetti-san-francisco-giants-19-jersey-1
- **"dave stieb toronto blue jays 37 jersey"** (2 products): mlb-dave-stieb-toronto-blue-jays-37-jersey, mlb-dave-stieb-toronto-blue-jays-37-jersey-1
- **"doug gilmour toronto maple leafs 93 jersey"** (2 products): nhl-doug-gilmour-toronto-maple-leafs-93-jersey, nhl-doug-gilmour-toronto-maple-leafs-93-jersey-1
- **"drey jameson arizona diamondbacks 99 jersey"** (2 products): mlb-drey-jameson-arizona-diamondbacks-99-jersey, mlb-drey-jameson-arizona-diamondbacks-99-jersey-1
- **"ed belfour chicago blackhawks 30 jersey"** (2 products): nhl-ed-belfour-chicago-blackhawks-30-jersey, nhl-ed-belfour-chicago-blackhawks-30-jersey-1
- **"eddie murray cleveland indians 33 jersey"** (2 products): mlb-eddie-murray-cleveland-indians-33-jersey, mlb-eddie-murray-cleveland-indians-33-jersey-1
- **"gabriel moreno arizona diamondbacks 14 jersey"** (2 products): mlb-gabriel-moreno-arizona-diamondbacks-14-jersey, mlb-gabriel-moreno-arizona-diamondbacks-14-jersey-1
- **"geraldo perdomo arizona diamondbacks 2 jersey"** (2 products): mlb-geraldo-perdomo-arizona-diamondbacks-2-jersey, mlb-geraldo-perdomo-arizona-diamondbacks-2-jersey-1
- **"jackie robinson montreal royals 9 jersey"** (2 products): mlb-jackie-robinson-montreal-royals-9-jersey, mlb-jackie-robinson-montreal-royals-9-jersey-1
- **"jake mccarthy arizona diamondbacks 31 jersey"** (2 products): mlb-jake-mccarthy-arizona-diamondbacks-31-jersey, mlb-jake-mccarthy-arizona-diamondbacks-31jersey
- **"jason giambi oakland athletics 16 jersey"** (2 products): mlb-jason-giambi-oakland-athletics-16-jersey, mlb-jason-giambi-oakland-athletics-16-jersey-1
- **"joe sakic colorado avalanche 19 jersey"** (2 products): nhl-joe-sakic-colorado-avalanche-19-jersey, nhl-joe-sakic-colorado-avalanche-19-jersey-1
- **"jonathan toews chicago blackhawks 19 jersey"** (2 products): nhl-chicago-blackhawks-jonathan-toews-19-jersey, nhl-jonathan-toews-chicago-blackhawks-19-jersey
- **"jose canseco oakland athletics 33 jersey"** (2 products): mlb-jose-canseco-oakland-athletics-33-jersey, mlb-jose-canseco-oakland-athletics-33-jersey-1
- **"kevin gausman toronto blue jays 34 jersey"** (2 products): mlb-kevin-gausman-toronto-blue-jays-34-jersey, mlb-kevin-gausman-toronto-blue-jays-34-jersey-1
- **"kevin kiermaier toronto blue jays 39 jersey"** (2 products): mlb-kevin-kiermaier-toronto-blue-jays-39-jersey, mlb-kevin-kiermaier-toronto-blue-jays-39-jersey-1
- **"kirill kaprizov minnesota wilds 97 jersey"** (2 products): nhl-kirill-kaprizov-minnesota-wilds-97-jersey, nhl-kirill-kaprizov-minnesota-wilds-97-jersey-1
- **"kyle lewis arizona diamondbacks 1 jersey"** (2 products): mlb-kyle-lewis-arizona-diamondbacks-1-jersey, mlb-kyle-lewis-arizona-diamondbacks-1-jersey-1
- **"kyle nelson arizona diamondbacks 24 jersey"** (2 products): mlb-kyle-nelson-arizona-diamondbacks-24-jersey, mlb-kyle-nelson-arizona-diamondbacks-24-jersey-1
- **"lee smith chicago cubs 46 jersey"** (2 products): mlb-lee-smith-chicago-cubs-46-jersey, mlb-lee-smith-chicago-cubs-46-jersey-1
- **"los angeles angels toque"** (2 products): mlb-los-angeles-angels-toque, mlb-los-angeles-angels-toque-1
- **"manny ramirez boston red sox 24 jersey"** (2 products): mlb-manny-ramirez-boston-red-sox-24-jersey, mlb-manny-ramirez-boston-red-sox-24-jersey-1
- **"mariano rivera new york yankees 42 jersey"** (2 products): mlb-mariano-rivera-new-york-yankees-42-jersey, mlb-mariano-rivera-new-york-yankees-42-jersey-1
- **"mark grace arizona diamondbacks 17 jersey"** (2 products): mlb-mark-grace-arizona-diamondbacks-17-jersey, mlb-mark-grace-arizona-diamondbacks-17-jersey-1
- **"mark langston seattle mariners 12 jersey"** (2 products): mlb-mark-langston-seattle-mariners-12-jersey, mlb-mark-langston-seattle-mariners-12-jersey-1
- **"martin necas carolina hurricanes 88 jersey"** (2 products): nhl-martin-necas-carolina-hurricanes-88-jersey, nhl-martin-necas-carolina-hurricanes-88-jersey-1
- **"mason marchment dallas stars 17 jersey"** (2 products): nhl-mason-marchment-dallas-stars-17-jersey, nhl-mason-marchment-dallas-stars-17-jersey-1
- **"mason mctavish anaheim ducks 37 jersey"** (2 products): nhl-mason-mctavish-anaheim-ducks-37-jersey, nhl-mason-mctavish-anaheim-ducks-37-jersey-1
- **"miguel castro arizona diamondbacks 50 jersey"** (2 products): mlb-miguel-castro-arizona-diamondbacks-50-jersey, mlb-miguel-castro-arizona-diamondbacks-50-jersey-1
- **"mike modano minnesota north stars 9 jersey"** (2 products): nhl-mike-modano-minnesota-north-stars-9-jersey, nhl-mike-modano-minnesota-north-stars-9-jersey-1
- **"mike piazza new york mets 31 jersey"** (2 products): mlb-mike-piazza-new-york-mets-31-jersey, mlb-mike-piazza-new-york-mets-31-jersey-1
- **"mike yastrzemski san francisco giants 5 jersey"** (2 products): mlb-mike-yastrzemski-san-francisco-giants-5-jersey, mlb-mike-yastrzemski-san-francisco-giants-5-jersey-1
- **"milwaukee brewers toque"** (2 products): mlb-milwaukee-brewers-toque, mlb-milwaukee-brewers-toque-1
- **"minnesota twins toque"** (2 products): mlb-minnesota-twins-toque, mlb-minnesota-twins-toque-1
- **"moritz seider detroit red wings 53 jersey"** (2 products): nhl-moritz-seider-detroit-red-wings-53-jersey, nhl-moritz-seider-detroit-red-wings-53-jersey-1
- **"nate pearson toronto blue jays 24 jersey"** (2 products): mlb-nate-pearson-toronto-blue-jays-24-jersey, mlb-nate-pearson-toronto-blue-jays-24-jersey-1
- **"nick ahmed arizona diamondbacks 13 jersey"** (2 products): mlb-nick-ahmed-arizona-diamondbacks-13-jersey, mlb-nick-ahmed-arizona-diamondbacks-13-jersey-1
- **"nikolaj ehlers winnipeg jets 27 jersey"** (2 products): nhl-nikolaj-ehlers-winnipeg-jets-27-jersey, nhl-nikolaj-ehlers-winnipeg-jets-27-jersey-1
- **"nolan ryan houston astros 34 jersey"** (2 products): mlb-nolan-ryan-houston-astros-34-jersey, mlb-nolan-ryan-houston-astros-34-jersey-1
- **"nolan ryan texas rangers 34 jersey"** (2 products): mlb-nolan-ryan-texas-rangers-34-jersey, mlb-nolan-ryan-texas-rangers-34-jersey-1
- **"oakland athletics toque"** (2 products): mlb-oakland-athletics-toque, mlb-oakland-athletics-toque-1
- **"patrick roy colorado avalanche 33 jersey"** (2 products): nhl-patrick-roy-colorado-avalanche-33-jersey, nhl-patrick-roy-colorado-avalanche-33-jersey-1
- **"patrick roy montreal canadians 33 jersey"** (2 products): nhl-patrick-roy-montreal-canadians-33-jersey, nhl-patrick-roy-montreal-canadians-33-jersey-1
- **"paul coffey edmonton oilers 7 jersey"** (2 products): nhl-paul-coffey-edmonton-oilers-7-jersey, nhl-paul-coffey-edmonton-oilers-7-jersey-1
- **"paul molitor milwaukee brewers 4 jersey"** (2 products): mlb-paul-molitor-milwaukee-brewers-4-jersey, mlb-paul-molitor-milwaukee-brewers-4-jersey-1
- **"paul molitor minnesota twins 4 jersey"** (2 products): mlb-paul-molitor-minnesota-twins-4-jersey, mlb-paul-molitor-minnesota-twins-4-jersey-1
- **"paul molitor toronto blue jays 19 jersey"** (2 products): mlb-paul-molitor-toronto-blue-jays-19-jersey, mlb-paul-molitor-toronto-blue-jays-19-jersey-1
- **"pedro martinez boston red sox 45 jersey"** (2 products): mlb-pedro-martinez-boston-red-sox-45-jersey, mlb-pedro-martinez-boston-red-sox-45-jersey-1
- **"pedro martinez los angeles dodgers 45 jersey"** (2 products): mlb-pedro-martinez-los-angeles-dodgers-45-jersey, mlb-pedro-martinez-los-angeles-dodgers-45-jersey-1
- **"pedro martinez montreal expos 45 jersey"** (2 products): mlb-pedro-martinez-montreal-expos-45-jersey, mlb-pedro-martinez-montreal-expos-45-jersey-1
- **"philadelphia phillies toque"** (2 products): mlb-philadelphia-phillies-toque, mlb-philadelphia-phillies-toque-1
- **"rickey henderson oakland athletics 24 jersey"** (2 products): mlb-rickey-henderson-oakland-athletics-24-jersey, mlb-rickey-henderson-oakland-athletics-24-jersey-1
- **"ron francis hartford whalers 10 jersey"** (2 products): nhl-ron-francis-hartford-whalers-10-jersey, nhl-ron-francis-hartford-whalers-10-jersey-1
- **"ryne nelson arizona diamondbacks 19 jersey"** (2 products): mlb-ryne-nelson-arizona-diamondbacks-19-jersey, mlb-ryne-nelson-arizona-diamondbacks-19-jersey-1
- **"ryne sandberg philadelphia phillies 37 jersey"** (2 products): mlb-ryne-sandberg-philadelphia-phillies-37-jersey, mlb-ryne-sandberg-philadelphia-phillies-37-jersey-1
- **"sammy sosa chicago cubs 21 jersey"** (2 products): mlb-sammy-sosa-chicago-cubs-21-jersey, mlb-sammy-sosa-chicago-cubs-21-jersey-1
- **"scott mcgough arizona diamondbacks 30 jersey"** (2 products): mlb-scott-mcgough-arizona-diamondbacks-30-jersey, mlb-scott-mcgough-arizona-diamondbacks-30-jersey-1
- **"scott stevens new jersey devils 4 jersey"** (2 products): nhl-scott-stevens-new-jersey-devils-4-jersey, nhl-scott-stevens-new-jersey-devils-4-jersey-1
- **"sean kuraly columbus blue jackets 7 jersey"** (2 products): nhl-sean-kuraly-columbus-blue-jackets-7-jersey, nhl-sean-kuraly-columbus-blue-jackets-7-jersey-1
- **"sean monahan montreal canadiens 91 jersey"** (2 products): nhl-sean-monahan-montreal-canadiens-91-jersey, nhl-sean-monahan-montreal-canadiens-91-jersey-1
- **"st. louis cardinals toque"** (2 products): mlb-st-louis-cardinals-toque, mlb-st-louis-cardinals-toque-1
- **"texas rangers toque"** (2 products): mlb-texas-rangers-toque, mlb-texas-rangers-toque-1
- **"tony amonte chicago blackhawks 10 jersey"** (2 products): nhl-tony-amonte-chicago-blackhawks-10-jersey, nhl-tony-amonte-chicago-blackhawks-10-jersey-1
- **"tony pena pittsburgh pirates 6 jersey"** (2 products): mlb-tony-pena-pittsburgh-pirates-6-jersey, mlb-tony-pena-pittsburgh-pirates-6-jersey-1
- **"trevor richards toronto blue jays 33 jersey"** (2 products): mlb-trevor-richards-toronto-blue-jays-33-jersey, mlb-trevor-richards-toronto-blue-jays-33-jersey-1
- **"vladimir tarasenko st. louis blues 91 jersey"** (2 products): nhl-vladimir-tarasenko-st-louis-blues-91-jersey, st-louis-blues-vladimir-tarasenko-91-jerseys
- **"wade boggs boston red sox 26 jersey"** (2 products): mlb-wade-boggs-boston-red-sox-26-jersey, mlb-wade-boggs-boston-red-sox-26-jersey-1
- **"wander franco tampa bay rays 5 jersey"** (2 products): mlb-wander-franco-tampa-bay-rays-5-jersey, mlb-wander-franco-tampa-bay-rays-5-jersey-1
- **"will smith los angeles dodgers 16 jersey"** (2 products): mlb-will-smith-los-angeles-dodgers-16-jersey, mlb-will-smith-los-angeles-dodgers-16-jersey-1
- **"yordan alvarez houston astros 44 jersey"** (2 products): mlb-yordan-alvarez-houston-astros-44-jersey, mlb-yordan-alvarez-houston-astros-44-jersey-1
- **"yusei kikuchi toronto blue jays 16 jersey"** (2 products): mlb-yusei-kikuchi-toronto-blue-jays-16-jersey, mlb-yusei-kikuchi-toronto-blue-jays-16-jersey-1
- **"adam lowry winnipeg jets 17 jersey"** (2 products): nhl-adam-lowry-winnipeg-jets-17-jersey, nhl-adam-lowry-winnipeg-jets-17-jersey-1
- **"zach pop toronto blue jays 56 jersey"** (2 products): mlb-zach-pop-toronto-blue-jays-56-jersey, mlb-zach-pop-toronto-blue-jays-56-jersey-1
- **"alan trammell detroit tigers 3 jersey"** (2 products): mlb-alan-trammell-detroit-tigers-3-jersey, mlb-alan-trammell-detroit-tigers-3-jersey-1
- **"alex rodriguez seattle mariners 3 jersey"** (2 products): mlb-alex-rodriguez-seattle-mariners-3-jersey, mlb-alex-rodriguez-seattle-mariners-3-jersey-1
- **"andy benes san diego padres 40 jersey"** (2 products): mlb-andy-benes-san-diego-padres-40-jersey, mlb-andy-benes-san-diego-padres-40-jersey-1
- **"anson carter vancouver canucks 77 jersey"** (2 products): nhl-anson-carter-vancouver-canucks-77-jersey, nhl-anson-carter-vancouver-canucks-77-jersey-1
- **"auston matthews toronto maple leafs 34 jersey"** (2 products): austin-matthews-34, nhl-auston-matthews-toronto-maple-leafs-34-jersey
- **"bo jackson chicago white sox 8 - 1993 jersey"** (2 products): mlb-bo-jackson-chicago-white-sox-9-1993-jersey, mlb-bo-jackson-chicago-white-sox-9-1993-jersey-1
- **"bob aspromonte houston astros 14 jersey"** (2 products): mlb-bob-aspromonte-houston-astros-14-jersey, mlb-bob-aspromonte-houston-astros-14-jersey-1
- **"bobby tolan cincinnati reds 28 jersey"** (2 products): mlb-bobby-tolan-cincinnati-reds-28-jersey, mlb-bobby-tolan-cincinnati-reds-28-jersey-1
- **"bobby wine montreal expos 7 jersey"** (2 products): mlb-bobby-wine-montreal-expos-7-jersey, mlb-bobby-wine-montreal-expos-7-jersey-1
- **"cam fowler anaheim ducks 4 jersey"** (2 products): nhl-cam-fowler-anaheim-ducks-4-jersey, nhl-cam-fowler-anaheim-ducks-4-jersey-1
- **"carlton fisk boston red sox 27 jersey"** (2 products): mlb-carlton-fisk-boston-red-sox-27-jersey, mlb-carlton-fisk-boston-red-sox-27-jersey-1
- **"chris bassitt toronto blue jays 40 jersey"** (2 products): mlb-chris-bassitt-toronto-blue-jays-40-jersey, mlb-chris-bassitt-toronto-blue-jays-40-jersey-1
- **"christopher tanev calgary flames 8 jersey"** (2 products): nhl-christopher-tanev-calgary-flames-8-jersey, nhl-christopher-tanev-calgary-flames-8-jersey-1
- **"cincinnati reds toque"** (2 products): mlb-cincinnati-reds-toque, mlb-cincinnati-reds-toque-1
- **"clayton keller western all star 9 jersey"** (2 products): nhl-clayton-keller-western-all-star-9-jersey, nhl-clayton-keller-western-all-star-9-jersey-1
- **"colorado rockies toque"** (2 products): mlb-colorado-rockies-toque, mlb-colorado-rockies-toque-1
- **"connor hellebuyck winnipeg jets 37 jersey"** (2 products): nhl-connor-hellebuyck-winnipeg-jets-37-jersey, nhl-connor-hellebuyck-winnipeg-jets-37-jersey-1

#### MEDIUM confidence (slug suffix)
- `mlb-new-york-yankees-toque`: mlb-new-york-yankees-toque, mlb-new-york-yankees-toque-1, mlb-new-york-yankees-toque-2, mlb-new-york-yankees-toque-3, mlb-new-york-yankees-toque-4, mlb-new-york-yankees-toque-5
- `mlb-los-angeles-dodgers-toque`: mlb-los-angeles-dodgers-toque, mlb-los-angeles-dodgers-toque-1, mlb-los-angeles-dodgers-toque-2, mlb-los-angeles-dodgers-toque-3, mlb-los-angeles-dodgers-toque-4
- `alejandro-gomez-17-argentina-fifa-world-cup-jersey`: alejandro-gomez-17-argentina-fifa-world-cup-jersey, alejandro-gomez-17-argentina-fifa-world-cup-jersey-1, alejandro-gomez-17-argentina-fifa-world-cup-jersey-2, alejandro-gomez-17-argentina-fifa-world-cup-jersey-3, alejandro-gomez-17-argentina-fifa-world-cup-jersey-4
- `alejandro-gomez-argentina-17-fifa-world-cup-jersey`: alejandro-gomez-argentina-17-fifa-world-cup-jersey, alejandro-gomez-argentina-17-fifa-world-cup-jersey-1, alejandro-gomez-argentina-17-fifa-world-cup-jersey-2, alejandro-gomez-argentina-17-fifa-world-cup-jersey-4
- `mlb-pittsburg-pirates-toque`: mlb-pittsburg-pirates-toque, mlb-pittsburg-pirates-toque-1, mlb-pittsburg-pirates-toque-2
- `mlb-san-diego-padres-toque`: mlb-san-diego-padres-toque, mlb-san-diego-padres-toque-1, mlb-san-diego-padres-toque-2
- `mlb-san-francisco-giants-toque`: mlb-san-francisco-giants-toque, mlb-san-francisco-giants-toque-1, mlb-san-francisco-giants-toque-2
- `mlb-kansas-city-royals-toque`: mlb-kansas-city-royals-toque, mlb-kansas-city-royals-toque-1, mlb-kansas-city-royals-toque-2
- `mlb-new-york-mets-toque`: mlb-new-york-mets-toque, mlb-new-york-mets-toque-1, mlb-new-york-mets-toque-2
- `mlb-detroit-tigers-toque`: mlb-detroit-tigers-toque, mlb-detroit-tigers-toque-1, mlb-detroit-tigers-toque-2
- `mlb-chicago-white-sox-toque`: mlb-chicago-white-sox-toque, mlb-chicago-white-sox-toque-1, mlb-chicago-white-sox-toque-2
- `mlb-boston-red-sox-toque`: mlb-boston-red-sox-toque, mlb-boston-red-sox-toque-1, mlb-boston-red-sox-toque-2
- `mlb-ryne-sandberg-chicago-cubs-23-jersey`: mlb-ryne-sandberg-chicago-cubs-23-jersey, mlb-ryne-sandberg-chicago-cubs-23-jersey-1, mlb-ryne-sandberg-chicago-cubs-23-jersey-2
- `mlb-chicago-cubs-toque`: mlb-chicago-cubs-toque, mlb-chicago-cubs-toque-1, mlb-chicago-cubs-toque-2
- `mlb-dave-mcnally-baltimore-orioles-19-jersey`: mlb-dave-mcnally-baltimore-orioles-19-jersey, mlb-dave-mcnally-baltimore-orioles-19-jersey-1, mlb-dave-mcnally-baltimore-orioles-19-jersey-2
- `mlb-george-brett-kansas-city-royals-5-jersey`: mlb-george-brett-kansas-city-royals-5-jersey, mlb-george-brett-kansas-city-royals-5-jersey-1, mlb-george-brett-kansas-city-royals-5-jersey-2
- `mlb-atlanta-braves-toque`: mlb-atlanta-braves-toque, mlb-atlanta-braves-toque-1, mlb-atlanta-braves-toque-2
- `mlb-cleveland-indians-toque`: mlb-cleveland-indians-toque, mlb-cleveland-indians-toque-1, mlb-cleveland-indians-toque-2
- `axel-witsel-belgium-6-fifa-world-cup-jersey`: axel-witsel-belgium-6-fifa-world-cup-jersey, axel-witsel-belgium-6-fifa-world-cup-jersey-1, axel-witsel-belgium-6-fifa-world-cup-jersey-2
- `mlb-toronto-blue-jays-toque`: mlb-toronto-blue-jays-toque, mlb-toronto-blue-jays-toque-1, mlb-toronto-blue-jays-toque-2

#### LOW confidence (review manually)
- `mlb-atlanta-braves-toque-2` ↔ `mlb-atlanta-braves-toque-1`: "Atlanta Braves Toque" / "Atlanta Braves Toque"
- `mlb-boston-red-sox-toque-2` ↔ `mlb-boston-red-sox-toque-1`: "Boston Red Sox Toque" / "Boston Red Sox Toque"
- `mlb-chicago-cubs-toque-1` ↔ `mlb-chicago-cubs-toque-2`: "Chicago Cubs Toque" / "Chicago Cubs Toque"
- `mlb-chicago-white-sox-toque-1` ↔ `mlb-chicago-white-sox-toque-2`: "Chicago White Sox Toque" / "Chicago White Sox Toque"
- `mlb-cleveland-indians-toque-1` ↔ `mlb-cleveland-indians-toque-2`: "Cleveland Indians Toque" / "Cleveland Indians Toque"
- `mlb-dave-mcnally-baltimore-orioles-19-jersey-2` ↔ `mlb-dave-mcnally-baltimore-orioles-19-jersey-1`: "Dave Mcnally Baltimore Orioles 19 Jersey" / "Dave Mcnally Baltimore Orioles 19 Jersey"
- `mlb-detroit-tigers-toque-1` ↔ `mlb-detroit-tigers-toque-2`: "Detroit Tigers Toque" / "Detroit Tigers Toque"
- `mlb-george-brett-kansas-city-royals-5-jersey-2` ↔ `mlb-george-brett-kansas-city-royals-5-jersey-1`: "George Brett Kansas City Royals 5 Jersey" / "George Brett Kansas City Royals 5 Jersey"
- `mlb-jake-mccarthy-arizona-diamondbacks-31-jersey` ↔ `mlb-jake-mccarthy-arizona-diamondbacks-31jersey`: "Jake McCarthy Arizona Diamondbacks 31 Jersey" / "Jake McCarthy Arizona Diamondbacks 31 Jersey"
- `mlb-jt-realmuto-philadelphia-phillies-10-jersey` ↔ `mlb-j-t-realmuto-philadelphia-phillies-10-jersey`: "JT Realmuto Philadelphia Phillies 10 Jersey" / "J.T. Realmuto Philadelphia Phillies 10 Jersey"

**Do not auto-delete or archive.** Review list only.

---

## Readiness breakdown

| Review reason | Products affected |
| --- | ---: |
| Missing option set (NEEDS_REVIEW) | 312 |
| Missing size chart | 0 |
| Taxonomy review | 0 |

SKU nulls and Default Title / Color-only Shopify variants are **not** readiness blockers under the Aris options model.

---

## Sample flagged products (first 40)

| Slug | SKU flag | Options flag |
| --- | --- | --- |
| 12s-seattle-seahawks-2025-rivalries-collection-game-jersey-wolf-gray-nfl | — | OPTION_SET_REQUIRED |
| aaron-rodgers-pittsburgh-steelers-game-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| ahmad-sauce-gardner-new-york-jets-2025-rivalries-collection-limited-jersey-gotham-green-nfl | — | OPTION_SET_REQUIRED |
| ahmad-sauce-gardner-new-york-jets-alternate-game-jersey-legacy-black-nfl | — | OPTION_SET_REQUIRED |
| akeem-davis-gaither-arizona-cardinals-team-game-jersey-cardinal-nfl | — | OPTION_SET_REQUIRED |
| alvin-kamara-new-orleans-saints-alternate-game-jersey-white-nfl | — | OPTION_SET_REQUIRED |
| alvin-kamara-new-orleans-saints-fashion-game-jersey-carbon-black-nfl | — | OPTION_SET_REQUIRED |
| alvin-kamara-new-orleans-saints-game-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| alvin-kamara-new-orleans-saints-gameday-golds-alternate-game-player-jersey-gold-nfl | — | OPTION_SET_REQUIRED |
| amon-ra-st-brown-detroit-lions-2nd-alternate-game-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| amon-ra-st-brown-detroit-lions-game-jersey-blue-nfl | — | OPTION_SET_REQUIRED |
| anquan-boldin-arizona-cardinals-mitchell-ness-legacy-replica-jersey-cardinal-nfl | — | OPTION_SET_REQUIRED |
| anthony-richardson-sr-indianapolis-colts-2025-salute-to-service-limited-jersey-olive-nfl | — | OPTION_SET_REQUIRED |
| arizona-cardinals-custom-game-jersey-white-nhl | — | OPTION_SET_REQUIRED |
| atlanta-falcons-custom-game-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| baker-mayfield-76-tampa-bay-buccaneers-vapor-f-u-s-e-player-limited-jersey-white-nfl | — | OPTION_SET_REQUIRED |
| baker-mayfield-tampa-bay-buccaneers-2025-salute-to-service-limited-jersey-olive-nfl | — | OPTION_SET_REQUIRED |
| baker-mayfield-tampa-bay-buccaneers-team-game-jersey-red-nfl | — | OPTION_SET_REQUIRED |
| baker-mayfield-tampa-bay-buccaneers-throwback-game-jersey-orange-nfl | — | OPTION_SET_REQUIRED |
| baltimore-ravens-custom-game-jersey-purple-nfl | — | OPTION_SET_REQUIRED |
| baltimore-ravens-custom-game-jersey-white-nfl | — | OPTION_SET_REQUIRED |
| baron-browning-arizona-cardinals-team-game-jersey-cardinal-nfl | — | OPTION_SET_REQUIRED |
| bijan-robinson-7-atlanta-falcons-football-jersey | — | OPTION_SET_REQUIRED |
| bijan-robinson-atlanta-falcons-game-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| blake-gillikin-arizona-cardinals-team-game-jersey-cardinal-nfl | — | OPTION_SET_REQUIRED |
| bo-jackson-las-vegas-raiders-1990-mitchell-ness-authentic-throwback-retired-player-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| bo-nix-denver-broncos-2025-salute-to-service-limited-jersey-olive-nfl | — | OPTION_SET_REQUIRED |
| bo-nix-denver-broncos-alternate-game-jersey-navy-nfl | — | OPTION_SET_REQUIRED |
| bo-nix-denver-broncos-game-jersey-white-nfl | — | OPTION_SET_REQUIRED |
| bo-nix-denver-broncos-player-game-jersey-orange-nfl | — | OPTION_SET_REQUIRED |
| brian-thomas-jr-jacksonville-jaguars-player-game-jersey-teal-nfl | — | OPTION_SET_REQUIRED |
| brock-bowers-las-vegas-raiders-2025-salute-to-service-limited-jersey-olive-nfl | — | OPTION_SET_REQUIRED |
| brock-bowers-las-vegas-raiders-player-game-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| brock-purdy-49ers-2025-rivalries-black-game-jersey | — | OPTION_SET_REQUIRED |
| bryce-young-carolina-panthers-2025-salute-to-service-limited-jersey-olive-nfl | — | OPTION_SET_REQUIRED |
| bryce-young-carolina-panthers-team-game-jersey-black-nfl | — | OPTION_SET_REQUIRED |
| budda-baker-arizona-cardinals-2025-rivalries-collection-game-jersey-natural-nhl | — | OPTION_SET_REQUIRED |
| budda-baker-arizona-cardinals-game-jersey-black | — | OPTION_SET_REQUIRED |
| budda-baker-arizona-cardinals-game-jersey-black-nhl | — | OPTION_SET_REQUIRED |
| budda-baker-arizona-cardinals-game-player-jersey | — | OPTION_SET_REQUIRED |

---

## NOT SAFE TO AUTOMATE

- Inventing SKU when absent from Shopify (**informational only — SKUs optional**)
- Inventing size lists for Football/Basketball without confirmed Aris optionsets
- Mapping Color variant → size_label
- Guessing sport/league/team/player without evidence
- Renaming collections (including chatgpt slug)
- Rewriting product titles or descriptions
- CREATE_NEW_LISTING proposals — human review only
- Deleting/archiving duplicate listings

---

## Decisions required (human)

1. **SKU assignment strategy** — 100% of published variants lack Shopify SKUs. Need supplier SKU file or Shopify-side population before READY.
2. **50 Default Title NHL products** — restructure variants in Shopify or define made-to-order sizing workflow.
3. **450 Color-only variants** — confirm PDP/cart fulfilment model (color selection vs size).
4. **Duplicate listings** — Anson Carter Canucks (HIGH), Alvaro Morata Spain (LOW — different slugs/titles).
5. **`all-products-chatgpt-ai-product-description`** — rename/hide from navigation when approved.
6. **Remaining missing league** — manual review if any remain after club-name inference.

---

## Commands

```bash
# Audit only
cd packages/database && corepack pnpm exec tsx --env-file=../../.env src/cli/run-catalogue-data-quality-audit.ts

# Apply safe autofixes
cd packages/database && corepack pnpm exec tsx --env-file=../../.env src/cli/run-catalogue-data-quality-audit.ts --apply
```
