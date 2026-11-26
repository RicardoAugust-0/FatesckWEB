// "Atividades" do aluno (Fase 5): todas as atividades das turmas ativas, com filtro por turma.
// "Para entregar" (a que fecha antes no topo) e "Entregues e encerradas" (recibo + "Desfazer · 2h 10min").
// Com #turmaId/atividadeId no endereço (botão "Entregar" do Início), a janela de entrega abre sozinha.
import { el, esqueletoLinhas } from "../ui/ui.js";
import { card } from "../ui/componentes.js";
import { duracao } from "../utils/datas.js";
import { situacao, ordenarAtividades } from "../utils/prazos.js";
import { minhasTurmas, atividadesDaTurma, minhaEntrega } from "../servicos/dados.js";
import { linhaAtividadeAluno, janelaEntrega } from "../ui/atividades-ui.js";
import { marcarVisto } from "../servicos/avisos.js";

export async function montar({ sessao, conteudo, definirCabecalhoMovel }) {
  definirCabecalhoMovel("Atividades", "Carregando…");
  const filtro = el("select", { id: "filtro-turma", "aria-label": "Filtrar por turma" }, el("option", { value: "" }, "Todas as turmas"));
  const pendentesCard = card({ titulo: "Para entregar", classe: "lista-cards", extra: el("div", { class: "campo campo-filtro so-desktop" }, filtro), corpo: esqueletoLinhas(3) });
  const feitasCard = card({ titulo: "Entregues e encerradas", classe: "lista-cards", corpo: esqueletoLinhas(2) });
  const filtroMovel = el("div", { class: "so-movel filtro-movel" });
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Atividades"), filtroMovel, pendentesCard,
    el("h2", { class: "so-movel cabeca-secao" }, "Entregues e encerradas"), el("div", { style: { marginTop: "22px" } }, feitasCard));

  const turmas = (await minhasTurmas(sessao.uid)).filter(t => t.meuPapel === "aluno" && !t.arquivada);
  let atividades = [];
  async function carregar() {
    atividades = (await Promise.all(turmas.map(async t => {
      const lista = await atividadesDaTurma(t.id);
      const entregas = await Promise.all(lista.map(a => minhaEntrega(t.id, a.id, sessao.uid)));
      return lista.map((a, i) => ({ ...a, turmaNome: t.nome, turmaCor: t.cor, entrega: entregas[i] }));
    }))).flat();
  }
  await carregar();

  filtro.append(...turmas.map(t => el("option", { value: t.id }, t.nome)));
  const fm = filtro.cloneNode(true); fm.id = "filtro-turma-movel";
  filtroMovel.append(el("div", { class: "campo" }, el("label", { for: fm.id }, "Turma"), fm));
  fm.addEventListener("change", () => { filtro.value = fm.value; pintar(); });
  filtro.addEventListener("change", () => { fm.value = filtro.value; pintar(); });

  const recarregar = async () => { await carregar(); pintar(); };
  function pintar() {
    const escolhidas = ordenarAtividades(atividades.filter(a => !filtro.value || a.turmaId === filtro.value));
    const pendentes = escolhidas.filter(a => !a.entrega && situacao(a).estado !== "encerrada");
    const feitas = escolhidas.filter(a => a.entrega || situacao(a).estado === "encerrada")
      .sort((a, b) => (b.entrega?.entregueEm?.toMillis?.() || 0) - (a.entrega?.entregueEm?.toMillis?.() || 0));
    const linha = a => linhaAtividadeAluno(sessao, a, { mostrarTurma: true, aoMudar: recarregar });
    const vazio = t => el("div", { class: "vazio" }, t);
    pendentesCard.replaceChildren(pendentesCard.querySelector(".card-cabeca"), ...(pendentes.length ? pendentes.map(linha)
      : [vazio(turmas.length ? "Nenhuma atividade para entregar. Tudo em dia!" : "Você ainda não está em nenhuma turma. Entre com o código da turma.")]));
    feitasCard.replaceChildren(feitasCard.querySelector(".card-cabeca"), ...(feitas.length ? feitas.map(linha) : [vazio("Nada por aqui ainda.")]));
    const proxima = pendentes[0];
    definirCabecalhoMovel("Atividades", pendentes.length
      ? `${pendentes.length} para entregar · a próxima fecha em ${duracao(situacao(proxima).restante)}` : "Nenhuma para entregar");
  }
  pintar();
  setInterval(pintar, 60000); // contagens regressivas
  // abrir a página marca as atividades novas de todas as turmas como vistas (o número do menu some)
  await marcarVisto(sessao.uid, turmas.map(t => `turma_${t.id}_atividades`));

  // veio do "Entregar" do Início: abre a janela daquela atividade
  const abrirDoEndereco = () => {
    const [t, a] = decodeURIComponent(location.hash.slice(1)).split("/");
    const at = atividades.find(x => x.turmaId === t && x.id === a);
    if (at) { history.replaceState(null, "", location.pathname + location.search); janelaEntrega(sessao, at, { aoMudar: recarregar }); }
  };
  abrirDoEndereco();
  window.addEventListener("hashchange", abrirDoEndereco);
}
