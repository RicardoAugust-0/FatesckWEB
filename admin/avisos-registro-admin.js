// Admin (Fase 7a): seção "Avisos" (publicar no mural do curso; editar/apagar qualquer aviso) e
// "Registro de alterações" (o mais novo primeiro, 30 por vez, filtro por tipo e por turma). Decisões do Fernando.
import { db } from "../js/firebase.js";
import { el, mensagem, toast } from "../js/ui.js";
import { iconeEl } from "../js/icones.js";
import { mensagemDeErro } from "../js/auth.js";
import { dataHora } from "../js/datas.js";
import { avisosDoCurso, avisosDaTurma, idsRepresentantes } from "../js/dados.js";
import { itemAviso, janelaAviso } from "../js/avisos-ui.js";
import { publicarAvisoCurso } from "../js/avisos.js";
import { nomeDaAcao, opcoesDeAcao } from "../js/auditoria-util.js";
import {
  collection, getDocs, query, where, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const POR_PAGINA = 30;

async function todasAsTurmas() {
  return (await getDocs(collection(db, "turmas"))).docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.arquivada - b.arquivada) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function iniciarAvisosERegistro(sessao) {
  let turmas = [];
  try { turmas = await todasAsTurmas(); }
  catch (e) { console.error(e); mensagem($("erro-avisos"), mensagemDeErro(e)); }
  const nomeTurma = id => turmas.find(t => t.id === id)?.nome;
  iniciarAvisos(sessao, turmas);
  iniciarRegistro(turmas, nomeTurma);
}

// ===================================================================
// Avisos
// ===================================================================
function iniciarAvisos(sessao, turmas) {
  const caixaCurso = $("avisos-curso-admin"), sel = $("sel-avisos-turma"), lista = $("lista-avisos-turma"), erro = $("erro-avisos");
  sel.append(...turmas.map(t => el("option", { value: t.id }, t.arquivada ? `${t.nome} (arquivada)` : t.nome)));

  async function mostrarCurso() {
    try {
      const [avisos, reps] = await Promise.all([avisosDoCurso(50), idsRepresentantes()]);
      const novo = el("button", { type: "button", class: "botao", onclick: () => janelaAviso({ titulo: "Novo aviso do curso",
        destinos: [{ valor: "curso", rotulo: "Curso inteiro (todos os alunos e professores)" }],
        aoEnviar: async t => { await publicarAvisoCurso(sessao, t, "admin"); toast("Aviso publicado no mural do curso."); mostrarCurso(); } }) },
        iconeEl("avisos"), "+ Novo aviso do curso");
      caixaCurso.replaceChildren(
        el("div", { class: "form-linha", style: { justifyContent: "space-between", alignItems: "center" } }, el("h3", {}, "Mural do curso"), novo),
        el("div", { class: "lista" }, ...(avisos.length
          ? avisos.map(a => itemAviso(a, { representantes: reps, sessao, podeMexer: true, aoMudar: mostrarCurso }))
          : [el("div", { class: "vazio" }, "Nenhum aviso do curso.")])));
    } catch (e) { console.error(e); caixaCurso.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar os avisos do curso.")); mensagem(erro, mensagemDeErro(e)); }
  }
  async function mostrarTurma() {
    mensagem(erro);
    const t = turmas.find(x => x.id === sel.value);
    if (!t) { lista.replaceChildren(el("div", { class: "vazio" }, "Escolha uma turma para ver os avisos dela.")); return; }
    lista.replaceChildren(el("div", { class: "vazio" }, "Carregando…"));
    try {
      const [avisos, reps] = await Promise.all([avisosDaTurma(t.id, 50), idsRepresentantes()]);
      lista.replaceChildren(...(avisos.length
        ? avisos.map(a => itemAviso(a, { representantes: reps, sessao, origem: t.nome, podeMexer: !t.arquivada, aoMudar: mostrarTurma }))
        : [el("div", { class: "vazio" }, "Nenhum aviso nesta turma.")]));
    } catch (e) { console.error(e); lista.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar.")); mensagem(erro, mensagemDeErro(e)); }
  }
  sel.addEventListener("change", mostrarTurma);
  mostrarCurso();
}

// ===================================================================
// Registro de alterações
// ===================================================================
function iniciarRegistro(turmas, nomeTurma) {
  const selAcao = $("filtro-acao"), selTurma = $("filtro-turma-registro"), lista = $("lista-registro"), mais = $("mais-registro"), erro = $("erro-registro");
  selAcao.append(...opcoesDeAcao().map(([valor, rotulo]) => el("option", { value: valor }, rotulo)));
  selTurma.append(...turmas.map(t => el("option", { value: t.id }, t.arquivada ? `${t.nome} (arquivada)` : t.nome)));
  let ultimo = null, versao = 0;

  const linha = r => el("div", { class: "linha linha-registro" },
    el("div", { class: "registro-quando mudo" }, dataHora(r.criadoEm)),
    el("div", { class: "linha-info" },
      el("span", {}, el("b", {}, r.autorNome), ` · ${nomeDaAcao(r.acao)}`, r.turmaId && nomeTurma(r.turmaId) ? ` · ${nomeTurma(r.turmaId)}` : ""),
      r.detalhes ? el("span", { class: "mudo" }, r.detalhes) : null));

  async function carregar(doZero) {
    const minha = doZero ? ++versao : versao;
    mensagem(erro);
    if (doZero) { ultimo = null; lista.replaceChildren(el("div", { class: "vazio" }, "Carregando…")); mais.replaceChildren(); }
    try {
      const filtros = [];
      if (selAcao.value) filtros.push(where("acao", "==", selAcao.value));
      if (selTurma.value) filtros.push(where("turmaId", "==", selTurma.value));
      const q = query(collection(db, "auditoria"), ...filtros, orderBy("criadoEm", "desc"), ...(ultimo ? [startAfter(ultimo)] : []), limit(POR_PAGINA));
      const snap = await getDocs(q);
      if (minha !== versao) return; // filtro mudou enquanto carregava
      const linhas = snap.docs.map(d => linha(d.data()));
      if (doZero) lista.replaceChildren(...(linhas.length ? linhas : [el("div", { class: "vazio" }, "Nenhuma alteração encontrada com esses filtros.")]));
      else lista.append(...linhas);
      ultimo = snap.docs[snap.docs.length - 1] || ultimo;
      mais.replaceChildren(...(snap.size === POR_PAGINA
        ? [el("button", { type: "button", class: "botao sec", onclick: e => { e.currentTarget.disabled = true; carregar(false); } }, "Carregar mais")] : []));
    } catch (e) {
      console.error(e);
      if (doZero) lista.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar o registro."));
      mensagem(erro, mensagemDeErro(e));
    }
  }
  selAcao.addEventListener("change", () => carregar(true));
  selTurma.addEventListener("change", () => carregar(true));
  carregar(true);
}
