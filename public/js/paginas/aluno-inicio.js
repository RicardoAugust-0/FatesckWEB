// Início do aluno (prévia: telas 1 a 4).
// Banner com 3 blocos -> "Atividades pendentes" (só as 3 que fecham primeiro) + "Avisos recentes" -> cards das turmas.
import { el, esqueletoLinhas, esqueletoTurmas } from "../ui/ui.js";
import { janelaEntrar, menuAluno } from "../ui/turmas-ui.js";
import { cardPedido } from "./aluno-comum.js";
import { iconeEl } from "../ui/icones.js";
import { quando, duracao, ms } from "../utils/datas.js";
import { chipDePrazo, situacao } from "../utils/prazos.js";
import { banner, botaoBanner, card, cabecaSecao, cardTurma, chip, itemAviso, primeiroNome, rotuloPapel, comCorDaTurma } from "../ui/componentes.js";
import {
  minhasTurmas, professoresDaTurma, atividadesDaTurma, minhaEntrega, minhasLeituras, avisosDaTurma, avisosDoCurso,
  idsRepresentantes, naoLidasDaTurma, naoLidasPrivadas, meusPedidos
} from "../servicos/dados.js";
import { carregarDiagnosticoAluno, resumirAluno } from "../servicos/acompanhamento.js";
import { painelSituacaoAluno, painelSituacaoAlunoCarregando, chipSituacaoNaTurma } from "../ui/alertas-ui.js";

const MOSTRAR = 3;        // computador: as 3 que fecham primeiro (prévia, tela 1)
const MOSTRAR_MOVEL = 2;  // celular: as 2 primeiras + "Ver todas as atividades (+N)" (prévia, tela 3)

