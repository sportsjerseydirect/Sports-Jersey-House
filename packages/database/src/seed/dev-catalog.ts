export const DEV_CATALOG_SEED_TAG = "dev-catalog-v1";

export type DevCatalogProduct = {
  slug: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  sport: string;
  league: string;
  team: string;
  sku: string;
  variantTitle: string;
  priceAmount: string;
  currencyCode: "USD" | "CAD";
  inventoryQuantity: number;
  imagePath: string;
  imageAlt: string;
};

/** Fake development catalogue — no Shopify IDs or external catalogue data. */
export const devCatalogProducts: DevCatalogProduct[] = [
  {
    slug: "chicago-bears-classic-home-jersey",
    title: "Chicago Bears Classic Home Jersey",
    description: "Premium dev-catalog jersey inspired by Chicago Bears home colours for local storefront testing.",
    vendor: "Sports Jersey House Dev",
    productType: "Jersey",
    sport: "Football",
    league: "NFL",
    team: "Chicago Bears",
    sku: "DEV-BEARS-HOME-M",
    variantTitle: "Medium",
    priceAmount: "129.99",
    currencyCode: "USD",
    inventoryQuantity: 25,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "Chicago Bears classic home jersey placeholder"
  },
  {
    slug: "green-bay-packers-throwback-jersey",
    title: "Green Bay Packers Throwback Jersey",
    description: "Throwback-style dev product for search and grid rendering checks.",
    vendor: "Sports Jersey House Dev",
    productType: "Jersey",
    sport: "Football",
    league: "NFL",
    team: "Green Bay Packers",
    sku: "DEV-PACKERS-TB-L",
    variantTitle: "Large",
    priceAmount: "139.99",
    currencyCode: "USD",
    inventoryQuantity: 18,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "Green Bay Packers throwback jersey placeholder"
  },
  {
    slug: "los-angeles-lakers-icon-edition-jersey",
    title: "Los Angeles Lakers Icon Edition Jersey",
    description: "Basketball dev-catalog listing with league and team metadata for faceted search later.",
    vendor: "Sports Jersey House Dev",
    productType: "Jersey",
    sport: "Basketball",
    league: "NBA",
    team: "Los Angeles Lakers",
    sku: "DEV-LAKERS-ICON-M",
    variantTitle: "Medium",
    priceAmount: "119.99",
    currencyCode: "USD",
    inventoryQuantity: 30,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "Los Angeles Lakers icon edition jersey placeholder"
  },
  {
    slug: "toronto-maple-leafs-authentic-home-jersey",
    title: "Toronto Maple Leafs Authentic Home Jersey",
    description: "Hockey dev product seeded for Canadian market pricing checks.",
    vendor: "Sports Jersey House Dev",
    productType: "Jersey",
    sport: "Hockey",
    league: "NHL",
    team: "Toronto Maple Leafs",
    sku: "DEV-LEAFS-HOME-L",
    variantTitle: "Large",
    priceAmount: "149.99",
    currencyCode: "CAD",
    inventoryQuantity: 12,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "Toronto Maple Leafs authentic home jersey placeholder"
  },
  {
    slug: "manchester-city-home-kit",
    title: "Manchester City Home Kit",
    description: "Soccer dev-catalog product for full-text search across league and team fields.",
    vendor: "Sports Jersey House Dev",
    productType: "Kit",
    sport: "Soccer",
    league: "Premier League",
    team: "Manchester City",
    sku: "DEV-CITY-HOME-M",
    variantTitle: "Medium",
    priceAmount: "109.99",
    currencyCode: "USD",
    inventoryQuantity: 22,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "Manchester City home kit placeholder"
  },
  {
    slug: "real-madrid-away-kit",
    title: "Real Madrid Away Kit",
    description: "European football dev listing used to validate catalogue pagination and cards.",
    vendor: "Sports Jersey House Dev",
    productType: "Kit",
    sport: "Soccer",
    league: "La Liga",
    team: "Real Madrid",
    sku: "DEV-MADRID-AWAY-L",
    variantTitle: "Large",
    priceAmount: "114.99",
    currencyCode: "USD",
    inventoryQuantity: 16,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "Real Madrid away kit placeholder"
  },
  {
    slug: "new-york-yankees-cooperstown-jersey",
    title: "New York Yankees Cooperstown Jersey",
    description: "Baseball dev product for mixed-sport catalogue rendering.",
    vendor: "Sports Jersey House Dev",
    productType: "Jersey",
    sport: "Baseball",
    league: "MLB",
    team: "New York Yankees",
    sku: "DEV-YANKEES-COOP-M",
    variantTitle: "Medium",
    priceAmount: "124.99",
    currencyCode: "USD",
    inventoryQuantity: 20,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "New York Yankees Cooperstown jersey placeholder"
  },
  {
    slug: "dallas-cowboys-stitched-away-jersey",
    title: "Dallas Cowboys Stitched Away Jersey",
    description: "Additional NFL dev listing to exercise multi-product grids locally.",
    vendor: "Sports Jersey House Dev",
    productType: "Jersey",
    sport: "Football",
    league: "NFL",
    team: "Dallas Cowboys",
    sku: "DEV-COWBOYS-AWAY-XL",
    variantTitle: "Extra Large",
    priceAmount: "134.99",
    currencyCode: "USD",
    inventoryQuantity: 14,
    imagePath: "/dev/jersey-placeholder.svg",
    imageAlt: "Dallas Cowboys stitched away jersey placeholder"
  }
];
