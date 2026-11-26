// Componentes visuais da prévia aprovada. Tudo é montado com el() (texto nunca vira HTML).
import { el } from "./ui.js";
import { iconeEl } from "./icones.js";
import { hojeExtenso, quando } from "./datas.js";

const CORES = ["#A61C24", "#3B4048", "#2455C6", "#1F7A66", "#C2570C", "#5B4BD5", "#7A1118", "#15171A"];
export const corDaTurma = c => CORES.includes(c) ? c : CORES[0];
// Faixa de 6px com a cor da turma à esquerda de um item de atividade (decisão do Fernando, opção A).
// A cor nunca é o único sinal: o nome da turma continua escrito no item.
// Preto e Grafite quase somem no tema escuro: ganham um contorno claro (só no escuro, via CSS).
const CORES_ESCURAS = ["#15171A", "#3B4048"];
export function comCorDaTurma(no, cor) {
  const c = corDaTurma(cor);
  no.classList.add("com-cor");
  no.style.setProperty("--cor-turma", c);
  if (CORES_ESCURAS.includes(c)) no.dataset.corEscura = "1";
  return no;
}
export const primeiroNome = nome => (nome || "").trim().split(/\s+/)[0] || "";

// Chip: { texto, classe = "chip", icone, curto } — "curto" é a versão menor usada no celular.
export const chip = ({ texto, classe = "chip", icone, curto }) => el("span", { class: classe },
  icone ? iconeEl(icone, "icone p") : null,
  curto ? [el("span", { class: "so-desktop" }, texto), el("span", { class: "so-movel" }, curto)] : texto);

// Banner vermelho com título, subtítulo, botão opcional e 3 blocos.
export function banner({ titulo, subtitulo = hojeExtenso(), acao, blocos = [] }) {
  const valores = blocos.map(() => el("b", {}, "–"));
  const no = el("section", { class: "banner", "aria-label": titulo },
    el("div", { class: "banner-topo" }, el("div", {}, el("h1", {}, titulo), el("p", {}, subtitulo)), acao || null),
    el("div", { class: "blocos" }, blocos.map((rotulo, i) => {
      const r = el("span", {}, rotulo);
      return el("div", { class: "bloco" }, valores[i], r);
    })));
  // atualizar(i, valor, rotulo?)
  no.atualizar = (i, valor, rotulo) => {
    valores[i].textContent = valor;
    if (rotulo) valores[i].nextSibling.textContent = rotulo;
  };
  return no;
}

// Botão branco do banner (ex.: "Entrar em uma turma")
export const botaoBanner = (texto, icone, props = {}) =>
  el(props.href ? "a" : "button", { class: "botao branco", type: props.href ? null : "button", ...props }, icone ? iconeEl(icone) : null, texto);

// Card com borda vermelha: cabeçalho com título de seção, corpo e rodapé opcionais.
export function card({ titulo, extra, corpo = [], rodape, classe = "" }) {
  const c = el("section", { class: "card " + classe, "aria-label": titulo },
    el("div", { class: "card-cabeca" }, el("h2", { class: "titulo-secao" }, titulo), extra || null),
    ...[].concat(corpo));
  if (rodape) c.append(rodape);
  return c;
}

// Cabeçalho de seção fora de card ("▍Minhas turmas ........ Ver todas")
export const cabecaSecao = (titulo, link) =>
  el("div", { class: "cabeca-secao" }, el("h2", { class: "titulo-secao" }, titulo), link || null);

// Card de turma (cabeça colorida, nome, subtítulo, chips). Com href, o card inteiro abre a turma.
// aoMais: menu ⋯ (opcional). classe: "arquivada" | "pedido". extra: nó abaixo dos chips (ex.: botão).
export function cardTurma({ turma, subtitulo, chips = [], href, aoMais, classe = "", extra }) {
  const capa = el("div", { class: "turma-capa" }, el("span", { class: "turma-icone" }, iconeEl("pessoas")));
  capa.style.background = corDaTurma(turma.cor);
  if (aoMais) capa.append(el("button", { type: "button", class: "turma-mais", "aria-label": `Opções da turma ${turma.nome}`, "aria-haspopup": "menu", onclick: aoMais }, iconeEl("mais")));
  return el("article", { class: ("turma " + classe).trim() },
    capa,
    el("div", { class: "turma-corpo" },
      el("h3", {}, href ? el("a", { href, class: "cobre" }, turma.nome) : turma.nome),
      subtitulo ? el("span", { class: "mudo" }, subtitulo) : null,
      chips.length ? el("div", { class: "turma-chips" }, chips.map(chip)) : null,
      extra || null));
}

// Rótulo de quem postou um aviso / mensagem (o papel vem de dado validado pelas regras).
export function rotuloPapel(papel, autorUid, representantes) {
  if (papel === "professor") return "Professor";
  if (papel === "admin") return "Administração";
  if (papel === "representante") return representantes?.has(autorUid) ? "Representante" : "Ex-Representante";
  return "";
}

export function itemAviso(a, representantes, turmasPorId = {}) {
  const origem = a.curso ? "Curso" : (turmasPorId[a.turmaId]?.nome || "");
  return el("article", { class: "aviso" },
    el("p", {}, a.texto),
    el("div", { class: "aviso-autor" },
      el("b", {}, a.autorNome), ` · ${rotuloPapel(a.autorPapel, a.autorUid, representantes)}`,
      origem ? ` · ${origem}` : "", ` · ${quando(a.criadoEm)}`, a.editadoEm ? " · editado" : ""));
}
