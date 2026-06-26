/* Minimal dependency-free Node server for LANG-CARE (async).
   Handles two things the front end needs:
     POST /save          -> writes finished participant data to data/
     GET  /bank?exclude= -> returns one consented "stranger" photo
     POST /bank          -> adds a consented photo to the bank
   This is a reference/dev stub. For real deployment, put data on
   Harvard-managed storage per IRB23-0780 and add auth/HTTPS.

   Run:  node server/server.js   (serves on http://localhost:8080)
   Then in experiment.js CONFIG set:
     SAVE_URL: "http://localhost:8080/save"
     STRANGER_BANK: "http://localhost:8080/bank"
*/
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const BANK_FILE = path.join(DATA_DIR, "stranger_bank.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
const readBank = () => { try { return JSON.parse(fs.readFileSync(BANK_FILE)); } catch { return []; } };
const writeBank = (b) => fs.writeFileSync(BANK_FILE, JSON.stringify(b));

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
const body = (req) => new Promise((resolve) => {
  let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d));
});

http.createServer(async (req, res) => {
  cors(res);
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (req.method === "POST" && url.pathname === "/save") {
    const raw = await body(req);
    let pid = "unknown";
    try { pid = JSON.parse(raw).pid || pid; } catch {}
    fs.writeFileSync(path.join(DATA_DIR, `langcare_${pid}.json`), raw);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "GET" && url.pathname === "/bank") {
    const exclude = url.searchParams.get("exclude");
    const bank = readBank().filter((e) => e.pid !== exclude);
    const pick = bank.length ? bank[Math.floor(Math.random() * bank.length)] : null;
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ photo: pick ? pick.photo : null }));
  }

  if (req.method === "POST" && url.pathname === "/bank") {
    const raw = await body(req);
    try {
      const { pid, photo } = JSON.parse(raw);
      if (pid && photo) { const b = readBank(); b.push({ pid, photo }); writeBank(b); }
    } catch {}
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  res.writeHead(404); res.end("not found");
}).listen(8080, () => console.log("LANG-CARE server on http://localhost:8080"));
