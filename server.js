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

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

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

app.get("/api/homepage-section", async (req, res) => {
  try {
    const cats = String(req.query.cats || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    const limit = Number(req.query.limit || 12);

    if (!cats.length) {
      return res.status(400).json({
        error: true,
        message: "Missing cats parameter"
      });
    }

    const cacheKey = `section_${cats.join("_")}_${limit}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({ cached: true, products: cached });
    }

    let allProducts = [];

    for (const catId of cats) {
      const products = await fetchDaftraProductsByCategory(catId, 20);
      allProducts = allProducts.concat(products);
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
      .slice(0, limit);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
