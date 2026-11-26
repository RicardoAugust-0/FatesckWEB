// Admin > Notas (Fase 6): escolhe a turma e vê todas as folhas (rascunho e publicadas) com as notas de cada aluno.
// O admin não lança notas; pode só DESPUBLICAR uma folha publicada ou APAGAR um rascunho (com confirmação e registro).
import { db } from "../../core/firebase.js";
import { el, mensagem, toast, confirmar } from "../../ui/ui.js";
import { despublicarFolha, apagarFolha } from "../../servicos/notas.js";
import { mensagemDeErro } from "../../core/auth.js";
import { alunosDaTurma, folhasDaTurma, itensDaFolha } from "../../servicos/dados.js";
import { linhaFolha } from "../../ui/notas-ui.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

export async function iniciarNotasAdmin(sessao) {
  const sel = $("sel-notas-turma"), lista = $("lista-notas"), erro = $("erro-notas");
  try {
    const turmas = (await getDocs(collection(db, "turmas"))).docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.arquivada - b.arquivada) || a.nome.localeCompare(b.nome, "pt-BR"));
    sel.append(...turmas.map(t => el("option", { value: t.id }, t.arquivada ? `${t.nome} (arquivada)` : t.nome)));
    sel.addEventListener("change", () => mostrar(turmas.find(t => t.id === sel.value)));
  } catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); }

  // Publicada -> "Despublicar"; rascunho -> "Apagar rascunho". Os dois pedem confirmação e ficam no registro.
  function botaoAcaoAdmin(t, f) {
    const b = el("button", { type: "button", class: "botao pequeno sec" }, f.publicada ? "Despublicar" : "Apagar rascunho");
    b.addEventListener("click", async () => {
      const ok = f.publicada
        ? await confirmar("Despublicar as notas?", [`"${f.titulo}" (${t.nome}) deixa de aparecer para os alunos.`,
            "O professor pode publicar de novo depois. A ação fica no registro de alterações."], "Despublicar")
        : await confirmar("Apagar o rascunho?", [`"${f.titulo}" (${t.nome}) e todas as notas dela serão apagadas. Isso não pode ser desfeito.`,
            "A ação fica no registro de alterações."], "Apagar rascunho");
      if (!ok) return;
      b.disabled = true; mensagem(erro);
      try {
        if (f.publicada) { await despublicarFolha(sessao, f, t.nome); toast(`"${f.titulo}" despublicada.`); }
        else { await apagarFolha(sessao, f, t.nome); toast(`"${f.titulo}" apagada.`); }
        mostrar(t);
      } catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); b.disabled = false; }
    });
    return b;
  }

  async function mostrar(t) {
    mensagem(erro);
    if (!t) { lista.replaceChildren(el("div", { class: "vazio" }, "Escolha uma turma para ver as notas.")); return; }
    lista.replaceChildren(el("div", { class: "vazio" }, "Carregando…"));
    try {
      const [alunos, folhas] = await Promise.all([alunosDaTurma(t.id), folhasDaTurma(t.id)]);
      const itens = await Promise.all(folhas.map(f => itensDaFolha(t.id, f.id)));
      lista.replaceChildren(...(folhas.length
        ? folhas.map((f, i) => {
            const linha = linhaFolha(sessao, t, f, { itens: itens[i], alunos, podeEditar: false });
            if (!t.arquivada) linha.querySelector(".linha-acoes").append(botaoAcaoAdmin(t, f));
            return linha;
          })
        : [el("div", { class: "vazio" }, "Nenhuma nota lançada nesta turma.")]));
    } catch (e) {
      console.error(e);
      lista.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar as notas."));
      mensagem(erro, mensagemDeErro(e));
    }
  }
}
