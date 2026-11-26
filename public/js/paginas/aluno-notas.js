// Desempenho acadêmico do aluno: resumo das turmas ativas e notas publicadas por disciplina.
import { el, esqueletoLinhas } from "../ui/ui.js";
import { card } from "../ui/componentes.js";
import { minhasTurmas, folhasDaTurma, minhaNota } from "../servicos/dados.js";
import { quadroNotasAluno } from "../ui/notas-ui.js";
import { calcularMediaAluno, calcularMediaTurma, formatarNota } from "../utils/notas-util.js";

export async function montar({ sessao, conteudo, definirCabecalhoMovel }) {
  definirCabecalhoMovel("Notas", "Carregando…");
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Notas"), card({ titulo: "Carregando…", corpo: esqueletoLinhas(3) }));
  const turmas = (await minhasTurmas(sessao.uid)).filter(t => t.meuPapel === "aluno")
    .sort((a, b) => (a.arquivada - b.arquivada) || a.nome.localeCompare(b.nome, "pt-BR"));
  const quadros = await Promise.all(turmas.map(async t => {
    const folhas = await folhasDaTurma(t.id, { soPublicadas: true });
    const itens = await Promise.all(folhas.map(f => minhaNota(t.id, f.id, sessao.uid)));
    const notas = folhas.map((folha, i) => ({ folha, item: itens[i] })).filter(n => n.item);
    const media = calcularMediaAluno(notas.map(({ folha, item }) => ({ valor: item.valor, notaMax: folha.notaMax || 10, peso: folha.peso })));
    return { t, notas, media };
  }));
  const ativas = quadros.filter(q => !q.t.arquivada), medias = ativas.map(q => q.media);
  const mediaGeral = calcularMediaTurma(medias), aprovadas = medias.filter(m => m !== null && m >= 6).length, atencao = medias.filter(m => m !== null && m < 6).length;
  const total = quadros.reduce((s, q) => s + q.notas.length, 0);
  definirCabecalhoMovel("Notas", total ? `${total} ${total === 1 ? "nota publicada" : "notas publicadas"}` : "Nenhuma nota publicada ainda");
  const resumo = card({ titulo: "Desempenho Acadêmico", classe: "notas-desempenho-geral", corpo: [el("div", { class: "notas-kpis" },
    ...[["Média geral nas turmas ativas", mediaGeral === null ? "—" : formatarNota(mediaGeral)], ["Disciplinas com média ≥ 6,0", String(aprovadas)], ["Disciplinas que exigem atenção", String(atencao)]].map(([t, v]) => el("div", { class: "notas-kpi" }, el("span", {}, t), el("b", {}, v))))] });
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Notas"), resumo,
    ...(quadros.length ? [el("div", { class: "quadros-notas" }, ...quadros.map(({ t, notas }) => quadroNotasAluno({ ...t, nome: t.arquivada ? `${t.nome} (arquivada)` : t.nome }, notas)))]
      : [el("div", { class: "card" }, el("div", { class: "vazio" }, "Você ainda não está em nenhuma turma. Entre com o código da turma."))]),
    el("p", { class: "dica-campo", style: { marginTop: "16px" } }, "Aqui aparecem só as suas notas, depois que o professor publica. Nota de atividade aparece 4 horas depois da entrega."));
}
