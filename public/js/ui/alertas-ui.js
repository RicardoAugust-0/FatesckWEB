// Acompanhamento acadêmico — telas: card "Alunos que exigem atenção" + janela "Raio-X das Turmas" (professor),
// chips de saúde nos cards de turma, painel "Sua situação" no Início do aluno.
// Tudo montado com el() (dados do banco nunca viram HTML). Cores em css/acompanhamento.css;
// a cor nunca é o único sinal: todo selo tem ícone + texto.
import { el, abrirJanela, toast, esqueletoLinhas } from "./ui.js";
import { card, chip, comCorDaTurma } from "./componentes.js";
import { formatarMedia } from "../servicos/acompanhamento.js";
import { duracao } from "../utils/datas.js";
import { situacao } from "../utils/prazos.js";

// ---------- CSS próprio (carregado uma vez) ----------
function carregarCss() {
  if (document.getElementById("css-acompanhamento")) return;
  const base = document.body?.dataset?.base || "..";
  document.head.append(el("link", { id: "css-acompanhamento", rel: "stylesheet", href: `${base}/css/acompanhamento.css` }));
}
carregarCss();

// ---------- ícones (SVG fixo, sem dados do usuário) ----------
const SVG = {
  risco: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  atencao: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.2v.3"/>',
  regular: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7L16.2 9.5"/>',
  aguardando: '<path d="M7 3.5h10M7 20.5h10M8 3.5v3.2a4 4 0 0 0 1.6 3.2L12 12l2.4-2.1A4 4 0 0 0 16 6.7V3.5M8 20.5v-3.2a4 4 0 0 1 1.6-3.2L12 12l2.4 2.1a4 4 0 0 1 1.6 3.2v3.2"/>',
  raiox: '<path d="M4 20h16"/><path d="M7 17V11M12 17V6M17 17v-8"/><circle cx="12" cy="6" r="1.2"/>'
};
function iconeAcomp(nome) {
  const t = document.createElement("template");
  t.innerHTML = `<svg class="icone p" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SVG[nome] ?? ""}</svg>`;
  return t.content.firstChild;
}
const ICONE_NIVEL = { critico: "risco", atencao: "atencao", regular: "regular", sem_dados: "aguardando" };
const ROTULO_CURTO = { critico: "Risco", atencao: "Atenção", regular: "Regular", sem_dados: "Aguardando" };

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Selo do nível: ícone + texto (ex.: "⚠ Risco de reprovação")
export function seloNivel(nivel, rotulo) {
  return el("span", { class: `acomp-selo acomp-${nivel}` }, iconeAcomp(ICONE_NIVEL[nivel] || "aguardando"), rotulo);
}

// ======================= PROFESSOR =======================
const MOSTRAR = 5;

// Card enquanto carrega
export function cardAlunosEmAtencaoCarregando() {
  return card({ titulo: "Alunos que exigem atenção", classe: "acomp-card", corpo: esqueletoLinhas(3) });
}

