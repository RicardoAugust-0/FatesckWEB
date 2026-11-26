// Gera as páginas internas (inicial_aluno/*, inicial_professor/*) e atualiza o <head> das páginas de entrada.
// Uso: node scripts/gerar-paginas.cjs   (roda na raiz do projeto)
const fs = require("fs"), path = require("path");
const raiz = process.argv[2] || path.join(__dirname, "..", "public");
const cabeca = (base, titulo) => `    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="theme-color" content="#A61C24">
    <title>${titulo}</title>
    <link rel="manifest" href="${base}/manifest.webmanifest">
    <link rel="icon" type="image/png" href="${base}/midia/icones/icone-192.png">
    <link rel="apple-touch-icon" href="${base}/midia/icones/apple-touch-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="${base}/css/base.css">
    <script src="${base}/js/core/tema-inicial.js"></script>`;

// ---- páginas internas ----
const PAGINAS = { aluno: ["inicio", "turmas", "turma", "atividades", "notas", "chat", "avisos"], professor: ["inicio", "turmas", "turma", "atividades", "notas", "chat", "avisos"] };
for (const [perfil, paginas] of Object.entries(PAGINAS)) {
  for (const p of paginas) {
    const dir = p === "inicio" ? path.join(raiz, "inicial_" + perfil) : path.join(raiz, "inicial_" + perfil, p);
    const base = p === "inicio" ? ".." : "../..";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${cabeca(base, "Fatesck")}
</head>
<body data-perfil="${perfil}" data-pagina="${p}" data-base="${base}">
    <noscript>O Fatesck precisa de JavaScript ativado.</noscript>
    <script type="module" src="${base}/js/core/app.js"></script>
</body>
</html>
`);
    console.log("página:", path.relative(raiz, path.join(dir, "index.html")));
  }
}

// ---- páginas de entrada: troca o <head> antigo pelo novo e registra o PWA ----
for (const p of ["inicio", "login_aluno", "login_professor", "verificar_email", "aguardando_liberacao", "admin"]) {
  const arq = path.join(raiz, p, "index.html");
  let html = fs.readFileSync(arq, "utf8");
  const titulo = html.match(/<title>([^<]*)<\/title>/)[1];
  html = html.replace(/<head>[\s\S]*?<\/head>/, `<head>\n${cabeca("..", titulo)}\n    <script type="module" src="../js/core/pwa.js"></script>\n</head>`);
  fs.writeFileSync(arq, html);
  console.log("cabeçalho atualizado:", path.relative(raiz, arq));
}
