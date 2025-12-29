require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const axios = require('axios');




const app = express();

app.use(morgan('dev'));

// app.get("/", (req, res) => {
//   res.status(200).send("Server is running");
// });



//API key from .env
const OMDB_API_KEY = process.env.OMDB_API_KEY;

// cache: { cacheKey: { data, timestamp } }
const cache = {};
const ONE_HOUR_MS = 1 * 60 * 60 * 1000;

// build cache key (so /?i=... and /?t=... are distinct)
function buildCacheKey(query) {
  if (query.i) return `i:${query.i}`;
  if (query.t) return `t:${query.t.toLowerCase()}`;
  return null;
}

// check if cached entry is still fresh
function isFresh(entry) {
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < ONE_HOUR_MS;
}

// main route: proxy to OMDb with caching
app.get('/', async (req, res) => {
  try {
    const { i, t } = req.query;

    if (!i && !t) {
      return res.status(400).json({ error: 'You must provide either ?i or ?t' });
    }

    const cacheKey = buildCacheKey(req.query);
    const cached = cache[cacheKey];

    // If fresh cache, return it without calling OMDb
    if (isFresh(cached)) {
      return res.json(cached.data);
    }

    // Otherwise, request from OMDb API using axios
    const omdbUrl = 'https://www.omdbapi.com/';
    const params = { apikey: OMDB_API_KEY };

    if (i) params.i = i;
    if (t) params.t = t;

    const response = await axios.get(omdbUrl, { params });
    const data = response.data;

    // OMDb returns { Response: "False", Error: "Movie not found!" } on errors
    if (data.Response === 'False') {
      return res.status(404).json(data);
    }

    // store in cache with current timestamp
    cache[cacheKey] = {
      data,
      timestamp: Date.now()
    };

    res.json(data);
  } 
  
    catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// When making calls to the OMDB API make sure to append the '&apikey=8730e0e' parameter

module.exports = app;