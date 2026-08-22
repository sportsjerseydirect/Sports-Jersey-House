import type { ProductDetail, ProductSummary } from "@sjh/shared";

export const SHOPPING_ASSISTANT_NAME = "SJH AI";

export type ShoppingSearchResult = {
  product: ProductSummary;
  score: number;
  reasons: string[];
};

export type ShoppingSearchFilters = {
  sport?: string[];
  league?: string[];
  team?: string[];
  priceMin?: number;
  priceMax?: number;
  availableOnly?: boolean;
};

export type ShoppingSearchProvider = {
  search(request: {
    query: string;
    filters?: ShoppingSearchFilters;
    limit?: number;
  }): Promise<{ results: ShoppingSearchResult[] }>;
  getProductBySlug(slug: string): Promise<ProductDetail | null>;
};

export type ShoppingToolName =
  | "search_products"
  | "get_product"
  | "compare_products"
  | "size_guidance"
  | "customisation_info";

export type ShoppingToolIntent = {
  tool: ShoppingToolName;
  query?: string;
  filters?: ShoppingSearchFilters;
  slug?: string;
  slugs?: string[];
  message: string;
};

const PRICE_PATTERNS = [
  /under\s*[£$€]?\s*(\d+(?:\.\d{2})?)/i,
  /below\s*[£$€]?\s*(\d+(?:\.\d{2})?)/i,
  /less than\s*[£$€]?\s*(\d+(?:\.\d{2})?)/i,
  /max\s*[£$€]?\s*(\d+(?:\.\d{2})?)/i
];

const TEAM_TO_SPORT: Record<string, string> = {
  lakers: "Basketball",
  celtics: "Basketball",
  warriors: "Basketball",
  bulls: "Basketball",
  knicks: "Basketball",
  heat: "Basketball",
  chiefs: "Football",
  cowboys: "Football",
  patriots: "Football",
  yankees: "Baseball",
  dodgers: "Baseball",
  "manchester city": "Soccer",
  "manchester united": "Soccer",
  liverpool: "Soccer",
  chelsea: "Soccer",
  arsenal: "Soccer",
  "real madrid": "Soccer",
  barcelona: "Soccer"
};

const TEAM_PATTERNS = [
  /\b(lakers|celtics|warriors|bulls|knicks|heat|manchester city|manchester united|liverpool|chelsea|arsenal|tottenham|real madrid|barcelona|chiefs|cowboys|patriots|yankees|dodgers)\b/i
];

const SPORT_PATTERNS: Array<{ pattern: RegExp; sport: string }> = [
  { pattern: /\bfootball\b|\bnfl\b/i, sport: "Football" },
  { pattern: /\bbasketball\b|\bnba\b/i, sport: "Basketball" },
  { pattern: /\bbaseball\b|\bmlb\b/i, sport: "Baseball" },
  { pattern: /\bhockey\b|\bnhl\b/i, sport: "Hockey" },
  { pattern: /\bsoccer\b|\bfootball kits?\b|\bpremier league\b/i, sport: "Soccer" }
];

/**
 * Rule-based intent parser for shopping assistant.
 * Uses real SearchProvider — no hallucinated products.
 */
export function parseShoppingIntent(input: string): ShoppingToolIntent {
  const message = input.trim();
  const lower = message.toLowerCase();

  if (/compare|vs\.?|versus/i.test(message) && /jersey|kit|shirt/i.test(message)) {
    return { tool: "compare_products", message, query: message };
  }

  if (/size|fit|measurement|size guide/i.test(message)) {
    return { tool: "size_guidance", message };
  }

  if (/customi[sz]e|personali[sz]e|name and number|patch/i.test(message)) {
    return { tool: "customisation_info", message };
  }

  const filters: ShoppingSearchFilters = { availableOnly: true };

  for (const entry of SPORT_PATTERNS) {
    if (entry.pattern.test(message)) {
      filters.sport = [entry.sport];
      break;
    }
  }

  const teamMatch = message.match(TEAM_PATTERNS[0]!);
  if (teamMatch?.[1]) {
    const teamName = teamMatch[1];
    filters.team = [teamName.replace(/\b\w/g, (c) => c.toUpperCase())];
    const sportFromTeam = TEAM_TO_SPORT[teamName.toLowerCase()];
    if (sportFromTeam && !filters.sport) {
      filters.sport = [sportFromTeam];
    }
  }

  for (const pattern of PRICE_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      filters.priceMax = Number.parseFloat(match[1]);
      break;
    }
  }

  if (/^\/products\//.test(message) || /^[a-z0-9-]+-jersey$/i.test(message)) {
    const slug = message.replace(/^\/products\//, "").trim();
    return { tool: "get_product", slug, message };
  }

  return { tool: "search_products", query: message, filters, message };
}

export type ShoppingAssistantResponse = {
  assistant: typeof SHOPPING_ASSISTANT_NAME;
  intent: ShoppingToolIntent;
  reply: string;
  products: ShoppingSearchResult[];
};

export async function runShoppingAssistantTurn(
  input: string,
  search: ShoppingSearchProvider
): Promise<ShoppingAssistantResponse> {
  const intent = parseShoppingIntent(input);

  switch (intent.tool) {
    case "get_product": {
      if (!intent.slug) {
        return {
          assistant: SHOPPING_ASSISTANT_NAME,
          intent,
          reply: "Please share a product link or slug so I can look it up in our catalogue.",
          products: []
        };
      }
      const product = await search.getProductBySlug(intent.slug);
      if (!product) {
        return {
          assistant: SHOPPING_ASSISTANT_NAME,
          intent,
          reply: "I couldn't find that product in our published catalogue.",
          products: []
        };
      }
      return {
        assistant: SHOPPING_ASSISTANT_NAME,
        intent,
        reply: `Here's ${product.title} from our catalogue.`,
        products: [{ product, score: 1, reasons: ["direct_lookup"] }]
      };
    }

    case "compare_products": {
      return {
        assistant: SHOPPING_ASSISTANT_NAME,
        intent,
        reply:
          "Product comparison is coming soon. Share two product links and I'll compare price, sizes, and customisation options from our database.",
        products: []
      };
    }

    case "size_guidance": {
      return {
        assistant: SHOPPING_ASSISTANT_NAME,
        intent,
        reply:
          "Check the size guide on each product page for measurements. If you tell me your usual size brand and the product you're viewing, I can suggest the best match.",
        products: []
      };
    }

    case "customisation_info": {
      return {
        assistant: SHOPPING_ASSISTANT_NAME,
        intent,
        reply:
          "Many jerseys support name and number personalisation. Open a product page and look for the customisation options — availability varies by item.",
        products: []
      };
    }

    case "search_products":
    default: {
      const response = await search.search({
        query: intent.query ?? intent.message,
        ...(intent.filters ? { filters: intent.filters } : {}),
        limit: 8
      });

      if (response.results.length === 0) {
        return {
          assistant: SHOPPING_ASSISTANT_NAME,
          intent,
          reply: "I didn't find matching published products. Try a team, league, or sport name.",
          products: []
        };
      }

      const names = response.results.slice(0, 3).map((r) => r.product.title);
      return {
        assistant: SHOPPING_ASSISTANT_NAME,
        intent,
        reply: `I found ${response.results.length} published product(s) in our catalogue, including ${names.join(", ")}.`,
        products: response.results
      };
    }
  }
}
