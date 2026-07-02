const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'urls.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`
      CREATE TABLE IF NOT EXISTS urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        short_code TEXT UNIQUE NOT NULL,
        long_url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        clicks INTEGER DEFAULT 0
      )
    `, (createErr) => {
      if (createErr) {
        console.error('Failed to create urls table:', createErr.message);
      } else {
        console.log('Database tables initialized.');
      }
    });
  }
});

// Helper function to generate a unique short code
function generateShortCode() {
  // Generates a 6-character random alphanumeric string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  return code;
}

// Helper to check if a short code already exists
function codeExists(code) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM urls WHERE short_code = ?', [code], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
}

// Generate an unused unique short code
async function getUniqueShortCode() {
  let code;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    code = generateShortCode();
    exists = await codeExists(code);
    attempts++;
  }
  if (exists) {
    throw new Error('Could not generate a unique short code after multiple attempts');
  }
  return code;
}

// Simple URL validation regex
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// API: Shorten a long URL
app.post('/api/shorten', async (req, res) => {
  let { longUrl } = req.body;

  if (!longUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  longUrl = longUrl.trim();

  // Add http:// protocol if not present
  if (!/^https?:\/\//i.test(longUrl)) {
    longUrl = 'http://' + longUrl;
  }

  if (!isValidUrl(longUrl)) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    // Check if the URL has already been shortened to reuse the shortcode
    db.get('SELECT short_code FROM urls WHERE long_url = ?', [longUrl], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error occurred' });
      }

      if (row) {
        return res.json({ shortCode: row.short_code });
      }

      // Generate a new code
      const shortCode = await getUniqueShortCode();

      // Insert into db
      db.run('INSERT INTO urls (short_code, long_url) VALUES (?, ?)', [shortCode, longUrl], (insertErr) => {
        if (insertErr) {
          return res.status(500).json({ error: 'Failed to save URL' });
        }
        res.json({ shortCode });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get analytics/list of shortened URLs
app.get('/api/urls', (req, res) => {
  db.all('SELECT short_code, long_url, created_at, clicks FROM urls ORDER BY created_at DESC LIMIT 50', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch URLs' });
    }
    res.json(rows);
  });
});

// Redirect Route: Access short URL
app.get('/:code', (req, res) => {
  const { code } = req.params;

  db.get('SELECT long_url, clicks FROM urls WHERE short_code = ?', [code], (err, row) => {
    if (err || !row) {
      return res.status(404).send('<h1>404 Link Not Found</h1><p>The shortened URL was not found.</p>');
    }

    // Increment click counter asynchronously
    db.run('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?', [code]);

    // Perform redirect
    res.redirect(row.long_url);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