// Card "Alunos que exigem atenção". diagnostico = resultado de carregarDiagnosticoProfessor (null = deu erro).
export function cardAlunosEmAtencao(sessao, diagnostico, { href }) {
  if (!diagnostico) {
    return card({ titulo: "Alunos que exigem atenção", classe: "acomp-card",
      corpo: el("div", { class: "vazio" }, "Não foi possível carregar o acompanhamento agora. Recarregue a página para tentar de novo.") });
  }
  const { turmas, alunosEmAlerta } = diagnostico;
  const nRisco = alunosEmAlerta.filter(a => a.nivel === "critico").length;
  const nAtencao = alunosEmAlerta.length - nRisco;

  const raioX = turmas.length ? el("button", { type: "button", class: "botao pequeno sec",
    onclick: () => janelaRaioXAcademico(diagnostico, { href }) }, iconeAcomp("raiox"), "Raio-X das Turmas") : null;
  const contador = alunosEmAlerta.length
    ? chip({ texto: `${alunosEmAlerta.length} em alerta`, classe: `chip acomp-chip acomp-${nRisco ? "critico" : "atencao"}` }) : null;
  const c = card({ titulo: "Alunos que exigem atenção", classe: "acomp-card",
    extra: el("div", { class: "acomp-cabeca-acoes" }, contador, raioX) });

  if (!turmas.length) {
    c.append(el("div", { class: "vazio" }, "Você não tem turmas ativas. O acompanhamento aparece aqui quando houver alunos."));
    return c;
  }
  if (!alunosEmAlerta.length) {
    c.append(el("div", { class: "vazio acomp-vazio-positivo" }, iconeAcomp("regular"), " Nenhum aluno em alerta nas turmas ativas."));
    return c;
  }

  // filtros rápidos
  let filtro = "todos", abertos = false;
  const opcoes = [
    { chave: "todos", texto: `Todos em alerta (${alunosEmAlerta.length})` },
    { chave: "critico", texto: `Risco de reprovação (${nRisco})` },
    { chave: "atencao", texto: `Em atenção (${nAtencao})` }
  ];
  const botoesFiltro = opcoes.map(o => el("button", { type: "button", class: "acomp-filtro", "aria-pressed": String(o.chave === filtro),
    onclick: () => { filtro = o.chave; abertos = false; pintar(); } }, o.texto));
  const barraFiltros = el("div", { class: "acomp-filtros", role: "group", "aria-label": "Filtrar alunos em alerta" }, botoesFiltro);
  const corpo = el("div", { class: "acomp-lista" });
  const verTodos = el("button", { type: "button", class: "botao pequeno neutro", onclick: () => { abertos = !abertos; pintar(); } });
  const rodape = el("div", { class: "card-rodape" }, el("span", {}), verTodos);

  function pintar() {
    botoesFiltro.forEach((b, i) => b.setAttribute("aria-pressed", String(opcoes[i].chave === filtro)));
    const lista = filtro === "todos" ? alunosEmAlerta : alunosEmAlerta.filter(a => a.nivel === filtro);
    const visiveis = abertos ? lista : lista.slice(0, MOSTRAR);
    corpo.replaceChildren(...(visiveis.length ? visiveis.map(d => linhaAluno(sessao, d, href))
      : [el("div", { class: "vazio" }, "Nenhum aluno neste filtro.")]));
    rodape.hidden = lista.length <= MOSTRAR;
    rodape.firstChild.textContent = abertos ? `Mostrando todos os ${lista.length}` : `Mostrando ${Math.min(MOSTRAR, lista.length)} de ${lista.length}`;
    verTodos.textContent = abertos ? "Mostrar menos" : `Ver todos (${lista.length})`;
  }
  pintar();
  c.append(barraFiltros, corpo, rodape);
  return c;
}

function linhaAluno(sessao, d, href) {
  const { aluno, turma } = d;
  const chamar = el("button", { type: "button", class: "botao pequeno" }, "Chamar no Chat");
  chamar.addEventListener("click", async () => {
    chamar.disabled = true;
    try {
      const { abrirConversa } = await import("../servicos/chat.js");
      const conversa = await abrirConversa({ uid: sessao.uid, nome: sessao.nome }, { uid: aluno.uid, nome: aluno.nome }, turma.id);
      location.href = href("chat") + "?abrir=conversa_" + encodeURIComponent(conversa.id);
    } catch (e) {
      console.error(e);
      chamar.disabled = false;
      toast("Não foi possível abrir a conversa com este aluno.", { tipo: "erro" });
    }
  });
  const media = d.mediaAluno === null ? "Sem notas publicadas" : `Média ${formatarMedia(d.mediaAluno)}`;
  return comCorDaTurma(el("div", { class: "linha acomp-linha" },
    el("div", { class: "linha-info" },
      el("span", { class: "linha-titulo" }, aluno.nome),
      el("span", { class: "mudo" }, `${turma.nome} · ${media}`),
      el("div", { class: "acomp-chips" }, seloNivel(d.nivel, d.rotulo),
        d.motivos.map(m => el("span", { class: "chip" }, m)))),
    el("div", { class: "linha-acoes" },
      chamar,
      el("a", { class: "botao pequeno sec", href: href("turma") + "?id=" + encodeURIComponent(turma.id) + "#alunos" }, "Ver turma"))), turma.cor);
}

