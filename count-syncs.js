#!/usr/bin/env node
const https = require('https');

const baseUrl = 'https://w6dfsk7t.us-east.insforge.app';
const apiKey = process.env.INSFORGE_API_KEY || 'ik_92971e8aa30996093f3f84fe2e498c82';

async function query(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const options = {
      hostname: 'w6dfsk7t.us-east.insforge.app',
      port: 443,
      path: '/api/query',
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    const result = await query('SELECT COUNT(*) as total_syncs, MAX(synced_at) as last_sync FROM stock_syncs');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
