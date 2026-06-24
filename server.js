const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const NodeCache = require("node-cache");

const app = express();
app.use(cors());

const WEBSITE_URL = "https://www.mrphonelb.com";
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Mr Phone Homepage API Running"
  });
});

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
