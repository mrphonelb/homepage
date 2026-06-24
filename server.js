const express = require("express");
const cors = require("cors");
const axios = require("axios");
const NodeCache = require("node-cache");

const app = express();
app.use(cors());

const DAFTRA_API_URL = process.env.DAFTRA_API_URL || "https://www.mrphonelb.com/api2";
const DAFTRA_API_TOKEN = process.env.DAFTRA_API_TOKEN;

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Mr Phone Homepage API Running"
  });
});

app.get("/api/homepage/mobiles", async (req, res) => {
  try {
    const cacheKey = "homepage_mobiles";
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({ cached: true, products: cached });
    }

    const response = await axios.get(`${DAFTRA_API_URL}/products`, {
    headers: {
  apikey: DAFTRA_API_TOKEN
},
      params: {
        cat_id: 87,
        limit: 12
      }
    });

    const products = response.data;

    cache.set(cacheKey, products);

    res.json({
      cached: false,
      products
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
