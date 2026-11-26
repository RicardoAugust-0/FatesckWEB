// "Notas" do professor (Fase 6): um quadro por turma ativa com as folhas de notas (rascunho/publicada, média da turma),
// "+ Nova folha" e "Lançar notas" (janela grande). Folhas de atividade abrem a tela da atividade.
import { el, esqueletoLinhas } from "../ui.js";
import { card, comCorDaTurma } from "../componentes.js";
import { minhasTurmas, alunosDaTurma, folhasDaTurma, itensDaFolha } from "../dados.js";
import { linhaFolha, janelaFolha, janelaNovaFolha } from "../notas-ui.js";
import { hrefAtividade } from "../atividades-ui.js";

export async function montar({ sessao, conteudo, href, definirCabecalhoMovel }) {
  definirCabecalhoMovel("Notas", "Carregando…");
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Notas"), card({ titulo: "Carregando…", corpo: esqueletoLinhas(3) }));
  const recarregar = () => montar({ sessao, conteudo, href, definirCabecalhoMovel });

  const turmas = (await minhasTurmas(sessao.uid)).filter(t => t.meuPapel === "professor" && !t.arquivada);
  const dados = await Promise.all(turmas.map(async t => {
    const [alunos, folhas] = await Promise.all([alunosDaTurma(t.id), folhasDaTurma(t.id)]);
    const itens = await Promise.all(folhas.map(f => itensDaFolha(t.id, f.id)));
    return { t, alunos, folhas: folhas.map((f, i) => ({ ...f, itens: itens[i] })) };
  }));
  const rascunhos = dados.reduce((s, d) => s + d.folhas.filter(f => !f.publicada).length, 0);
  definirCabecalhoMovel("Notas", rascunhos ? `${rascunhos} ${rascunhos === 1 ? "folha em rascunho" : "folhas em rascunho"}` : "Nada em rascunho");

  const quadros = dados.map(({ t, alunos, folhas }) => {
    const abrirNova = f => { recarregar(); janelaFolha(sessao, t, f, { alunos, podeEditar: true, aoMudar: recarregar }); };
    const linhas = folhas.map(f => linhaFolha(sessao, t, f, { itens: f.itens, alunos, podeEditar: f.autorUid === sessao.uid,
      hrefAtividade: f.atividadeId ? hrefAtividade(href, t.id, f.atividadeId) : null, aoMudar: recarregar }));
    return comCorDaTurma(card({ titulo: t.nome,
      extra: el("button", { type: "button", class: "botao pequeno sec", onclick: () => janelaNovaFolha(sessao, t, abrirNova) }, "+ Nova folha"),
      corpo: linhas.length ? linhas : [el("div", { class: "vazio" }, "Nenhuma nota lançada nesta turma.")] }), t.cor);
  });
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Notas"),
    ...(quadros.length ? [el("div", { class: "quadros-notas" }, ...quadros)]
      : [el("div", { class: "card" }, el("div", { class: "vazio" }, "Você ainda não tem turmas. Crie a primeira em \"Minhas turmas\"."))]),
    el("p", { class: "dica-campo", style: { marginTop: "16px" } }, "Os alunos só veem as próprias notas, e só depois de \"Publicar\". A média é só para você."));
}
