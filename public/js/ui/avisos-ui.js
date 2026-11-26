// Peças de tela dos avisos (Fase 7a). Decisões do Fernando: página Avisos com o MURAL DO CURSO no topo
// (faixa vermelha larga, cartões brancos, até 3 por linha) e um quadro por turma; publicar/editar por botão + janela.
import { el, abrirJanela, abrirMenu, toast, mensagem, confirmar } from "./ui.js";
import { iconeEl } from "./icones.js";
import { chip, card, comCorDaTurma, rotuloPapel } from "./componentes.js";
import { quando, ms } from "../utils/datas.js";
import { publicarAvisoTurma, publicarAvisoCurso, editarAviso, apagarAviso } from "../servicos/avisos.js";
import { mensagemDeErro } from "../core/auth.js";

const LIMITE = 2000;

// Janela de aviso (novo ou editar). destinos: [{ valor, rotulo }] (vazio = destino fixo).
export function janelaAviso({ titulo, textoInicial = "", destinos = [], destinoInicial, rotuloBotao = "Publicar", aoEnviar }) {
  const idT = "aviso-texto-" + Math.random().toString(36).slice(2), idD = idT + "-d";
  const texto = el("textarea", { id: idT, rows: "6", maxlength: String(LIMITE), placeholder: "Escreva o aviso…" });
  texto.value = textoInicial;
  const contador = el("span", { class: "dica-campo", "aria-live": "polite" });
  const atualizar = () => { contador.textContent = `${texto.value.length} de ${LIMITE} caracteres`; };
  texto.addEventListener("input", atualizar); atualizar();
  const destino = destinos.length > 1 ? el("select", { id: idD }, ...destinos.map(d => el("option", { value: d.valor, selected: d.valor === destinoInicial }, d.rotulo))) : null;
  const erro = el("p", { class: "erro", role: "alert" });
  const ok = el("button", { type: "button", class: "botao" }, rotuloBotao);
  const j = abrirJanela({ titulo, conteudo: [
    destino ? el("div", { class: "campo" }, el("label", { for: idD }, "Para"), destino)
      : destinos.length === 1 ? el("p", { class: "mudo" }, `Para: ${destinos[0].rotulo}`) : null,
    el("div", { class: "campo" }, el("label", { for: idT }, "Aviso"), texto, contador), erro],
  acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
  ok.addEventListener("click", async () => {
    mensagem(erro);
    const t = texto.value.trim();
    if (!t) return mensagem(erro, "Escreva o aviso.");
    ok.disabled = true;
    try { await aoEnviar(t, destino ? destino.value : destinos[0]?.valor); j.fechar(); }
    catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); ok.disabled = false; }
  });
}

// Um aviso: texto, "Autor · Papel · (origem) · quando · editado", etiqueta "Novo" e menu ⋯ (editar/apagar) para quem pode.
// opcoes: { representantes, novo, origem (mostrada), nomeTurma (só para o registro), podeMexer, sessao, aoMudar, classe }
export function itemAviso(a, { representantes, novo, origem, nomeTurma, podeMexer, sessao, aoMudar, classe = "aviso" }) {
  const onde = a.curso ? "Curso" : (origem || nomeTurma || "turma");
  const autor = el("div", { class: "aviso-autor" },
    el("b", {}, a.autorNome), ` · ${rotuloPapel(a.autorPapel, a.autorUid, representantes)}`,
    origem ? ` · ${origem}` : "", ` · ${quando(a.criadoEm)}`, a.editadoEm ? " · editado" : "");
  const topo = novo ? el("div", { class: "aviso-topo" }, chip({ texto: "Novo", classe: "chip forte" })) : null;
  const artigo = el("article", { class: classe + (novo ? " novo" : "") + (podeMexer ? " com-menu" : "") }, topo, el("p", {}, a.texto), autor);
  if (podeMexer) {
    artigo.append(el("button", { type: "button", class: "aviso-mais", "aria-label": `Opções do aviso de ${a.autorNome}`, "aria-haspopup": "menu",
      onclick: e => abrirMenu(e.currentTarget, [
        { texto: "Editar", icone: iconeEl("lapis"), acao: () => janelaAviso({ titulo: "Editar aviso", textoInicial: a.texto, rotuloBotao: "Salvar",
            aoEnviar: async t => { await editarAviso(sessao, a, t, onde); toast("Aviso editado."); aoMudar?.(); } }) },
        { texto: "Apagar", icone: iconeEl("arquivo"), acao: async () => {
            if (!await confirmar("Apagar o aviso?", ["O aviso some para todos. Isso não pode ser desfeito.", "A ação fica no registro de alterações."], "Apagar")) return;
            try { await apagarAviso(sessao, a, onde); toast("Aviso apagado."); aoMudar?.(); }
            catch (e) { console.error(e); toast("Não foi possível apagar. " + mensagemDeErro(e), { tipo: "erro" }); } } }
      ]) }, iconeEl("mais")));
  }
  return artigo;
}

