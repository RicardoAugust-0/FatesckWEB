// Service worker mínimo do Fatesck: guarda só a "casca" do site (HTML, CSS, JS, imagens) para abrir rápido
// e mostrar algo sem internet. NUNCA guarda dados do Firestore nem nada de outro domínio.
// Estratégia "rede primeiro": sempre tenta a versão nova; o cache só é usado quando não há conexão.
const VERSAO = "fatesck-casca-v2";
const CASCA = [
  "./", "./inicio/index.html", "./inicio/script.js",
  "./login_aluno/index.html", "./login_aluno/script.js", "./login_professor/index.html", "./login_professor/script.js",
  "./verificar_email/index.html", "./verificar_email/script.js", "./aguardando_liberacao/index.html", "./aguardando_liberacao/script.js",
  "./css/base.css", "./js/core/tema-inicial.js", "./js/core/tema.js", "./js/core/pwa.js", "./js/ui/ui.js", "./js/ui/icones.js", "./js/utils/datas.js",
  "./js/core/auth.js", "./js/core/firebase.js", "./js/core/config-demo.js", "./js/core/app.js", "./js/ui/componentes.js", "./js/utils/prazos.js", "./js/servicos/dados.js",
  "./midia/logo.png", "./midia/icones/icone-192.png", "./manifest.webmanifest"
];

self.addEventListener("install", evento => {
  evento.waitUntil(caches.open(VERSAO).then(cache =>
    Promise.all(CASCA.map(url => cache.add(url).catch(() => null))) // um arquivo faltando não impede a instalação
  ).then(() => self.skipWaiting()));
});

self.addEventListener("activate", evento => {
  evento.waitUntil(caches.keys().then(chaves =>
    Promise.all(chaves.filter(c => c !== VERSAO).map(c => caches.delete(c)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", evento => {
  const req = evento.request;
  const url = new URL(req.url);
  // Só GET do próprio site. Firestore, Firebase Auth, fontes e SDK (outros domínios) passam direto, sem cache.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  evento.respondWith(
    fetch(req).then(resposta => {
      if (resposta.ok && resposta.type === "basic") {
        const copia = resposta.clone();
        caches.open(VERSAO).then(cache => cache.put(req, copia));
      }
      return resposta;
    }).catch(async () => {
      const guardada = await caches.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      if (req.mode === "navigate") return caches.match("./inicio/index.html");
      return Response.error();
    })
  );
});
