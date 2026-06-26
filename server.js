const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");

const app = express();
app.use(cors());
app.use(express.static("public"));

const WEBSITE_URL = "https://www.mrphonelb.com";
const DAFTRA_API_URL = process.env.DAFTRA_API_URL || "https://www.mrphonelb.com/api2";
const DAFTRA_API_TOKEN = process.env.DAFTRA_API_TOKEN;

const cache = new NodeCache({ stdTTL: 0 });
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Mr Phone Homepage API Running"
  });
});

/* OPTION A - old test: same Daftra HTML cards */
async function getProductCards(catIds, limit = 12) {
  const allCards = [];

  for (const catId of catIds) {
    const url = `${WEBSITE_URL}/contents/products_list?cat_id=${catId}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    $(".product").each((i, el) => {
      if (allCards.length < limit) {
        allCards.push($.html(el));
      }
    });

    if (allCards.length >= limit) break;
  }

  return allCards;
}

app.get("/api/homepage/cards/mobiles", async (req, res) => {
  try {
    const cacheKey = "cards_mobiles";
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({ cached: true, cards: cached });
    }

    const cards = await getProductCards([6, 134, 274, 135], 12);

    cache.set(cacheKey, cards);

    res.json({
      cached: false,
      cards
    });

  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

/* OPTION B - fast JSON products */
function cleanProduct(item) {
  const p = item.Product || item;

  const image =
    p.ProductImage?.find(img => String(img.default) === "1")?.file_full_path ||
    p.ProductImage?.[0]?.file_full_path ||
    item.ProductImage?.find(img => String(img.default) === "1")?.file_full_path ||
    item.ProductImage?.[0]?.file_full_path ||
    item.ProductMasterImage?.file_full_path ||
    p.ProductMasterImage?.file_full_path ||
    "";

  return {
  id: p.id,
  name: p.name || "",
  price: Number(p.unit_price || 0),
  image,
  url: `${WEBSITE_URL}/contents/product_view/${p.id}`,
  brand: p.brand || "",
  category: p.category || "",
  stock_balance: Number(p.stock_balance || 0),
  availabe_online: p.availabe_online,
  status: p.status,
  deactivate: p.deactivate,
  currency: "USD",
  add_to_cart: true
};
}

function isOnlineProduct(item) {
  const p = item.Product || item;

  return (
    String(p.availabe_online) === "1" &&
    String(p.status) === "0" &&
    String(p.deactivate || "0") === "0"
  );
}

async function fetchDaftraProductsByCategory(catId, limit = 12) {
  const response = await axios.get(`${DAFTRA_API_URL}/products`, {
    headers: {
      apikey: DAFTRA_API_TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    params: {
      cat_id: catId,
      limit: limit
    }
  });

  const rawProducts =
    response.data?.data ||
    response.data?.products ||
    response.data?.Product ||
    response.data ||
    [];

  return Array.isArray(rawProducts) ? rawProducts : [];
}

app.get("/api/homepage-json/mobiles", async (req, res) => {
  try {
    const cacheKey = "json_mobiles_v2";
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({ cached: true, products: cached });
    }

    // Same mobile categories from your current homepage
    const categoryIds = [6, 134, 274, 135];

    let allProducts = [];

    for (const catId of categoryIds) {
      const products = await fetchDaftraProductsByCategory(catId, 20);
      allProducts = allProducts.concat(products);

      if (allProducts.length >= 30) break;
    }
    
const seen = new Set();

const cleanProducts = allProducts
  .filter(isOnlineProduct)
  .map(cleanProduct)
  .filter(p => {
    if (!p.id || !p.name || !p.image) return false;
    if (seen.has(String(p.id))) return false;
    seen.add(String(p.id));
    return true;
  })
  .slice(0, 12);

    cache.set(cacheKey, cleanProducts);

    res.json({
      cached: false,
      products: cleanProducts
    });

  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.response?.data || error.message
    });
  }
});

async function fetchWebsiteProductsByCategory(catId) {
  const url = `${WEBSITE_URL}/contents/products_list?cat_id=${catId}`;
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const products = [];

  $(".product").each((i, el) => {
    const product = $(el);
    const link = product.find("a").first();
    const img = product.find("img").first();

    products.push({
      id: product.attr("data-product-id") || "",
      name: product.attr("data-name") || link.attr("data-product-name") || product.find("h6").text().trim(),
      price: Number(product.attr("data-price") || 0),
      image: product.attr("data-image") || img.attr("src") || "",
      url: link.attr("href")
        ? `${WEBSITE_URL}${link.attr("href")}`
        : "",
      brand: product.attr("data-brand") || "",
      category: product.attr("data-category") || "",
      stock_balance: Number(product.attr("data-stock-balance") || 0),
      currency: "USD",
      add_to_cart: true
    });
  });

  return products;
}

app.get("/api/homepage-section", async (req, res) => {
  try {
    const cats = String(req.query.cats || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    const limit = Number(req.query.limit || 16);

    if (!cats.length) {
      return res.status(400).json({ error: true, message: "Missing cats parameter" });
    }

    const cacheKey = `section_html_${cats.join("_")}_${limit}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.products) {
      res.json({
        cached: true,
        refreshing: now - cached.createdAt > CACHE_TTL,
        products: cached.products
      });

      if (now - cached.createdAt > CACHE_TTL && !cached.refreshing) {
        cached.refreshing = true;
        cache.set(cacheKey, cached);

        buildHomepageSection(cats, limit)
          .then(products => {
            cache.set(cacheKey, {
              products,
              createdAt: Date.now(),
              refreshing: false
            });
          })
          .catch(err => {
            console.error("Background refresh failed:", err.message);
            cached.refreshing = false;
            cache.set(cacheKey, cached);
          });
      }

      return;
    }

    const products = await buildHomepageSection(cats, limit);

    cache.set(cacheKey, {
      products,
      createdAt: Date.now(),
      refreshing: false
    });

    res.json({
      cached: false,
      refreshing: false,
      products
    });

  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.get("/api/refresh-cache", (req, res) => {
  cache.flushAll();

  res.json({
    success: true,
    message: "Homepage cache cleared successfully"
  });
});

async function buildHomepageSection(cats, limit) {
  const seen = new Set();
  const buckets = [];

  for (const catId of cats) {
    const products = await fetchWebsiteProductsByCategory(catId);

    const clean = products.filter(p => {
      if (!p.id || !p.name || !p.image) return false;
      if (seen.has(String(p.id))) return false;
      seen.add(String(p.id));
      return true;
    });

    buckets.push(clean);
  }

  const mixedProducts = [];
  let round = 0;

  while (mixedProducts.length < limit) {
    let added = false;

    for (const bucket of buckets) {
      if (bucket[round]) {
        mixedProducts.push(bucket[round]);
        added = true;

        if (mixedProducts.length >= limit) break;
      }
    }

    if (!added) break;
    round++;
  }

  return mixedProducts;
}

const PORT = process.env.PORT || 3000;

const HOMEPAGE_SECTIONS = [
  { key:"carousel1", cats:[6,134,274,135], limit:16 },
  { key:"carousel2", cats:[257,143,348,281,272], limit:16 },
  { key:"carousel3", cats:[48,402,82,80,18], limit:16 },
  { key:"carousel4", cats:[241,142,389,306,313], limit:16 },
  { key:"carousel5", cats:[130,252,56,140,285], limit:16 },
  { key:"carousel6", cats:[117,236,42,41], limit:16 },
  { key:"carousel7", cats:[54,55,401], limit:16 },
  { key:"carousel8", cats:[28,27,320,428,321,322,325,373,58,234,319,77,69], limit:16 },
  { key:"carousel9", cats:[422,423,412,414,415,418,419,416,420], limit:16 },
  { key:"carousel10", cats:[20,21,29,14,359,75,52], limit:16 },
  { key:"carousel11", cats:[66,123,68,79,124], limit:16 },
  { key:"carousel12", cats:[237,316,32,33], limit:16 }
];

async function preloadHomepageCache() {
  console.log("Preloading homepage cache...");

  for (const section of HOMEPAGE_SECTIONS) {
    try {
      const cacheKey = `section_html_${section.cats.join("_")}_${section.limit}`;
      const products = await buildHomepageSection(section.cats.map(String), section.limit);

      cache.set(cacheKey, {
        products,
        createdAt: Date.now(),
        refreshing: false
      });

      console.log(`Cached ${section.key}: ${products.length} products`);
    } catch (err) {
      console.error(`Failed caching ${section.key}:`, err.message);
    }
  }

  console.log("Homepage cache preload finished");
}

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  await preloadHomepageCache();

  setInterval(() => {
    preloadHomepageCache();
  }, 5 * 60 * 1000);
});
