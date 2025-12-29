require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const axios = require('axios');
const {LRUCache} = require('lru-cache');

const app = express();
app.use(morgan('dev'));

//API key from .env; fail if not present
const OMDB_API_KEY = process.env.OMDB_API_KEY;
if (!OMDB_API_KEY) throw new Error("Missing OMDB_API_KEY in .env");

// LRU cache: limits size + auto-expires entries
const cache = new LRUCache({
  max: 69,                 // max number of cached responses
  ttl: 1000 * 60 * 60 * 12,      // 12 hours (ms)
});

// // cache: { cacheKey: { data, timestamp } }
// const cache = {};
// const ONE_HOUR_MS = 60 * 60 * 1000;
//changed to use LRUCache

// build cache key (/?i=... and /?t=...)
function buildCacheKey({ i, t }) {
  if (i) return `i:${String(i).trim()}`;
  if (t) return `t:${String(t).trim().toLowerCase()}`;
  return null;
}

async function fetchFromOmdb({ i, t }) {
  const params = { apikey: OMDB_API_KEY };

  if (i) params.i = String(i).trim();
  if (t) params.t = String(t).trim();

  const { data } = await axios.get("https://www.omdbapi.com/", { params });

  // OMDb signals errors
  if (data?.Response === "False") {
    const err = new Error(data?.Error || "OMDb error");
    err.status = 404;
    err.payload = data;
    throw err;
  }

  return data;
}

// Main route: proxy OMDb with cache
app.get("/", async (req, res) => {
  try {
    const { i, t } = req.query;

    // Validate query
    if (!i && !t) {
      return res.status(400).json({ error: "You must provide either ?i or ?t" });
    }

    const key = buildCacheKey({ i, t });
    const cached = cache.get(key);
    if (cached) return res.json(cached);

    const data = await fetchFromOmdb({ i, t });
    cache.set(key, data); // ttl handled by LRUCache

    return res.json(data);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json(err.payload || { error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = app;