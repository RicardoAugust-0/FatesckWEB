// Utilitários de tela: montar elementos sem innerHTML (evita injeção de HTML/script com dados do banco),
// avisos rápidos (toast) que somem sozinhos e esqueletos de carregamento.

import { iconeEl } from "./icones.js";

// el("p", { class: "mudo" }, "texto", outroElemento)
// Atributos "on*" recebem funções (ex.: { onclick: () => ... }). Textos viram textContent (nunca HTML).
export function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props ?? {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (chave.startsWith("on") && typeof valor === "function") no.addEventListener(chave.slice(2), valor);
    else if (chave === "class") no.className = valor;
    else if (chave === "style" && typeof valor === "object") Object.assign(no.style, valor);
    else if (valor === true) no.setAttribute(chave, "");
    else no.setAttribute(chave, String(valor));
  }
  for (const f of filhos.flat()) {
    if (f === undefined || f === null || f === false) continue;
    no.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return no;
}

// Escreve uma mensagem num elemento (erro ou sucesso). Texto vazio limpa.
export function mensagem(alvo, texto = "") {
  if (alvo) alvo.textContent = texto;
}

// Escapa texto para os poucos lugares que montam HTML em string. Testado em tests/ui.test.mjs.
export const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- toast: mensagem discreta que some sozinha (substitui o alert) ----------
let caixaToasts = null;
export function toast(texto, { tipo = "info", duracao = 4500 } = {}) {
  if (!caixaToasts) {
    caixaToasts = el("div", { class: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(caixaToasts);
  }
  const t = el("div", { class: "toast" + (tipo === "erro" ? " erro-toast" : "") }, texto);
  caixaToasts.append(t);
  setTimeout(() => t.remove(), duracao);
  return t;
}

// ---------- janela por cima (no celular sobe de baixo) ----------
// abrirJanela({ titulo, conteudo: [nós], acoes: [nós] }) -> { fechar, caixa }
// classe: "grande" para janelas largas. podeFechar(): se devolver false, a janela continua aberta (ex.: notas não salvas).
export function abrirJanela({ titulo, conteudo = [], acoes = [], aoFechar, classe = "", podeFechar }) {
  const anterior = document.activeElement;
  const idTitulo = "jt-" + Math.random().toString(36).slice(2);
  const botaoX = el("button", { type: "button", class: "janela-x", "aria-label": "Fechar" }, "✕");
  const caixa = el("div", { class: ("janela " + classe).trim(), role: "dialog", "aria-modal": "true", "aria-labelledby": idTitulo },
    el("div", { class: "janela-cabeca" }, el("h2", { id: idTitulo }, titulo), botaoX),
    el("div", { class: "janela-corpo" }, ...[].concat(conteudo)),
    acoes.length ? el("div", { class: "janela-acoes" }, ...acoes) : null);
  const fundo = el("div", { class: "janela-fundo" }, caixa);
  let fechada = false;
  function fechar({ forcar = false } = {}) {
    if (fechada) return;
    if (!forcar && podeFechar && podeFechar() === false) return;
    fechada = true;
    document.removeEventListener("keydown", teclas);
    fundo.remove();
    document.body.classList.remove("com-janela");
    anterior?.focus?.();
    aoFechar?.();
  }
  function teclas(e) {
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
    if (e.key === "Tab") { // mantém o foco dentro da janela
      const focaveis = [...caixa.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(n => !n.disabled && n.offsetParent);
      if (!focaveis.length) return;
      const [primeiro, ultimo] = [focaveis[0], focaveis[focaveis.length - 1]];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  }
  botaoX.addEventListener("click", fechar);
  fundo.addEventListener("mousedown", e => { if (e.target === fundo) fechar(); });
  document.addEventListener("keydown", teclas);
  document.body.append(fundo);
  document.body.classList.add("com-janela");
  (caixa.querySelector("input, select, textarea") || caixa.querySelector(".janela-acoes .botao") || botaoX).focus();
  return { fechar, caixa };
}

// ---------- menu suspenso (⋯) ----------
// abrirMenu(botao, [{ texto, icone (nó), acao }, "separador"])
let menuAberto = null;
export function abrirMenu(botao, itens) {
  if (menuAberto) { const mesmo = menuAberto.botao === botao; menuAberto.fechar(); if (mesmo) return; }
  const lista = el("div", { class: "menu-suspenso", role: "menu" }, itens.map(i => i === "separador"
    ? el("hr", { class: "menu-separador" })
    : el("button", { type: "button", role: "menuitem", class: "menu-item", onclick: () => { fechar(); i.acao(); } }, i.icone || null, el("span", {}, i.texto))));
  document.body.append(lista);
  const r = botao.getBoundingClientRect();
  const largura = lista.offsetWidth;
  lista.style.top = `${window.scrollY + r.bottom + 6}px`;
  lista.style.left = `${Math.max(8, Math.min(window.scrollX + r.right - largura, window.scrollX + document.documentElement.clientWidth - largura - 8))}px`;
  botao.setAttribute("aria-expanded", "true");
  const fora = e => { if (!lista.contains(e.target) && e.target !== botao && !botao.contains(e.target)) fechar(); };
  const tecla = e => { if (e.key === "Escape") { fechar(); botao.focus(); } };
  setTimeout(() => { document.addEventListener("mousedown", fora); document.addEventListener("keydown", tecla); });
  function fechar() {
    lista.remove();
    botao.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", fora);
    document.removeEventListener("keydown", tecla);
    if (menuAberto?.botao === botao) menuAberto = null;
  }
  menuAberto = { botao, fechar };
  lista.querySelector(".menu-item")?.focus();
}

// Pergunta de confirmação numa janela. Devolve true/false.
export function confirmar(titulo, texto, rotulo) {
  return new Promise(resolver => {
    const ok = el("button", { type: "button", class: "botao" }, rotulo);
    const j = abrirJanela({ titulo, conteudo: [].concat(texto).map(t => t instanceof Node ? t : el("p", {}, t)), aoFechar: () => resolver(false),
      acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
    ok.addEventListener("click", () => { resolver(true); j.fechar(); });
  });
}

// Lê/grava no localStorage sem quebrar quando o navegador bloqueia (modo privado etc.).
export const guardado = {
  ler(chave) { try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch { return null; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem espaço ou bloqueado */ } },
  apagar(chave) { try { localStorage.removeItem(chave); } catch { /* idem */ } }
};

// Botão de "olho" dentro do campo de senha: mostra/oculta o que foi digitado.
export function ligarMostrarSenha(input) {
  if (!input || input.dataset.olho) return;
  input.dataset.olho = "1";
  const botao = el("button", { type: "button", class: "olho-senha", "aria-label": "Mostrar senha", "aria-pressed": "false", title: "Mostrar senha" });
  const desenhar = visivel => {
    botao.replaceChildren(iconeEl(visivel ? "olhoFechado" : "olho"));
    const texto = visivel ? "Ocultar senha" : "Mostrar senha";
    botao.setAttribute("aria-label", texto); botao.title = texto;
    botao.setAttribute("aria-pressed", String(visivel));
  };
  botao.addEventListener("click", () => {
    const visivel = input.type === "password";
    input.type = visivel ? "text" : "password";
    desenhar(visivel);
    input.focus();
  });
  desenhar(false);
  const caixa = el("div", { class: "caixa-senha" });
  input.replaceWith(caixa);
  caixa.append(input, botao);
}

// Copia texto e avisa com um toast.
export async function copiar(texto, aviso = "Copiado!") {
  try { await navigator.clipboard.writeText(texto); toast(aviso); }
  catch { toast("Não foi possível copiar automaticamente. Selecione e copie: " + texto, { duracao: 8000 }); }
}

// ---------- esqueletos de carregamento ----------
export const esqueletoLinhas = (n = 3) =>
  Array.from({ length: n }, () => el("div", { class: "linha", "aria-hidden": "true" },
    el("div", { style: { flex: "1" } }, el("div", { class: "esqueleto esq-titulo" }), el("div", { class: "esqueleto esq-linha", style: { width: "40%" } }))));
export const esqueletoTurmas = (n = 4) =>
  Array.from({ length: n }, () => el("div", { class: "esqueleto esq-turma", "aria-hidden": "true" }));
