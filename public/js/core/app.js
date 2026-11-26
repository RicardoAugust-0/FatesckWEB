// Moldura das páginas internas (aluno e professor):
//  - computador/tablet: menu lateral de 248px (topo vermelho com logo e usuário, itens, rodapé com Sair e tema);
//  - celular (até 520px): cabeçalho vermelho (logo, Avisos, Sair, avatar) + barra fixa embaixo + tema flutuante.
// Cada página tem seu módulo em js/paginas/{perfil}-{pagina}.js; as que ainda não existem mostram "em construção".
import { exigirPerfil, sair } from "./auth.js";
import { el, toast } from "../ui/ui.js";
import { icone, iconeEl } from "../ui/icones.js";
import { ligarBotaoTema } from "./tema.js";
import "./pwa.js"; // registra o service worker (PWA)
import { calcularContadores } from "../servicos/contadores.js";

const corpo = document.body;
const perfil = corpo.dataset.perfil, pagina = corpo.dataset.pagina, base = corpo.dataset.base;
// A página de uma turma ("turma") fica marcada como "Turmas" no menu.
const paginaMenu = pagina === "turma" ? "turmas" : pagina;

const MENUS = {
  aluno: [["inicio", "Início"], ["turmas", "Turmas"], ["atividades", "Atividades"], ["notas", "Notas"], ["chat", "Chat"], ["avisos", "Avisos"]],
  professor: [["inicio", "Início"], ["turmas", "Minhas turmas"], ["atividades", "Atividades"], ["notas", "Notas"], ["chat", "Chat"], ["avisos", "Avisos"]]
};
const BARRA_MOVEL = [["inicio", "Início", "inicio"], ["turmas", "Turmas", "turmas"], ["atividades", "Tarefas", "atividades"], ["chat", "Chat", "chat"], ["notas", "Notas", "notas"]];
// Páginas que já existem (as outras chegam nas próximas fases)
const PRONTAS = { aluno: ["inicio", "turmas", "turma", "atividades", "notas", "chat", "avisos"], professor: ["inicio", "turmas", "turma", "atividades", "notas", "chat", "avisos"] };
const FASE_DA_PAGINA = { turmas: 4, atividades: 5, notas: 6, chat: 7, avisos: 7 };

const dir = base + "/inicial_" + perfil;
const href = k => k === "inicio" ? dir + "/index.html" : dir + "/" + k + "/index.html";
const iniciais = nome => (nome || "?").trim().split(/\s+/).filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join("").toUpperCase();

const sessao = await exigirPerfil(perfil, base);
if (sessao) await montar();

