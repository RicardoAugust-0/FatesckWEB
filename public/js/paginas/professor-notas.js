// Visão consolidada do professor: indicadores, boletim matricial e folhas por turma.
import { el, esqueletoLinhas } from "../ui/ui.js";
import { card, comCorDaTurma } from "../ui/componentes.js";
import { minhasTurmas, alunosDaTurma, folhasDaTurma, itensDaFolha } from "../servicos/dados.js";
import { linhaFolha, janelaFolha, janelaNovaFolha, quadroBoletimTurma } from "../ui/notas-ui.js";
import { hrefAtividade } from "../ui/atividades-ui.js";
import { calcularMediaAluno, calcularMediaTurma, classificarDesempenhoNota, formatarNota } from "../utils/notas-util.js";

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
  const mediasAlunos = dados.flatMap(d => d.alunos.map(a => calcularMediaAluno(d.folhas.filter(f => f.publicada).map(f => ({ valor: f.itens?.[a.uid]?.valor, notaMax: f.notaMax || 10, peso: f.peso })))));
  const mediaGeral = calcularMediaTurma(mediasAlunos);
  const abaixo = mediasAlunos.filter(m => m !== null && m < 6).length;
  definirCabecalhoMovel("Notas", rascunhos ? `${rascunhos} ${rascunhos === 1 ? "folha em rascunho" : "folhas em rascunho"}` : "Nada em rascunho");
  const resumo = card({ titulo: "Resumo geral", classe: "notas-resumo-geral", corpo: [el("div", { class: "notas-kpis" },
    ...[["Turmas avaliadas", String(dados.filter(d => d.folhas.length).length)], ["Média geral", mediaGeral === null ? "—" : formatarNota(mediaGeral)], ["Alunos abaixo de 6,0", String(abaixo)], ["Folhas em rascunho", String(rascunhos)]].map(([t, v]) => el("div", { class: "notas-kpi" }, el("span", {}, t), el("b", {}, v))))] });
  const filtroId = new URLSearchParams(location.search).get("turma") || "";
  const filtro = el("select", { class: "notas-filtro-turma", "aria-label": "Filtrar por turma", onchange: e => desenharTurmas(e.target.value) },
    el("option", { value: "" }, "Todas as turmas"), ...dados.map(d => el("option", { value: d.t.id, selected: d.t.id === filtroId }, d.t.nome)));
  const areaTurmas = el("div", { class: "quadros-notas" });
  function desenharTurmas(id = filtro.value) {
    const selecionadas = dados.filter(d => !id || d.t.id === id);
    areaTurmas.replaceChildren(...selecionadas.map(({ t, alunos, folhas }) => {
      const temNotas = folhas.some(f => Object.keys(f.itens || {}).length);
      const corpo = el("div", { class: "notas-abas-conteudo" });
      const botaoBoletim = el("button", { type: "button", class: "botao pequeno neutro" }, "Boletim e Médias");
      const botaoFolhas = el("button", { type: "button", class: "botao pequeno neutro" }, "Folhas de Avaliação");
      const mostrarBoletim = () => { botaoBoletim.classList.add("ativo"); botaoFolhas.classList.remove("ativo"); corpo.replaceChildren(quadroBoletimTurma(sessao, t, { alunos, folhas, hrefAtividade: idAt => hrefAtividade(href, t.id, idAt), aoMudar: recarregar })); };
      const mostrarFolhas = () => {
        botaoFolhas.classList.add("ativo"); botaoBoletim.classList.remove("ativo");
        const abrirNova = f => { recarregar(); janelaFolha(sessao, t, f, { alunos, podeEditar: true, aoMudar: recarregar }); };
        const linhas = folhas.map(f => linhaFolha(sessao, t, f, { itens: f.itens, alunos, podeEditar: f.autorUid === sessao.uid,
          hrefAtividade: f.atividadeId ? hrefAtividade(href, t.id, f.atividadeId) : null, aoMudar: recarregar }));
        corpo.replaceChildren(...(linhas.length ? linhas : [el("div", { class: "vazio" }, "Nenhuma avaliação cadastrada nesta turma.")]));
      };
      botaoBoletim.addEventListener("click", mostrarBoletim); botaoFolhas.addEventListener("click", mostrarFolhas);
      const abas = el("div", { class: "notas-abas" }, botaoBoletim, botaoFolhas);
      const nova = el("button", { type: "button", class: "botao pequeno sec", onclick: () => janelaNovaFolha(sessao, t, abrirNovaFolha) }, "+ Nova folha");
      const abrirNovaFolha = f => { recarregar(); janelaFolha(sessao, t, f, { alunos, podeEditar: true, aoMudar: recarregar }); };
      const quadro = comCorDaTurma(card({ titulo: t.nome, extra: nova, corpo: [abas, corpo] }), t.cor);
      if (filtroId && filtroId === t.id) quadro.classList.add("turma-destacada");
      if (temNotas) mostrarBoletim(); else mostrarFolhas();
      return quadro;
    }));
  }
  desenharTurmas(filtroId);
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Notas"), resumo,
    el("div", { class: "notas-filtro-wrap" }, el("label", {}, "Filtrar por turma", filtro)), areaTurmas,
    !dados.length ? el("div", { class: "card" }, el("div", { class: "vazio" }, "Você ainda não tem turmas. Crie a primeira em Minhas turmas.")) : null,
    el("p", { class: "dica-campo", style: { marginTop: "16px" } }, "Os alunos só veem as próprias notas depois que a avaliação é publicada."));
}