export async function montar({ sessao, conteudo, href, definirCabecalhoMovel, definirContador }) {
  const nome = primeiroNome(sessao.nome);
  definirCabecalhoMovel(`Olá, ${nome}`, "Carregando…");

  // ----- esqueleto da página (aparece na hora) -----
  const topo = banner({
    titulo: `Olá, ${nome}`,
    acao: botaoBanner("Entrar em uma turma", "chave", { onclick: () => janelaEntrar(sessao, () => location.reload()) }),
    blocos: ["Atividades abertas", "Próxima a fechar", "Novidades"]
  });
  const avisoMovel = el("div", { class: "so-movel" });
  // Acompanhamento acadêmico: painel "Sua situação" logo abaixo do banner (computador e celular).
  let painel = painelSituacaoAlunoCarregando();
  const pendentesCard = card({ titulo: "Atividades pendentes", classe: "lista-cards", corpo: esqueletoLinhas(3) });
  const avisosCard = card({ titulo: "Avisos recentes", classe: "so-desktop", corpo: esqueletoLinhas(2) });
  const grade = el("div", { class: "grade-turmas" }, esqueletoTurmas(4));
  conteudo.replaceChildren(
    topo, painel, avisoMovel,
    el("h2", { class: "so-movel cabeca-secao", style: { margin: "18px 0 10px" } }, "Atividades pendentes"),
    el("div", { class: "grade-inicio" }, pendentesCard, avisosCard),
    cabecaSecao("Minhas turmas", el("a", { class: "link-simples", href: href("turmas") }, "Ver todas")),
    grade);

  // ----- dados -----
  const uid = sessao.uid;
  const [turmasTodas, leituras, avisosCurso, representantes, pedidos] = await Promise.all([
    minhasTurmas(uid), minhasLeituras(uid), avisosDoCurso(5), idsRepresentantes(), meusPedidos(uid)
  ]);
  const turmas = turmasTodas.filter(t => !t.arquivada && t.meuPapel === "aluno");
  const turmasPorId = Object.fromEntries(turmas.map(t => [t.id, t]));

  const porTurma = await Promise.all(turmas.map(async t => {
    const [atividades, profs, avisos, msgs] = await Promise.all([
      atividadesDaTurma(t.id), professoresDaTurma(t.id), avisosDaTurma(t.id, 5), naoLidasDaTurma(t.id, uid, leituras[`turma_${t.id}_chat`])
    ]);
    const entregas = await Promise.all(atividades.map(a => minhaEntrega(t.id, a.id, uid)));
    return { t, atividades: atividades.map((a, i) => ({ ...a, entrega: entregas[i], turmaNome: t.nome, turmaCor: t.cor })), profs, avisos, msgs };
  }));
  // Diagnóstico do aluno: reaproveita as atividades (com a própria entrega) já carregadas acima; roda em paralelo.
  // Se falhar, o painel some e o resto da página continua normal.
  let situacaoAluno = null;
  const trocarPainel = novo => { painel.replaceWith(novo); painel = novo; };
  const pDiagnostico = carregarDiagnosticoAluno(uid, porTurma.map(p => ({ turma: p.t, atividades: p.atividades })))
    .catch(e => { console.error(e); return null; });
  const msgsPrivadas = await naoLidasPrivadas(uid, leituras);

  // ----- cálculos -----
  const vistoAvisos = a => a.curso ? leituras.curso_avisos : leituras[`turma_${a.turmaId}_avisos`];
  const avisos = [...avisosCurso, ...porTurma.flatMap(p => p.avisos)].sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm));
  const avisosNovos = avisos.filter(a => a.autorUid !== uid && ms(a.criadoEm) > (vistoAvisos(a) || 0));
  const msgsNaoLidas = porTurma.reduce((s, p) => s + p.msgs, 0) + msgsPrivadas;

  const pendentes = () => porTurma.flatMap(p => p.atividades)
    .filter(a => !a.entrega && situacao(a).estado !== "encerrada")
    .sort((a, b) => situacao(a).ate - situacao(b).ate);

  // ----- banner, cabeçalho do celular e contadores do menu -----
  function atualizarResumo() {
    const lista = pendentes(), proxima = lista[0];
    topo.atualizar(0, String(lista.length), lista.length === 1 ? "Atividade aberta" : "Atividades abertas");
    topo.atualizar(1, proxima ? duracao(situacao(proxima).restante) : "—", proxima ? "Próxima a fechar" : "Nenhuma para fechar");
    const partes = [];
    if (msgsNaoLidas) partes.push(`${msgsNaoLidas} ${msgsNaoLidas === 1 ? "msg" : "msgs"}`);
    if (avisosNovos.length) partes.push(`${avisosNovos.length} ${avisosNovos.length === 1 ? "aviso" : "avisos"}`);
    topo.atualizar(2, String(msgsNaoLidas + avisosNovos.length), partes.length ? `Novidades (${partes.join(", ")})` : "Novidades");
    definirCabecalhoMovel(`Olá, ${nome}`, lista.length
      ? `${lista.length} ${lista.length === 1 ? "aberta" : "abertas"} · a próxima fecha em ${duracao(situacao(proxima).restante)}`
      : "Nenhuma atividade pendente");
  }

  // ----- atividades pendentes (as 3 que fecham primeiro) -----
  function linhaAtividade(a) {
    const c = chipDePrazo(a), atrasada = c.s.estado === "atrasada";
    return comCorDaTurma(el("div", { class: "linha" },
      el("div", { class: "linha-info" },
        el("span", { class: "linha-titulo" }, a.titulo),
        el("span", { class: "mudo" }, `${a.turmaNome} · prazo ${quando(a.prazo)}${atrasada ? " (passou)" : ""}`),
        atrasada ? el("span", { class: "alerta-texto" }, "Será sinalizada como atrasada para o professor") : null),
      el("div", { class: "linha-acoes" },
        chip({ texto: c.texto, curto: c.curto, classe: c.classe, icone: "relogio" }),
        el("a", { class: "botao", href: href("atividades") + "#" + encodeURIComponent(a.turmaId + "/" + a.id) }, "Entregar"))), a.turmaCor);
  }
  function desenharPendentes() {
    const lista = pendentes(), resto = Math.max(0, lista.length - MOSTRAR), restoMovel = Math.max(0, lista.length - MOSTRAR_MOVEL);
    const cabeca = pendentesCard.querySelector(".card-cabeca");
    cabeca.querySelector(".chip")?.remove();
    cabeca.append(chip({ texto: `${lista.length} ${lista.length === 1 ? "aberta" : "abertas"}` }));
    const linhas = lista.length
      ? lista.slice(0, MOSTRAR).map((a, i) => { const l = linhaAtividade(a); if (i >= MOSTRAR_MOVEL) l.classList.add("so-desktop"); return l; })
      : [el("div", { class: "vazio" }, turmas.length ? "Nenhuma atividade pendente. Tudo em dia!" : "Você ainda não está em nenhuma turma. Entre com o código da turma.")];
    const rodape = lista.length ? el("div", { class: "card-rodape" },
      el("span", {}, `Mostrando as ${Math.min(MOSTRAR, lista.length)} que fecham primeiro${resto ? ` · mais ${resto} ${resto === 1 ? "aberta" : "abertas"}` : ""}`),
      el("a", { class: "botao sec", href: href("atividades") }, el("span", { class: "so-desktop" }, "Ver todas as atividades"),
        el("span", { class: "so-movel" }, `Ver todas as atividades${restoMovel ? ` (+${restoMovel})` : ""}`))) : null;
    pendentesCard.replaceChildren(cabeca, ...linhas, ...(rodape ? [rodape] : []));
  }

  // ----- avisos -----
  function desenharAvisos() {
    const cabeca = avisosCard.querySelector(".card-cabeca");
    if (avisosNovos.length) cabeca.append(chip({ texto: `${avisosNovos.length} ${avisosNovos.length === 1 ? "novo" : "novos"}`, classe: "chip forte" }));
    avisosCard.replaceChildren(cabeca, ...(avisos.length ? avisos.slice(0, 4).map(a => itemAviso(a, representantes, turmasPorId))
      : [el("div", { class: "vazio" }, "Nenhum aviso por enquanto.")]));
    // celular: só o aviso novo mais recente, no topo
    const novo = avisosNovos[0];
    avisoMovel.replaceChildren(...(novo ? [el("a", { class: "card aviso-movel", href: href("avisos") },
      el("div", { class: "card-corpo", style: { display: "flex", gap: "12px", padding: "14px 16px" } },
        el("span", { style: { color: "var(--accentText)", marginTop: "2px" } }, iconeEl("avisos")),
        el("div", {},
          el("div", { class: "aviso-movel-titulo" },
            `AVISO NOVO · ${novo.autorNome} · ${rotuloPapel(novo.autorPapel, novo.autorUid, representantes)}`),
          el("p", { style: { marginTop: "2px" } }, novo.texto))))] : []));
  }

  // ----- turmas -----
  function desenharTurmas() {
    const hrefTurma = t => href("turma") + "?id=" + encodeURIComponent(t.id);
    const cardsPedidos = pedidos.map(p => cardPedido(sessao, p, () => location.reload()));
    if (!turmas.length && !cardsPedidos.length) {
      grade.replaceChildren(el("div", { class: "card", style: { gridColumn: "1 / -1" } },
        el("div", { class: "vazio" }, "Você ainda não está em nenhuma turma. Entre com o código da turma.")));
      return;
    }
    grade.replaceChildren(...cardsPedidos, ...porTurma.map(({ t, atividades, profs, msgs }) => {
      const vistoAtv = leituras[`turma_${t.id}_atividades`] || 0;
      const novas = atividades.filter(a => ms(a.criadoEm) > vistoAtv).length;
      const chips = [];
      if (novas) chips.push({ texto: `${novas} ${novas === 1 ? "nova atividade" : "novas atividades"}`, classe: "chip contorno" });
      if (msgs) chips.push({ texto: `${msgs} ${msgs === 1 ? "msg" : "msgs"}`, icone: "balao" });
      if (!chips.length) chips.push({ texto: "Em dia", icone: "check" });
      const chipMedia = chipSituacaoNaTurma(situacaoAluno?.turmas.find(x => x.turma.id === t.id));
      if (chipMedia) chips.push(chipMedia);
      return cardTurma({ turma: t, subtitulo: profs.map(p => p.nome).join(", ") || "Sem professor", chips,
        href: hrefTurma(t), aoMais: menuAluno(t, hrefTurma(t)) });
    }));
    definirContador("atividades", porTurma.reduce((s, p) => s + p.atividades.filter(a => ms(a.criadoEm) > (leituras[`turma_${p.t.id}_atividades`] || 0)).length, 0));
  }

  atualizarResumo(); desenharPendentes(); desenharAvisos(); desenharTurmas();
  definirContador("chat", msgsNaoLidas);
  definirContador("avisos", avisosNovos.length);

  // painel "Sua situação" + chip da própria média nos cards das turmas
  function desenharPainel() {
    if (!situacaoAluno) return;
    if (!turmas.length) { trocarPainel(el("div", { hidden: true })); return; }
    try { trocarPainel(painelSituacaoAluno(situacaoAluno, { href })); }
    catch (e) { console.error(e); trocarPainel(el("div", { hidden: true })); }
  }
  pDiagnostico.then(r => {
    if (!r) { trocarPainel(el("div", { hidden: true })); return; }
    situacaoAluno = r;
    desenharPainel(); desenharTurmas();
  });

  // contagem regressiva: atualiza a cada minuto (o painel recalcula com a hora nova, sem buscar dados de novo)
  setInterval(() => {
    atualizarResumo(); desenharPendentes();
    if (situacaoAluno) { situacaoAluno = { base: situacaoAluno.base, ...resumirAluno(situacaoAluno.base, Date.now()) }; desenharPainel(); }
  }, 60000);
}