async function montar() {
  const titulo = (MENUS[perfil].find(m => m[0] === paginaMenu) || [0, "Início"])[1];
  document.title = "Fatesck - " + titulo;
  const contadores = {}; // chave -> elementos .contador

  // ----- menu lateral -----
  const itemMenu = ([chave, rotulo]) => {
    const c = el("span", { class: "contador", hidden: true });
    (contadores[chave] ||= []).push(c);
    const a = el("a", { class: "item", href: href(chave), "aria-current": chave === paginaMenu ? "page" : null }, iconeEl(chave), el("span", {}, rotulo), c);
    return a;
  };
  const botaoTema = el("button", { type: "button", class: "tema-botao" });
  const lateral = el("aside", { class: "lateral", "aria-label": "Menu principal" },
    el("div", { class: "lateral-topo" },
      el("a", { class: "placa-logo", href: href("inicio"), "aria-label": "Fatesck — início" }, el("img", { src: base + "/midia/logo.png", alt: "Fatesck" })),
      el("div", { class: "usuario" },
        el("span", { class: "avatar", "aria-hidden": "true" }, iniciais(sessao.nome)),
        el("div", {}, el("b", {}, sessao.nome), el("span", {}, perfil === "aluno" ? "Aluno" : "Professor")))),
    el("nav", { class: "menu" }, MENUS[perfil].map(itemMenu)),
    el("div", { class: "lateral-rodape" },
      el("button", { type: "button", class: "sair", onclick: () => sair(base) }, iconeEl("sair"), "Sair"),
      botaoTema));

  // ----- celular: cabeçalho vermelho, barra embaixo, tema flutuante -----
  const tituloMovel = el("h1", {}, titulo), subtituloMovel = el("p", { hidden: true });
  const contadorAvisosMovel = el("span", { class: "contador", hidden: true });
  (contadores.avisos ||= []).push(contadorAvisosMovel);
  const topoMovel = el("header", { class: "topo-movel" },
    el("div", { class: "topo-movel-linha" },
      el("a", { class: "placa-logo", href: href("inicio"), "aria-label": "Fatesck — início" }, el("img", { src: base + "/midia/logo.png", alt: "Fatesck" })),
      el("div", { class: "topo-movel-acoes" },
        el("a", { class: "icone-topo", href: href("avisos"), "aria-label": "Avisos" }, iconeEl("sino"), contadorAvisosMovel),
        el("button", { type: "button", class: "icone-topo", "aria-label": "Sair", onclick: () => sair(base) }, iconeEl("sair")),
        el("span", { class: "avatar", title: sessao.nome, "aria-hidden": "true" }, iniciais(sessao.nome)))),
    el("div", {}, tituloMovel, subtituloMovel));
  const barraMovel = el("nav", { class: "barra-movel", "aria-label": "Menu principal" },
    BARRA_MOVEL.map(([chave, rotulo, ic]) => {
      const c = el("span", { class: "contador", hidden: true });
      (contadores[chave] ||= []).push(c);
      return el("a", { href: href(chave), "aria-current": chave === paginaMenu ? "page" : null }, iconeEl(ic), el("span", {}, rotulo), c);
    }));
  const temaFlutuante = el("button", { type: "button", class: "tema-flutuante" });

  const conteudo = el("main", { class: "conteudo", id: "conteudo" });
  corpo.replaceChildren(
    el("a", { class: "sr-only", href: "#conteudo" }, "Pular para o conteúdo"),
    el("div", { class: "app" }, lateral, el("div", {}, topoMovel, conteudo)),
    barraMovel, temaFlutuante);
  ligarBotaoTema(botaoTema);
  ligarBotaoTema(temaFlutuante);

  const ctx = {
    sessao, base, perfil, conteudo, href,
    definirCabecalhoMovel(t, sub) {
      tituloMovel.textContent = t;
      subtituloMovel.textContent = sub || "";
      subtituloMovel.hidden = !sub;
    },
    definirContador(chave, n) {
      for (const c of contadores[chave] || []) { c.textContent = n > 99 ? "99+" : String(n); c.hidden = !n; c.setAttribute("aria-label", `${n} novos`); }
    },
    // A página cuida sozinha deste número, em tempo real (ex.: Chat): o cálculo geral não mexe mais nele.
    contadorAoVivo(chave) { aoVivo.add(chave); },
    // Recalcula os números do menu (ex.: depois de ler o chat de uma turma). Um cálculo por vez, em fila,
    // para um resultado antigo nunca passar por cima de um mais novo.
    atualizarContadores() {
      fila = fila.then(() => calcularContadores(sessao, perfil))
        .then(c => { for (const k of ["atividades", "avisos", "chat"]) if (!aoVivo.has(k)) ctx.definirContador(k, c[k]); })
        .catch(e => console.warn("Contadores do menu indisponíveis.", e));
      return fila;
    }
  };
  const aoVivo = new Set();
  let fila = Promise.resolve();

  if (!PRONTAS[perfil].includes(pagina)) emConstrucao(conteudo, titulo);
  else {
    try {
      const modulo = await import(pagina === "turma" ? "../paginas/turma.js" : `../paginas/${perfil}-${pagina}.js`);
      await modulo.montar(ctx);
    } catch (e) {
      console.error(e);
      conteudo.replaceChildren(el("div", { class: "card" }, el("div", { class: "vazio" }, "Não foi possível carregar esta página. Verifique sua conexão e tente de novo.")));
      toast("Não foi possível carregar os dados.", { tipo: "erro" });
    }
  }

  // Números do menu em todas as páginas (o Início já calcula os dele). Depois da página montar,
  // para já contar o que ela acabou de marcar como visto. Falha aqui não atrapalha a página.
  if (pagina !== "inicio") ctx.atualizarContadores();

  // evita voltar do cache do navegador para a área interna depois de sair
  window.addEventListener("pageshow", e => { if (e.persisted) location.reload(); });
}

function emConstrucao(conteudo, titulo) {
  const fase = FASE_DA_PAGINA[pagina];
  conteudo.replaceChildren(
    el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, titulo),
    el("div", { class: "card" },
      el("div", { class: "em-construcao" },
        el("b", {}, "Esta página está sendo construída"),
        el("span", {}, fase ? `Ela chega na Fase ${fase} do projeto.` : "Ela chega nas próximas fases do projeto."))));
}

void icone;
