// Registra o service worker (só guarda a "casca" do site: HTML, CSS, JS, imagens).
// Dados do Firestore NUNCA são guardados: o service worker ignora qualquer endereço de outro domínio.
// Basta importar este arquivo (ele se registra sozinho); a raiz do site é calculada a partir dele.
const raiz = new URL("../", import.meta.url);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("sw.js", raiz), { scope: raiz.pathname })
    .catch(e => console.warn("Service worker não registrado:", e));
}
