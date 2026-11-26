// "Turmas" do aluno (aprovado na Fase 4: mesmo banner de "Minhas turmas"; "Ver arquivadas" troca a lista).
import { el, esqueletoTurmas, toast } from "../ui/ui.js";
import { banner, botaoBanner, cardTurma } from "../ui/componentes.js";
import { minhasTurmas, professoresDaTurma, meusPedidos } from "../servicos/dados.js";
import { janelaEntrar, menuAluno } from "../ui/turmas-ui.js";
import { cardPedido } from "./aluno-comum.js";

export async function montar({ sessao, conteudo, href, definirCabecalhoMovel }) {
  let verArquivadas = location.hash === "#arquivadas";
  const hrefTurma = t => href("turma") + "?id=" + encodeURIComponent(t.id);
  const botaoEntrar = botaoBanner("Entrar em uma turma", "chave", { onclick: () => janelaEntrar(sessao, carregar) });
  const botaoAlternar = botaoBanner("Ver arquivadas", "arquivo");
  const topo = banner({ titulo: "Minhas turmas", subtitulo: "Carregando…",
    acao: el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } }, botaoEntrar, botaoAlternar),
    blocos: ["Turmas ativas", "Pedidos aguardando aprovação", "Turmas arquivadas"] });
  const grade = el("div", { class: "grade-turmas", style: { marginTop: "24px" } }, esqueletoTurmas(4));
  // celular: o banner some, então os botões aparecem acima da lista
  const acoesMovel = el("div", { class: "so-movel", style: { display: "grid", gap: "10px", marginTop: "16px" } },
    el("button", { type: "button", class: "botao", onclick: () => janelaEntrar(sessao, carregar) }, "Entrar em uma turma"),
    el("button", { type: "button", class: "botao sec", onclick: () => botaoAlternar.click() }, "Ver arquivadas"));
  conteudo.replaceChildren(topo, acoesMovel, grade);

  botaoAlternar.addEventListener("click", () => {
    verArquivadas = !verArquivadas;
    history.replaceState(null, "", verArquivadas ? "#arquivadas" : location.pathname);
    desenhar();
  });

  let turmas = [], pedidos = [], profs = {};
  async function carregar() {
    try {
      const [ts, ps] = await Promise.all([minhasTurmas(sessao.uid), meusPedidos(sessao.uid)]);
      turmas = ts.filter(t => t.meuPapel === "aluno");
      pedidos = ps;
      const listas = await Promise.all(turmas.map(t => professoresDaTurma(t.id)));
      profs = Object.fromEntries(turmas.map((t, i) => [t.id, listas[i].map(p => p.nome).join(", ")]));
      desenhar();
    } catch (e) { console.error(e); toast("Não foi possível carregar as turmas.", { tipo: "erro" }); }
  }

  function desenhar() {
    const ativas = turmas.filter(t => !t.arquivada), arquivadas = turmas.filter(t => t.arquivada);
    const aguardando = pedidos.filter(p => p.status === "pendente").length;
    topo.querySelector("h1").textContent = verArquivadas ? "Turmas arquivadas" : "Minhas turmas";
    topo.querySelector(".banner-topo p").textContent = verArquivadas
      ? "Somente leitura: você ainda consulta atividades e notas."
      : `${ativas.length} ${ativas.length === 1 ? "turma" : "turmas"}${aguardando ? ` · ${aguardando} ${aguardando === 1 ? "pedido aguardando" : "pedidos aguardando"}` : ""}`;
    botaoAlternar.replaceChildren(...botaoBanner(verArquivadas ? "Ver ativas" : "Ver arquivadas", verArquivadas ? "turmas" : "arquivo").childNodes);
    acoesMovel.lastChild.textContent = verArquivadas ? "Ver ativas" : "Ver arquivadas";
    botaoEntrar.hidden = verArquivadas;
    topo.atualizar(0, String(ativas.length)); topo.atualizar(1, String(aguardando)); topo.atualizar(2, String(arquivadas.length));
    definirCabecalhoMovel(verArquivadas ? "Turmas arquivadas" : "Minhas turmas",
      verArquivadas ? "Somente leitura" : `${ativas.length} ${ativas.length === 1 ? "turma" : "turmas"}`);

    const cards = verArquivadas
      ? arquivadas.map(t => cardTurma({ turma: t, subtitulo: profs[t.id], chips: [{ texto: "Arquivada", icone: "arquivo" }], href: hrefTurma(t), classe: "arquivada" }))
      : [...pedidos.map(p => cardPedido(sessao, p, carregar)),
         ...ativas.map(t => cardTurma({ turma: t, subtitulo: profs[t.id] || "Sem professor", href: hrefTurma(t), aoMais: menuAluno(t, hrefTurma(t)) }))];
    grade.replaceChildren(...(cards.length ? cards : [el("div", { class: "card", style: { gridColumn: "1 / -1" } }, el("div", { class: "vazio" },
      verArquivadas ? "Nenhuma turma arquivada." : "Você ainda não está em nenhuma turma. Entre com o código da turma."))]));
  }

  await carregar();
}
