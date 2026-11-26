// "Notas" do aluno (Fase 6): um quadro por turma (decisão do Fernando), só com as próprias notas publicadas.
// Sem média final e sem pesos. Turmas arquivadas também aparecem (as notas continuam valendo).
import { el, esqueletoLinhas } from "../ui/ui.js";
import { card } from "../ui/componentes.js";
import { minhasTurmas, folhasDaTurma, minhaNota } from "../servicos/dados.js";
import { quadroNotasAluno } from "../ui/notas-ui.js";

export async function montar({ sessao, conteudo, definirCabecalhoMovel }) {
  definirCabecalhoMovel("Notas", "Carregando…");
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Notas"), card({ titulo: "Carregando…", corpo: esqueletoLinhas(3) }));

  const turmas = (await minhasTurmas(sessao.uid)).filter(t => t.meuPapel === "aluno")
    .sort((a, b) => (a.arquivada - b.arquivada) || a.nome.localeCompare(b.nome, "pt-BR"));
  const quadros = await Promise.all(turmas.map(async t => {
    const folhas = await folhasDaTurma(t.id, { soPublicadas: true });
    const itens = await Promise.all(folhas.map(f => minhaNota(t.id, f.id, sessao.uid)));
    const notas = folhas.map((folha, i) => ({ folha, item: itens[i] })).filter(n => n.item);
    return { t, notas };
  }));
  const total = quadros.reduce((s, q) => s + q.notas.length, 0);
  definirCabecalhoMovel("Notas", total ? `${total} ${total === 1 ? "nota publicada" : "notas publicadas"}` : "Nenhuma nota publicada ainda");
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Notas"),
    ...(quadros.length
      ? [el("div", { class: "quadros-notas" }, ...quadros.map(({ t, notas }) => {
          const q = quadroNotasAluno({ ...t, nome: t.arquivada ? `${t.nome} (arquivada)` : t.nome }, notas);
          return q;
        }))]
      : [el("div", { class: "card" }, el("div", { class: "vazio" }, "Você ainda não está em nenhuma turma. Entre com o código da turma."))]),
    el("p", { class: "dica-campo", style: { marginTop: "16px" } }, "Aqui aparecem só as suas notas, depois que o professor publica. Nota de atividade aparece 4 horas depois da entrega."));
}
