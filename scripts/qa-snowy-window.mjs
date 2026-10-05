import { build } from "esbuild";
import { createServer } from "node:http";
const { outputFiles } = await build({ entryPoints: ["scripts/qa-snowy-window.ts"], bundle: true, write: false, format: "esm" });
const html = `<!doctype html><meta charset="utf-8"><title>Snowy window visual check</title>
<style>body{margin:24px;background:#172129;color:#dcecf4;font:15px system-ui}main{display:flex;gap:28px}#glass{width:360px;height:640px;background:linear-gradient(20deg,transparent 45%,#23372f 46%,#507667 58%,transparent 59%),linear-gradient(155deg,transparent 35%,#576d7c 36%,#becbd1 57%,transparent 58%),linear-gradient(#87b5d0,#e9d6ba);position:relative}#glass:before{content:'WINTER';position:absolute;top:180px;left:30px;font-size:68px;font-weight:700;color:#263e50}canvas{position:relative}button{display:block;margin:12px 0;padding:12px;width:180px}p{max-width:290px;line-height:1.5}</style>
<main><div id="glass"></div><aside><h2>Wipe → freeze</h2><p>Drag across the glass, then release and watch it freeze. Or replay a repeatable palm stroke.</p><strong id="time"></strong><button id="palm">Try palm wipe</button><button id="finger">Try fingertip wipe</button><button id="play">Replay</button><button data-time="0">Initial glass</button><button data-time="1">Wiped</button><button data-time="3.5">New freezing</button><button data-time="5">Growing</button><button data-time="8">Settled</button></aside></main><script type="module" src="/qa.js"></script>`;
createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/qa.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/qa.js" ? outputFiles[0].text : html);
}).listen(5179, "127.0.0.1", () => console.log("Frost visual fixture: http://127.0.0.1:5179"));
