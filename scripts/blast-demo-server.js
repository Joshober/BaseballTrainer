/**
 * Lightweight static server for the Blast Web Bluetooth demo.
 * Serves files from /public using Express so it can be launched with `node`.
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.BLAST_DEMO_PORT || 4100;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  next();
});

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  res.redirect('/blast-webbluetooth-demo.html');
});

app.listen(PORT, () => {
  console.log(`[blast-demo-server] Serving ${publicDir}`);
  console.log(`[blast-demo-server] Open http://localhost:${PORT}/blast-webbluetooth-demo.html`);
});


