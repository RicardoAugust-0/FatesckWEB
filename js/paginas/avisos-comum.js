// Página "Avisos" (Fase 7a), igual para aluno e professor. Decisão do Fernando:
// MURAL DO CURSO no topo (faixa vermelha, mais destaque) + um quadro por turma ativa.
// Abrir a página marca tudo como visto (o número do menu some); os que eram novos mantêm a etiqueta "Novo" enquanto a página está aberta.
import { el, esqueletoLinhas } from "../ui.js";
import { card } from "../componentes.js";
import { minhasTurmas, minhasLeituras, avisosDaTurma, avisosDoCurso, idsRepresentantes } from "../dados.js";
import { muralCurso, quadroAvisosTurma } from "../avisos-ui.js";
import { marcarVisto } from "../avisos.js";

export async function montarAvisos({ sessao, perfil, conteudo, definirCabecalhoMovel, definirContador }) {
  definirCabecalhoMovel("Avisos", "Carregando…");
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Avisos"), card({ titulo: "Carregando…", corpo: esqueletoLinhas(3) }));

  const uid = sessao.uid;
  const [todas, leituras] = await Promise.all([minhasTurmas(uid), minhasLeituras(uid)]); // leituras ANTES de marcar: decide o "Novo"
  const papel = perfil === "professor" ? "professor" : "aluno";
  const turmas = todas.filter(t => t.meuPapel === papel && !t.arquivada);

  async function desenhar() {
    const [avisosCurso, representantes, porTurma] = await Promise.all([
      avisosDoCurso(50), idsRepresentantes(), Promise.all(turmas.map(t => avisosDaTurma(t.id, 30)))]);
    const souRep = papel === "aluno" && representantes.has(uid);
    const novosCurso = avisosCurso.filter(a => a.autorUid !== uid && (a.criadoEm?.toMillis?.() || 0) > (leituras.curso_avisos || 0)).length;
    const novosTurmas = turmas.reduce((s, t, i) => s + porTurma[i].filter(a => a.autorUid !== uid && (a.criadoEm?.toMillis?.() || 0) > (leituras[`turma_${t.id}_avisos`] || 0)).length, 0);
    definirCabecalhoMovel("Avisos", novosCurso + novosTurmas ? `${novosCurso + novosTurmas} ${novosCurso + novosTurmas === 1 ? "aviso novo" : "avisos novos"}` : "Nenhum aviso novo");

    const mural = muralCurso({ avisos: avisosCurso, representantes, vistoMs: leituras.curso_avisos, sessao,
      podePublicar: souRep, papelPublicacao: "representante",
      podeMexer: a => souRep && a.autorUid === uid && a.autorPapel === "representante", aoMudar: desenhar });
    const quadros = turmas.map((t, i) => quadroAvisosTurma(t, porTurma[i], { representantes, vistoMs: leituras[`turma_${t.id}_avisos`], sessao,
      podePublicar: papel === "professor", podeMexer: a => papel === "professor" && a.autorUid === uid, aoMudar: desenhar }));
    conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Avisos"), mural,
      el("div", { class: "quadros-avisos" }, ...(quadros.length ? quadros
        : [el("div", { class: "card" }, el("div", { class: "vazio" }, papel === "professor" ? "Você ainda não tem turmas." : "Você ainda não está em nenhuma turma."))])));
  }
  await desenhar();

  // visto: curso + todas as turmas mostradas
  await marcarVisto(uid, ["curso_avisos", ...turmas.map(t => `turma_${t.id}_avisos`)]);
  definirContador("avisos", 0);
}
