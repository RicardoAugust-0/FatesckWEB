// Admin (Fase 7b): seção "Chat" — a administração lê o chat de qualquer turma e qualquer conversa particular
// (em tempo real) e pode apagar mensagens. Apagar some com a mensagem e fica no registro de alterações.
// A administração não escreve nos chats (as regras não deixam).
import { db } from "../../core/firebase.js";
import { el, mensagem } from "../../ui/ui.js";
import { mensagemDeErro } from "../../core/auth.js";
import { idsRepresentantes } from "../../servicos/dados.js";
import { painelConversa } from "../../ui/chat-ui.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

export async function iniciarChatAdmin(sessao) {
  const sel = $("sel-chat-admin"), caixa = $("chat-admin"), erro = $("erro-chat-admin");
  let turmas = [], conversas = [], reps = new Set(), painel = null;
  try {
    const [t, c, r] = await Promise.all([getDocs(collection(db, "turmas")), getDocs(collection(db, "conversas")), idsRepresentantes()]);
    turmas = t.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.arquivada - b.arquivada) || a.nome.localeCompare(b.nome, "pt-BR"));
    conversas = c.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.professorNome.localeCompare(b.professorNome, "pt-BR") || a.alunoNome.localeCompare(b.alunoNome, "pt-BR"));
    reps = r;
  } catch (e) {
    console.error(e);
    mensagem(erro, mensagemDeErro(e));
    return;
  }
  const nomeTurma = id => turmas.find(t => t.id === id)?.nome;
  sel.append(
    el("optgroup", { label: "Chat das turmas" }, turmas.map(t => el("option", { value: "turma:" + t.id }, t.arquivada ? `${t.nome} (arquivada)` : t.nome))),
    el("optgroup", { label: "Conversas particulares (professor e aluno)" },
      conversas.length ? conversas.map(c => el("option", { value: "conversa:" + c.id }, `${c.professorNome} e ${c.alunoNome}`))
        : el("option", { value: "", disabled: true }, "Nenhuma conversa particular ainda")));

  sel.addEventListener("change", () => {
    painel?.parar(); painel = null;
    mensagem(erro);
    const [tipo, id] = [sel.value.slice(0, sel.value.indexOf(":")), sel.value.slice(sel.value.indexOf(":") + 1)];
    const t = tipo === "turma" ? turmas.find(x => x.id === id) : null;
    const c = tipo === "conversa" ? conversas.find(x => x.id === id) : null;
    if (t) {
      painel = painelConversa({ sessao, alvo: { tipo: "turma", id: t.id }, titulo: t.nome, subtitulo: "Chat da turma", onde: `chat da turma ${t.nome}`,
        representantes: reps, podeApagar: !t.arquivada,
        somenteLeitura: t.arquivada ? "Turma arquivada: somente leitura, nada pode ser apagado." : "A administração só lê. Para apagar uma mensagem, use a lixeira ao lado dela." });
    } else if (c) {
      painel = painelConversa({ sessao, alvo: { tipo: "privada", id: c.id }, titulo: `${c.professorNome} e ${c.alunoNome}`,
        subtitulo: ["Conversa particular", nomeTurma(c.turmaId)].filter(Boolean).join(" · "), onde: `conversa particular de ${c.professorNome} e ${c.alunoNome}`,
        professorUid: c.professorUid, podeApagar: true,
        somenteLeitura: "A administração só lê. Para apagar uma mensagem, use a lixeira ao lado dela." });
    }
    caixa.replaceChildren(painel ? el("div", { class: "chat-layout so-conversa aberta" }, painel.no)
      : el("div", { class: "vazio" }, "Escolha um chat para ler as mensagens."));
  });
}