// Janela "Raio-X das Turmas": uma linha por turma ativa com média e distribuição (com números escritos).
export function janelaRaioXAcademico(diagnostico, { href }) {
  const partes = [
    { chave: "regular", texto: n => plural(n, "regular", "regulares") },
    { chave: "atencao", texto: n => `${n} em atenção` },
    { chave: "critico", texto: n => `${n} em risco` },
    { chave: "sem_dados", texto: n => `${n} aguardando notas` }
  ];
  const linhas = diagnostico.turmas.map(({ turma, resumo }) => {
    const { contagem, total, mediaTurma } = resumo;
    const barra = el("div", { class: "acomp-barra", "aria-hidden": "true" },
      partes.filter(p => contagem[p.chave]).map(p => {
        const s = el("span", { class: `acomp-seg acomp-${p.chave}` });
        s.style.flexGrow = String(contagem[p.chave]);
        return s;
      }));
    const legenda = el("div", { class: "acomp-legenda" }, total
      ? partes.filter(p => contagem[p.chave]).map(p => el("span", { class: `acomp-leg acomp-${p.chave}` }, iconeAcomp(ICONE_NIVEL[p.chave]), p.texto(contagem[p.chave])))
      : el("span", { class: "mudo" }, "Nenhum aluno nesta turma."));
    return comCorDaTurma(el("div", { class: "linha acomp-raiox-linha" },
      el("div", { class: "linha-info acomp-raiox-info" },
        el("span", { class: "linha-titulo" }, turma.nome),
        el("span", { class: "mudo" }, `${mediaTurma === null ? "Sem notas publicadas" : `Média da turma ${formatarMedia(mediaTurma)}`} · ${plural(total, "aluno", "alunos")}`),
        total ? barra : null, legenda),
      el("div", { class: "linha-acoes" },
        el("a", { class: "botao pequeno sec", href: href("notas") }, "Ver notas"),
        el("a", { class: "botao pequeno neutro", href: href("turma") + "?id=" + encodeURIComponent(turma.id) + "#alunos" }, "Ver turma"))), turma.cor);
  });
  const j = abrirJanela({ titulo: "Raio-X das Turmas", classe: "grande",
    conteudo: [el("p", { class: "mudo" }, "Média das notas publicadas e situação dos alunos em cada turma ativa."),
      el("div", { class: "acomp-raiox" }, linhas.length ? linhas : el("div", { class: "vazio" }, "Nenhuma turma ativa."))],
    acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Fechar")] });
  return j;
}

// Chips de saúde para o card da turma (configs para cardTurma).
export function chipsSaudeDaTurma(resumo) {
  if (!resumo) return [];
  const { mediaTurma, contagem } = resumo;
  const chips = [{ texto: mediaTurma === null ? "Sem notas publicadas" : `Média ${formatarMedia(mediaTurma)}`, icone: "notas" }];
  if (contagem.critico) chips.push({ texto: `${contagem.critico} em risco`, classe: "chip acomp-chip acomp-critico" });
  if (contagem.atencao) chips.push({ texto: `${contagem.atencao} em atenção`, classe: "chip acomp-chip acomp-atencao" });
  if (!contagem.critico && !contagem.atencao && contagem.regular) chips.push({ texto: "Turma regular", classe: "chip acomp-chip acomp-regular", icone: "check" });
  return chips;
}

// ======================= ALUNO =======================
// Chip do card da turma do aluno: só quando já há nota publicada visível.
const TEXTO_CHIP_ALUNO = { critico: "em risco", atencao: "atenção", regular: "em dia", sem_dados: "em dia" };
export function chipSituacaoNaTurma(itemTurma) {
  if (!itemTurma?.temNota) return null;
  const d = itemTurma.diagnostico, nivel = d.nivel === "sem_dados" ? "regular" : d.nivel;
  return { texto: `Média ${formatarMedia(d.mediaAluno)} · ${TEXTO_CHIP_ALUNO[d.nivel]}`, classe: `chip acomp-chip acomp-${nivel}`, icone: "notas" };
}

export function painelSituacaoAlunoCarregando() {
  return el("section", { class: "acomp-painel", "aria-label": "Sua situação", "aria-busy": "true" }, esqueletoLinhas(1));
}

const MOSTRAR_ALERTAS = 4;
// Painel "Sua situação" logo abaixo do banner do Início do aluno.
export function painelSituacaoAluno(resumoAluno, { href, agora = Date.now() }) {
  const alertas = [];   // { nivel, texto }
  const urgentes = [];  // atividades não entregues, para o botão "Entregar atividade"
  for (const { turma, diagnostico: d } of resumoAluno.turmas) {
    if (d.mediaAluno !== null && d.mediaAluno < 6) alertas.push({ nivel: d.mediaAluno < 5 ? "critico" : "atencao",
      texto: `Média ${formatarMedia(d.mediaAluno)} em ${turma.nome} (meta 6,0)` });
    for (const a of d.atividades.vencendo) {
      alertas.push({ nivel: "atencao", texto: `"${a.titulo}" fecha em ${duracao(situacao(a, agora).restante)} · ${turma.nome}` });
      urgentes.push(a);
    }
    for (const a of d.atividades.emTolerancia) {
      alertas.push({ nivel: "atencao", texto: `"${a.titulo}" passou do prazo, ainda aceita entrega por ${duracao(situacao(a, agora).restante)} · ${turma.nome}` });
      urgentes.push(a);
    }
    for (const a of d.atividades.naoEntregues) alertas.push({ nivel: d.nivel === "critico" ? "critico" : "atencao",
      texto: `"${a.titulo}" encerrou sem entrega · ${turma.nome}` });
  }
  alertas.sort((a, b) => (a.nivel === "critico" ? 0 : 1) - (b.nivel === "critico" ? 0 : 1));
  urgentes.sort((a, b) => situacao(a, agora).ate - situacao(b, agora).ate);

  const maisUrgente = urgentes[0];
  const botoes = el("div", { class: "acomp-painel-acoes" },
    el("a", { class: "botao pequeno", href: maisUrgente ? href("atividades") + "#" + encodeURIComponent(maisUrgente.turmaId + "/" + maisUrgente.id) : href("atividades") }, "Entregar atividade"),
    el("a", { class: "botao pequeno sec", href: href("notas") }, "Ver minhas notas"),
    el("a", { class: "botao pequeno neutro", href: href("chat") }, "Falar com professor"));

  if (alertas.length) {
    const nivel = alertas.some(a => a.nivel === "critico") ? "critico" : "atencao";
    const resto = alertas.length - MOSTRAR_ALERTAS;
    return el("section", { class: `acomp-painel acomp-painel-${nivel}`, "aria-label": "Sua situação" },
      el("div", { class: "acomp-painel-topo" },
        seloNivel(nivel, nivel === "critico" ? "Risco de reprovação" : "Exige atenção"),
        el("span", { class: "mudo" }, plural(alertas.length, "alerta", "alertas"))),
      el("ul", { class: "acomp-alertas" }, alertas.slice(0, MOSTRAR_ALERTAS).map(a =>
        el("li", { class: `acomp-${a.nivel}` }, iconeAcomp(ICONE_NIVEL[a.nivel]), el("span", {}, a.texto)))),
      resto > 0 ? el("p", { class: "mudo acomp-mais" }, `e mais ${plural(resto, "alerta", "alertas")}`) : null,
      botoes);
  }
  if (resumoAluno.mediaGeral !== null) {
    return el("section", { class: "acomp-painel acomp-painel-regular", "aria-label": "Sua situação" },
      el("div", { class: "acomp-painel-topo" },
        seloNivel("regular", `Tudo em dia · média geral ${formatarMedia(resumoAluno.mediaGeral)}`),
        el("span", { class: "mudo" }, "Continue assim!")),
      botoes);
  }
  return el("section", { class: "acomp-painel acomp-painel-sem_dados", "aria-label": "Sua situação" },
    el("div", { class: "acomp-painel-topo" },
      seloNivel("sem_dados", "Aguardando avaliações"),
      el("span", { class: "mudo" }, "Sua média aparece aqui quando o professor publicar as notas.")),
    botoes);
}