// Mural do curso (faixa vermelha). avisos: do curso, do mais novo para o mais antigo.
export function muralCurso({ avisos, representantes, vistoMs, sessao, podePublicar, papelPublicacao, podeMexer, aoMudar, mostrar = 6 }) {
  let abertos = false;
  const grade = el("div", { class: "mural-grade" });
  const verTodos = avisos.length > mostrar ? el("button", { type: "button", class: "botao branco pequeno" }, `Ver todos (${avisos.length})`) : null;
  const pintar = () => {
    const lista = abertos ? avisos : avisos.slice(0, mostrar);
    grade.replaceChildren(...(lista.length ? lista.map(a => itemAviso(a, { representantes, sessao, aoMudar, classe: "aviso-mural",
      novo: a.autorUid !== sessao.uid && ms(a.criadoEm) > (vistoMs || 0), podeMexer: podeMexer(a) }))
      : [el("p", { class: "mural-vazio" }, "Nenhum aviso do curso por enquanto.")]));
    if (verTodos) verTodos.textContent = abertos ? "Mostrar menos" : `Ver todos (${avisos.length})`;
  };
  verTodos?.addEventListener("click", () => { abertos = !abertos; pintar(); });
  pintar();
  const novo = podePublicar ? el("button", { type: "button", class: "botao branco", onclick: () => janelaAviso({ titulo: "Novo aviso do curso",
    destinos: [{ valor: "curso", rotulo: "Curso inteiro (todos os alunos e professores)" }],
    aoEnviar: async t => { await publicarAvisoCurso(sessao, t, papelPublicacao); toast("Aviso publicado no mural do curso."); aoMudar?.(); } }) },
    iconeEl("avisos"), "+ Novo aviso do curso") : null;
  return el("section", { class: "mural", "aria-label": "Mural do curso" },
    el("div", { class: "mural-topo" }, el("h2", {}, iconeEl("avisos"), "Mural do curso"), novo),
    grade, verTodos ? el("div", { class: "mural-rodape" }, verTodos) : null);
}

// Quadro de uma turma com os avisos dela (faixa com a cor da turma).
export function quadroAvisosTurma(turma, avisos, { representantes, vistoMs, sessao, podePublicar, podeMexer, aoMudar, mostrar = 5, titulo }) {
  let abertos = false;
  const corpo = el("div");
  const verTodos = avisos.length > mostrar ? el("button", { type: "button", class: "botao pequeno neutro" }, `Ver todos (${avisos.length})`) : null;
  const pintar = () => {
    const lista = abertos ? avisos : avisos.slice(0, mostrar);
    corpo.replaceChildren(...(lista.length ? lista.map(a => itemAviso(a, { representantes, sessao, aoMudar, nomeTurma: turma.nome,
      novo: a.autorUid !== sessao.uid && ms(a.criadoEm) > (vistoMs || 0), podeMexer: podeMexer(a) }))
      : [el("div", { class: "vazio" }, "Nenhum aviso nesta turma.")]));
    if (verTodos) verTodos.textContent = abertos ? "Mostrar menos" : `Ver todos (${avisos.length})`;
  };
  verTodos?.addEventListener("click", () => { abertos = !abertos; pintar(); });
  pintar();
  const novo = podePublicar ? el("button", { type: "button", class: "botao pequeno", onclick: () => janelaAviso({ titulo: "Novo aviso da turma",
    destinos: [{ valor: turma.id, rotulo: turma.nome }],
    aoEnviar: async t => { await publicarAvisoTurma(sessao, turma.id, t); toast(`Aviso publicado em "${turma.nome}".`); aoMudar?.(); } }) }, "+ Novo aviso") : null;
  return comCorDaTurma(card({ titulo: titulo || turma.nome, extra: novo,
    corpo: [corpo, ...(verTodos ? [el("div", { class: "card-rodape" }, el("span", {}, ""), verTodos)] : [])] }), turma.cor);
}
