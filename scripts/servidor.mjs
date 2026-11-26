// Servidor estático mínimo para desenvolvimento (só responde em 127.0.0.1).
// Serve a pasta do projeto, sem cache, para o site poder ser aberto junto com os emuladores.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { HOST, PORTA_SITE } from "./config.mjs";

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8"
};
// Pastas que não fazem parte do site
const FORA_DO_SITE = ["node_modules", "scripts", "tests"];

export function iniciarServidor(raiz) {
  const servidor = createServer(async (req, res) => {
    try {
      const caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const partes = caminho.split("/").filter(Boolean);
      let arquivo = normalize(join(raiz, ...partes));
      const fora = !(arquivo + sep).startsWith(raiz + sep) || partes.some(p => p.startsWith(".")) || FORA_DO_SITE.includes(partes[0]);
      if (fora) { res.writeHead(404).end("Não encontrado"); return; }
      let info = await stat(arquivo).catch(() => null);
      if (info?.isDirectory()) {
        if (!caminho.endsWith("/")) { res.writeHead(302, { Location: caminho + "/" }).end(); return; }
        arquivo = join(arquivo, "index.html");
        info = await stat(arquivo).catch(() => null);
      }
      if (!info?.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado"); return; }
      const corpo = await readFile(arquivo);
      res.writeHead(200, { "Content-Type": TIPOS[extname(arquivo).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : corpo);
    } catch (e) {
      console.error(e);
      res.writeHead(500).end("Erro no servidor local");
    }
  });
  return new Promise((ok, falha) => {
    servidor.once("error", falha);
    servidor.listen(PORTA_SITE, HOST, () => ok(servidor));
  });
}
