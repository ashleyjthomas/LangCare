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
    const want = {
      gender: url.searchParams.get("gender") || "",
      ethnicity: url.searchParams.get("ethnicity") || "",
      relation: url.searchParams.get("relation") || "",
    };
    let pool = readBank().filter((e) => e.pid !== exclude);
    // Prefer photos matching on gender+ethnicity+relation; relax to gender+ethnicity,
    // then gender, then anything — so it matches "when possible".
    const tryFilters = [
      (e) => e.gender === want.gender && e.ethnicity === want.ethnicity && e.relation === want.relation,
      (e) => e.gender === want.gender && e.ethnicity === want.ethnicity,
      (e) => e.gender === want.gender,
      () => true,
    ];
    let chosen = null, matchedOn = "none";
    const labels = ["gender+ethnicity+relation", "gender+ethnicity", "gender", "any"];
    for (let i = 0; i < tryFilters.length; i++) {
      const m = pool.filter(tryFilters[i]);
      if (m.length) { chosen = m[Math.floor(Math.random() * m.length)]; matchedOn = labels[i]; break; }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ photo: chosen ? chosen.photo : null, matchedOn }));
  }

  if (req.method === "POST" && url.pathname === "/bank") {
    const raw = await body(req);
    try {
      const { pid, photo, gender, ethnicity, relation } = JSON.parse(raw);
      if (pid && photo) { const b = readBank(); b.push({ pid, photo, gender: gender || "", ethnicity: ethnicity || "", relation: relation || "" }); writeBank(b); }
    } catch {}
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  res.writeHead(404); res.end("not found");
}).listen(8080, () => console.log("LANG-CARE server on http://localhost:8080"));
