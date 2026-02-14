#!/usr/bin/env node
/**
 * TaxStack Tally Connector
 *
 * A tiny local proxy that enables Push to Tally from the web app.
 * Runs on the customer's PC alongside Tally.
 *
 * Usage: node tally-connector.js
 *
 * This bridges: Browser (Vercel app) → localhost:7777 → Tally (localhost:9000)
 */

const http = require('http');
const PORT = 7777;
const TALLY_URL = process.argv[2] || 'http://localhost:9000';

const server = http.createServer((req, res) => {
  // CORS headers — allow browser requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only POST allowed' }));
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const parsed = new URL(TALLY_URL);

    // Forward to Tally
    const tallyReq = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 9000,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    }, (tallyRes) => {
      let tallyData = '';
      tallyRes.on('data', chunk => tallyData += chunk);
      tallyRes.on('end', () => {
        // Check for actual errors — <LINEERROR> means real error, <ERRORS>0</ERRORS> means success
        const hasLineError = tallyData.includes('<LINEERROR>');
        const errorsMatch = tallyData.match(/<ERRORS>(\d+)<\/ERRORS>/);
        const errorCount = errorsMatch ? parseInt(errorsMatch[1]) : 0;
        const hasError = hasLineError || errorCount > 0;

        // Extract created/altered counts
        const createdMatch = tallyData.match(/<CREATED>(\d+)<\/CREATED>/);
        const created = createdMatch ? parseInt(createdMatch[1]) : 0;

        let message;
        if (hasError) {
          const lineErr = tallyData.match(/<LINEERROR>(.*?)<\/LINEERROR>/);
          message = lineErr ? `Tally error: ${lineErr[1]}` : `Tally reported ${errorCount} error(s)`;
        } else {
          message = `Imported successfully! ${created} record(s) created.`;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: !hasError,
          message,
          tallyResponse: tallyData
        }));
        console.log(hasError ? `  ✗ ${message}` : `  ✓ ${message}`);
      });
    });

    tallyReq.on('error', (err) => {
      const msg = err.code === 'ECONNREFUSED'
        ? 'Cannot connect to Tally. Is Tally running with XML Server enabled?'
        : err.message;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg }));
      console.log('  ✗ Error:', msg);
    });

    tallyReq.on('timeout', () => {
      tallyReq.destroy();
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tally connection timed out' }));
    });

    tallyReq.write(body);
    tallyReq.end();
    console.log(`→ Forwarding ${body.length} bytes to Tally...`);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     TaxStack Tally Connector v1.0        ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Proxy:  http://localhost:${PORT}            ║`);
  console.log(`  ║  Tally:  ${TALLY_URL.padEnd(31)}║`);
  console.log('  ║                                          ║');
  console.log('  ║  Ready! Keep this window open while      ║');
  console.log('  ║  using TaxStack Push to Tally feature.   ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
