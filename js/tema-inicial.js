// Aplica o tema ANTES de a página aparecer (evita "piscar" do claro para o escuro).
// Script clássico (não-módulo), carregado no <head> de todas as páginas.
// Primeira visita: segue o sistema (prefers-color-scheme). Depois: o que a pessoa escolheu (localStorage).
(function () {
  var tema = null;
  try { tema = localStorage.getItem("fatesck-tema"); } catch (e) { /* armazenamento bloqueado: segue o sistema */ }
  if (tema !== "claro" && tema !== "escuro") {
    tema = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  }
  document.documentElement.setAttribute("data-tema", tema);
})();
