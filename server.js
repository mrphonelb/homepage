const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");

const app = express();

app.use(cors());
app.use(express.static("public"));

const WEBSITE_URL = "https://www.mrphonelb.com";

const cache = new NodeCache({ stdTTL: 0 });

const HOMEPAGE_SECTIONS = [
  { key: "carousel1", cats: [6, 134, 274, 135], limit: 16 },
  { key: "carousel2", cats: [257, 143, 348, 281, 272], limit: 16 },
  { key: "carousel3", cats: [48, 402, 82, 80, 18], limit: 16 },
  { key: "carousel4", cats: [241, 142, 389, 306, 313], limit: 16 },
  { key: "carousel5", cats: [130, 252, 56, 140, 285], limit: 16 },
  { key: "carousel6", cats: [117, 236, 42, 41], limit: 16 },
  { key: "carousel7", cats: [54, 55, 401], limit: 16 },
  { key: "carousel8", cats: [28, 27, 320, 428, 321, 322, 325, 373, 58, 234, 319, 77, 69], limit: 16 },
  { key: "carousel9", cats: [422, 423, 412, 414, 415, 418, 419, 416, 420], limit: 16 },
  { key: "carousel10", cats: [20, 21, 29, 14, 359, 75, 52], limit: 16 },
  { key: "carousel11", cats: [66, 123, 68, 79, 124], limit: 16 },
  { key: "carousel12", cats: [237, 316, 32, 33], limit: 16 }
];

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Mr Phone Homepage API Running"
  });
});

function cacheKeyFor(cats, limit) {
  return `section_html_${cats.join("_")}_${limit}`;
}

function shuffleArray(array) {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

async function fetchWebsiteProductsByCategory(catId) {
  const url = `${WEBSITE_URL}/contents/products_list?cat_id=${catId}`;
  const response = await axios.get(url, { timeout: 20000 });
  const $ = cheerio.load(response.data);

  const products = [];

  $(".product").each((i, el) => {
    const product = $(el);
    const link = product.find("a").first();
    const img = product.find("img").first();

    const href = link.attr("href") || "";
    const fullUrl = href.startsWith("http")
      ? href
      : href
        ? `${WEBSITE_URL}${href}`
        : "";

    products.push({
      id: product.attr("data-product-id") || "",
      name:
        product.attr("data-name") ||
        link.attr("data-product-name") ||
        product.find("h6").text().trim(),
      price: Number(product.attr("data-price") || 0),
      image: product.attr("data-image") || img.attr("src") || "",
      url: fullUrl,
      brand: product.attr("data-brand") || "",
      category: product.attr("data-category") || "",
      stock_balance: Number(product.attr("data-stock-balance") || 0),
      currency: "USD",
      add_to_cart: true
    });
  });

  return products;
}

async function buildHomepageSection(cats, limit) {
  const seen = new Set();
  let allProducts = [];

  for (const catId of cats) {
    const products = await fetchWebsiteProductsByCategory(catId);

    const clean = products.filter(p => {
      if (!p.id || !p.name || !p.image) return false;
      if (seen.has(String(p.id))) return false;

      seen.add(String(p.id));
      return true;
    });

    allProducts = allProducts.concat(clean);
  }

  return shuffleArray(allProducts).slice(0, limit);
}

let LIVE_CACHE = {};
let NEXT_CACHE = {};
let isBuildingNext = false;

async function buildFullHomepageCache() {
  const newCache = {};

  for (const section of HOMEPAGE_SECTIONS) {
    try {
      const key = cacheKeyFor(section.cats, section.limit);
      const products = await buildHomepageSection(section.cats, section.limit);

      if (products.length) {
        newCache[key] = {
          products,
          createdAt: Date.now()
        };

        console.log(`Prepared ${section.key}: ${products.length} products`);
      } else {
        console.log(`Skipped ${section.key}: no products found`);
      }

    } catch (err) {
      console.error(`Failed preparing ${section.key}:`, err.message);
    }
  }

  return newCache;
}
async function buildNextVersion() {
  if (isBuildingNext) return;

  isBuildingNext = true;

  try {
    console.log("Building NEXT homepage version...");
    NEXT_CACHE = await buildFullHomepageCache();
    console.log("NEXT homepage version is ready.");
  } catch (err) {
    console.error("Failed building NEXT version:", err.message);
  } finally {
    isBuildingNext = false;
  }
}

function publishNextVersion() {
  if (!NEXT_CACHE || !Object.keys(NEXT_CACHE).length) {
    console.log("NEXT cache is not ready. Keeping LIVE version.");
    return;
  }

  LIVE_CACHE = NEXT_CACHE;
  NEXT_CACHE = {};

  Object.keys(LIVE_CACHE).forEach(key => {
    cache.set(key, LIVE_CACHE[key]);
  });

  console.log("LIVE homepage version swapped successfully.");
}

async function homepageCacheCycle() {
  // Build first live version
  await buildNextVersion();
  publishNextVersion();

  // Prepare the next version in the background
  buildNextVersion();

  setInterval(() => {
    if (Object.keys(NEXT_CACHE).length) {
      publishNextVersion();
      buildNextVersion();
    } else {
      console.log("Next version is still building. Keeping current homepage.");
    }
  }, 5 * 60 * 1000);
}
app.get("/api/homepage-section", async (req, res) => {
  try {
    const cats = String(req.query.cats || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    const limit = Number(req.query.limit || 16);

    if (!cats.length) {
      return res.status(400).json({
        error: true,
        message: "Missing cats parameter"
      });
    }

    const key = cacheKeyFor(cats, limit);
    const live = cache.get(key);

    if (live && live.products) {
      return res.json({
        cached: true,
        products: live.products
      });
    }

  const products = await buildHomepageSection(cats, limit);

if (products.length) {
  cache.set(key, {
    products,
    createdAt: Date.now()
  });

  return res.json({
    cached: false,
    emergency_build: true,
    products
  });
}

return res.status(503).json({
  error: true,
  message: "Homepage cache is warming up. Please refresh in a few seconds."
});

  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.get("/api/refresh-cache", async (req, res) => {
  try {
    await buildNextVersion();
    publishNextVersion();

    res.json({
      success: true,
      message: "Homepage cache refreshed successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/cache-status", (req, res) => {
  const keys = cache.keys();

  res.json({
    success: true,
    cached_sections: keys.length,
    keys
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  homepageCacheCycle();
});
