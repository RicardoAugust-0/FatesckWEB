// Início do professor (rascunho aprovado pelo Fernando na Fase 3):
// banner com 3 blocos -> "Atividades para corrigir" (as 5 mais antigas) + "Avisos recentes" (turmas + curso).
import { el, esqueletoLinhas } from "../ui/ui.js";
import { quando, ms } from "../utils/datas.js";
import { banner, botaoBanner, card, chip, itemAviso, primeiroNome, comCorDaTurma } from "../ui/componentes.js";
import { avisosDaTurma, avisosDoCurso, idsRepresentantes, minhasLeituras } from "../servicos/dados.js";
import { carregarProfessor } from "./professor-comum.js";

const MOSTRAR = 5;

export async function montar({ sessao, conteudo, href, definirCabecalhoMovel, definirContador }) {
  const nome = primeiroNome(sessao.nome);
  definirCabecalhoMovel(`Olá, ${nome}`, "Carregando…");

  const topo = banner({
    titulo: `Olá, ${nome}`,
    acao: botaoBanner("Minhas turmas", "turmas", { href: href("turmas") }),
    blocos: ["Turmas ativas", "Atividades para corrigir", "Mensagens não lidas"]
  });
  const corrigirCard = card({ titulo: "Atividades para corrigir", classe: "lista-cards", corpo: esqueletoLinhas(3) });
  const avisosCard = card({ titulo: "Avisos recentes", corpo: esqueletoLinhas(2) });
  conteudo.replaceChildren(topo,
    el("h2", { class: "so-movel cabeca-secao", style: { margin: "18px 0 10px" } }, "Atividades para corrigir"),
    el("div", { class: "grade-inicio" }, corrigirCard, avisosCard));

  const uid = sessao.uid;
  const [dados, leituras, avisosCurso, representantes] = await Promise.all([
    carregarProfessor(uid), minhasLeituras(uid), avisosDoCurso(5), idsRepresentantes()
  ]);
  const { turmas, atividadesParaCorrigir, msgsNaoLidas } = dados;
  const turmasPorId = Object.fromEntries(turmas.map(x => [x.t.id, x.t]));
  const avisosTurmas = (await Promise.all(turmas.map(x => avisosDaTurma(x.t.id, 5)))).flat();

  // ----- resumo -----
  const lista = [...atividadesParaCorrigir].sort((a, b) => ms(a.prazo) - ms(b.prazo));
  topo.atualizar(0, String(turmas.length), turmas.length === 1 ? "Turma ativa" : "Turmas ativas");
  topo.atualizar(1, String(lista.length));
  topo.atualizar(2, String(msgsNaoLidas));
  definirCabecalhoMovel(`Olá, ${nome}`, lista.length
    ? `${lista.length} ${lista.length === 1 ? "atividade" : "atividades"} para corrigir`
    : "Tudo corrigido");
  definirContador("chat", msgsNaoLidas);

  // ----- atividades para corrigir (as 5 mais antigas) -----
  const cabeca = corrigirCard.querySelector(".card-cabeca");
  const resto = Math.max(0, lista.length - MOSTRAR);
  const linhas = lista.length ? lista.slice(0, MOSTRAR).map(a => comCorDaTurma(el("div", { class: "linha" },
    el("div", { class: "linha-info" },
      el("span", { class: "linha-titulo" }, a.titulo),
      el("span", { class: "mudo" }, `${a.turmaNome} · prazo ${quando(a.prazo)}`)),
    el("div", { class: "linha-acoes" },
      chip({ texto: `${a.pendentes} ${a.pendentes === 1 ? "entrega para corrigir" : "entregas para corrigir"}`, classe: "chip contorno", icone: "check" }),
      el("a", { class: "botao", href: href("atividades") + "#" + encodeURIComponent(a.turmaId + "/" + a.id) }, "Corrigir"))), a.turmaCor))
    : [el("div", { class: "vazio" }, turmas.length ? "Tudo corrigido. Nenhuma entrega esperando correção." : "Você ainda não tem turmas. Crie a primeira em \"Minhas turmas\".")];
  const rodape = lista.length ? el("div", { class: "card-rodape" },
    el("span", {}, `Mostrando as ${Math.min(MOSTRAR, lista.length)} mais antigas${resto ? ` · mais ${resto}` : ""}`),
    el("a", { class: "botao sec", href: href("atividades") }, "Ver todas as atividades")) : null;
  corrigirCard.replaceChildren(cabeca, ...linhas, ...(rodape ? [rodape] : []));

  // ----- avisos recentes (turmas + curso) -----
  const vistoAvisos = a => a.curso ? leituras.curso_avisos : leituras[`turma_${a.turmaId}_avisos`];
  const avisos = [...avisosCurso, ...avisosTurmas].sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm));
  const novos = avisos.filter(a => a.autorUid !== uid && ms(a.criadoEm) > (vistoAvisos(a) || 0));
  const cabecaAvisos = avisosCard.querySelector(".card-cabeca");
  if (novos.length) cabecaAvisos.append(chip({ texto: `${novos.length} ${novos.length === 1 ? "novo" : "novos"}`, classe: "chip forte" }));
  avisosCard.replaceChildren(cabecaAvisos, ...(avisos.length ? avisos.slice(0, 4).map(a => itemAviso(a, representantes, turmasPorId))
    : [el("div", { class: "vazio" }, "Nenhum aviso por enquanto.")]));
  definirContador("avisos", novos.length);
}
