// Página da administração: login próprio + painel (professores pendentes, turmas, representantes, notas, avisos, chat, registro de alterações).
// Quem é admin é decidido pelas regras (documento admins/{uid}); esconder a tela não é a proteção.
import { db } from "../../core/firebase.js";
import { iniciarLogin, sessaoAtual, mensagemDeErro, sair } from "../../core/auth.js";
import { el, mensagem } from "../../ui/ui.js";
import { iniciarTurmasAdmin, iniciarRepresentantes } from "./gerenciar.js";
import { iniciarNotasAdmin } from "./notas-admin.js";
import { iniciarAvisosERegistro } from "./avisos-registro-admin.js";
import { iniciarChatAdmin } from "./chat-admin.js";
import { dataHora } from "../../utils/datas.js";
import {
  collection, query, where, getDocs, doc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
let sessao = null;

$("btn-sair").addEventListener("click", () => sair(".."));
// Ao tentar entrar, o aviso "você está conectado como…" deixa de valer (o login troca a sessão).
$("form-login").addEventListener("submit", () => { $("aviso-sessao").hidden = true; });
iniciarLogin("admin", { aoEntrarAdmin: mostrarPainel });

// Alguém (aluno/professor) já está conectado neste navegador? Avisa, sem desconectar.
sessaoAtual().then(s => {
  if (s && !s.admin) {
    const aviso = $("aviso-sessao");
    aviso.textContent = `Você está conectado como ${s.email}, que não é uma conta da administração. Entre com a conta da administração.`;
    aviso.hidden = false;
  }
}).catch(() => {});

function mostrarPainel(s) {
  sessao = s;
  $("tela-login").hidden = true;
  $("painel").hidden = false;
  $("nome-admin").textContent = s.nome || s.email;
  document.title = "Fatesck - Administração";
  carregarPendentes();
  iniciarTurmasAdmin(s);
  iniciarRepresentantes(s);
  iniciarNotasAdmin(s);
  iniciarAvisosERegistro(s);
  iniciarChatAdmin(s);
}

async function carregarPendentes() {
  const lista = $("lista-pendentes"), erro = $("erro-pendentes");
  mensagem(erro);
  try {
    const snap = await getDocs(query(collection(db, "usuarios"), where("perfil", "==", "professor"), where("status", "==", "pendente")));
    const pendentes = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0));
    if (!pendentes.length) { lista.replaceChildren(el("div", { class: "vazio" }, "Nenhum professor aguardando liberação.")); return; }
    lista.replaceChildren(...pendentes.map(linhaPendente));
  } catch (e) {
    console.error(e);
    lista.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar a lista."));
    mensagem(erro, mensagemDeErro(e));
  }
}

function linhaPendente(p) {
  const botao = el("button", { type: "button", class: "botao pequeno", "aria-label": `Aprovar ${p.nome}` }, "Aprovar");
  const linha = el("div", { class: "linha" },
    el("div", {},
      el("b", {}, p.nome),
      el("div", { class: "mudo" }, p.email),
      el("div", { class: "mudo" }, p.criadoEm ? "Cadastrado em " + dataHora(p.criadoEm) : "")),
    botao);
  botao.addEventListener("click", () => aprovar(p, botao, linha));
  return linha;
}

// Aprova: status pendente -> ativo + registro de alterações no mesmo lote (as regras exigem os dois juntos).
async function aprovar(p, botao, linha) {
  const erro = $("erro-pendentes"), status = $("status-pendentes");
  mensagem(erro); mensagem(status);
  botao.disabled = true;
  try {
    const lote = writeBatch(db);
    lote.update(doc(db, "usuarios", p.uid), { status: "ativo", aprovadoEm: serverTimestamp(), aprovadoPor: sessao.uid });
    lote.set(doc(db, "auditoria", "aprovacao_" + p.uid), {
      acao: "professor_aprovado", autorUid: sessao.uid, autorNome: sessao.nome, alvo: "usuarios/" + p.uid,
      detalhes: `Professor(a) ${p.nome} (${p.email}) liberado(a).`, criadoEm: serverTimestamp()
    });
    await lote.commit();
    linha.remove();
    mensagem(status, `${p.nome} foi liberado(a) e já pode entrar como professor.`);
    if (!$("lista-pendentes").children.length) carregarPendentes();
  } catch (e) {
    console.error(e);
    mensagem(erro, `Não foi possível liberar ${p.nome}. ${mensagemDeErro(e)}`);
    botao.disabled = false;
  }
}
