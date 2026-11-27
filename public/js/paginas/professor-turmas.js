// "Minhas turmas" do professor (prévia: tela 5): banner, cards com menu ⋯ e painel "Nova turma".
// "Ver arquivadas" troca a lista pelas turmas arquivadas (cards em cinza, ⋯ com "Desarquivar").
import { el, esqueletoTurmas, toast } from "../ui/ui.js";
import { banner, botaoBanner, cardTurma } from "../ui/componentes.js";
import { carregarProfessor } from "./professor-comum.js";
import { painelNovaTurma, menuProfessor } from "../ui/turmas-ui.js";
import { carregarDiagnosticoProfessor } from "../servicos/acompanhamento.js";
import { chipsSaudeDaTurma } from "../ui/alertas-ui.js";

export async function montar({ sessao, conteudo, href, definirCabecalhoMovel, definirContador }) {
  let verArquivadas = location.hash === "#arquivadas";
  const hrefTurma = t => href("turma") + "?id=" + encodeURIComponent(t.id);

  const botaoAlternar = botaoBanner("Ver arquivadas", "arquivo");
  const topo = banner({ titulo: "Minhas turmas", subtitulo: "Carregando…", acao: botaoAlternar,
    blocos: ["Turmas ativas", "Atividades para corrigir", "Mensagens não lidas"] });
  const grade = el("div", { class: "grade-turmas" }, esqueletoTurmas(4));
  const painel = painelNovaTurma(sessao, () => carregar());
  const layout = el("div", { class: "layout-turmas" }, grade, painel);
  conteudo.replaceChildren(topo, layout);

  botaoAlternar.addEventListener("click", () => {
    verArquivadas = !verArquivadas;
    history.replaceState(null, "", verArquivadas ? "#arquivadas" : location.pathname);
    desenhar();
  });

  let dados = null;
  // Saúde das turmas ativas (acompanhamento acadêmico): carregada DEPOIS dos cards, sem a página esperar.
  let saudePorTurma = {}, avisouErroSaude = false;
  async function carregar() {
    try { dados = await carregarProfessor(sessao.uid, { comAlunos: true, comArquivadas: true }); desenhar(); }
    catch (e) { console.error(e); toast("Não foi possível carregar as turmas.", { tipo: "erro" }); return; }
    carregarSaude(dados);
  }
  async function carregarSaude(d) {
    try {
      const diag = await carregarDiagnosticoProfessor(d.turmas.map(x => x.t));
      if (d !== dados) return; // a lista foi recarregada nesse meio tempo
      saudePorTurma = Object.fromEntries(diag.turmas.map(x => [x.turma.id, x.resumo]));
      desenhar();
    } catch (e) {
      console.error(e);
      if (!avisouErroSaude) { avisouErroSaude = true; toast("Não foi possível carregar a situação dos alunos.", { tipo: "erro" }); }
    }
  }

  function desenhar() {
    if (!dados) return;
    const { turmas, arquivadas, atividadesParaCorrigir, msgsNaoLidas } = dados;
    const resumo = `${turmas.length} ${turmas.length === 1 ? "turma ativa" : "turmas ativas"} · ${arquivadas.length} ${arquivadas.length === 1 ? "arquivada" : "arquivadas"}`;
    topo.querySelector("h1").textContent = verArquivadas ? "Turmas arquivadas" : "Minhas turmas";
    topo.querySelector(".banner-topo p").textContent = verArquivadas ? "Somente leitura · atividades e notas continuam guardadas" : resumo;
    botaoAlternar.replaceChildren(...botaoBanner(verArquivadas ? "Ver ativas" : "Ver arquivadas", verArquivadas ? "turmas" : "arquivo").childNodes);
    topo.atualizar(0, String(turmas.length), turmas.length === 1 ? "Turma ativa" : "Turmas ativas");
    topo.atualizar(1, String(atividadesParaCorrigir.length));
    topo.atualizar(2, String(msgsNaoLidas));
    definirCabecalhoMovel(verArquivadas ? "Turmas arquivadas" : "Minhas turmas", resumo);
    definirContador("chat", msgsNaoLidas);
    painel.hidden = verArquivadas;

    const lista = verArquivadas ? arquivadas : turmas;
    if (!lista.length) {
      grade.replaceChildren(el("div", { class: "card", style: { gridColumn: "1 / -1" } }, el("div", { class: "vazio" },
        verArquivadas ? "Nenhuma turma arquivada." : "Você ainda não tem turmas. Crie a primeira no painel \"Nova turma\".")));
      return;
    }
    grade.replaceChildren(...lista.map(({ t, paraCorrigir = [], msgs = 0, alunos = 0, pedidos = [] }) => {
      const chips = [];
      if (t.arquivada) chips.push({ texto: "Arquivada", icone: "arquivo" });
      else {
        if (pedidos.length) chips.push({ texto: `${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} de entrada`, classe: "chip forte", icone: "pessoas" });
        const n = paraCorrigir.length;
        chips.push(n ? { texto: `${n} ${n === 1 ? "atividade para corrigir" : "atividades para corrigir"}`, classe: "chip contorno", icone: "check" }
                     : { texto: "Tudo corrigido", icone: "check" });
        if (msgs) chips.push({ texto: `${msgs} ${msgs === 1 ? "msg" : "msgs"}`, icone: "balao" });
        chips.push(...chipsSaudeDaTurma(saudePorTurma[t.id]));
      }
      return cardTurma({ turma: t, subtitulo: `${alunos} ${alunos === 1 ? "aluno" : "alunos"}`, chips, href: hrefTurma(t),
        classe: t.arquivada ? "arquivada" : "", aoMais: menuProfessor(sessao, t, sessao.nome, carregar) });
    }));
  }

  await carregar();
}
