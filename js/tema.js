// Troca de tema (claro/escuro). O tema inicial é aplicado por js/tema-inicial.js.
import { icone } from "./icones.js";

const CHAVE = "fatesck-tema";
export const temaAtual = () => document.documentElement.getAttribute("data-tema") === "escuro" ? "escuro" : "claro";

export function definirTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  try { localStorage.setItem(CHAVE, tema); } catch (e) { /* sem armazenamento: vale só nesta página */ }
  atualizarBotoes();
}

// Botões de tema: mostram sol (no escuro) ou lua (no claro), com rótulo acessível.
const botoes = new Set();
function atualizarBotoes() {
  const escuro = temaAtual() === "escuro";
  for (const b of botoes) {
    b.innerHTML = icone(escuro ? "sol" : "lua");
    b.setAttribute("aria-label", escuro ? "Usar tema claro" : "Usar tema escuro");
    b.title = escuro ? "Tema claro" : "Tema escuro";
  }
}
export function ligarBotaoTema(botao) {
  botoes.add(botao);
  botao.addEventListener("click", () => definirTema(temaAtual() === "escuro" ? "claro" : "escuro"));
  atualizarBotoes();
}
