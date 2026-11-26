// Peças de tela das atividades (Fase 5), usadas na página da turma e na página "Atividades".
// Decisões do Fernando: criar/editar e entregar em JANELA por cima; "Ver entregas" abre a tela da atividade.
import { el, abrirJanela, abrirMenu, toast, mensagem, confirmar, guardado } from "./ui.js";
import { iconeEl } from "./icones.js";
import { chip, comCorDaTurma } from "./componentes.js";
import { quando, diaMesHora, dataHora, duracao, msDeCampos, camposDeMs, ms } from "../utils/datas.js";
import { chipDePrazo, situacao, limiteDeEntrega, restanteParaDesfazer, lerNotaMaxima, linkValido, LIMITES, chaveRascunho } from "../utils/prazos.js";
import {
  criarAtividade, editarAtividade, estenderPrazo, reabrirEntrega, apagarAtividade, entregar, desfazerMinhaEntrega
} from "../servicos/atividades.js";
import { mensagemDeErro } from "../core/auth.js";

const HORA = 3600e3;

// Endereço de uma atividade na página "Atividades": professor -> tela da atividade; aluno -> abre a janela de entrega.
export const hrefAtividade = (href, turmaId, atividadeId) => href("atividades") + "#" + encodeURIComponent(turmaId + "/" + atividadeId);
let seq = 0;
const novoIdCampo = p => `${p}-${++seq}`;

// Campo com rótulo. tipo "textarea" vira <textarea>.
function campo(rotulo, props = {}, tipo = "input", dica) {
  const id = novoIdCampo("cmp");
  const entrada = el(tipo, { id, ...props });
  const no = el("div", { class: "campo" }, el("label", { for: id }, rotulo), entrada, dica ? el("span", { class: "dica-campo" }, dica) : null);
  return { no, entrada };
}
// Data + hora (horário de Brasília). Hora padrão 23:59.
function campoPrazo(rotulo, valorMs, dica) {
  const { data, hora } = valorMs ? camposDeMs(valorMs) : { data: "", hora: "23:59" };
  const d = campo(rotulo, { type: "date", value: data, required: true });
  const h = campo("Hora", { type: "time", value: hora });
  const no = el("div", {}, el("div", { class: "form-linha" }, d.no, h.no), dica ? el("span", { class: "dica-campo" }, dica) : null);
  return { no, ms: () => msDeCampos(d.entrada.value, h.entrada.value || "23:59"), foco: d.entrada };
}
const progresso = (feitos, total) => {
  const barra = el("span", { class: "progresso", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(feitos),
    "aria-label": `${feitos} de ${total} entregaram` }, el("span"));
  barra.firstChild.style.width = total ? `${Math.min(100, Math.round(feitos / total * 100))}%` : "0%";
  return barra;
};

// ===================================================================
// Professor: criar / editar
// ===================================================================
export function janelaAtividade(sessao, turma, at, aoSalvar) {
  const editando = Boolean(at);
  const titulo = campo("Título", { type: "text", maxlength: String(LIMITES.titulo), value: at?.titulo || "", autocomplete: "off" });
  const prazo = editando ? null : campoPrazo("Prazo (data)", null, "Se não escolher a hora, fica 23:59. Horário de Brasília.");
  const descricao = campo("Descrição (opcional)", { maxlength: String(LIMITES.descricao), rows: "4" }, "textarea");
  descricao.entrada.value = at?.descricao || "";
  const nota = campo("Nota máxima (opcional)", { type: "text", inputmode: "decimal", placeholder: "10", value: at?.notaMax != null ? String(at.notaMax).replace(".", ",") : "" });
  const erro = el("p", { class: "erro", role: "alert" });
  const salvar = el("button", { type: "submit", class: "botao" }, editando ? "Salvar" : "Criar atividade");
  const form = el("form", { novalidate: true, style: { display: "grid", gap: "14px" } },
    titulo.no,
    editando ? el("p", { class: "mudo" }, `Prazo: ${dataHora(at.prazo)}. Para mudar o prazo, use ⋯ › "Estender prazo".`) : prazo.no,
    descricao.no, nota.no, erro);
  const j = abrirJanela({ titulo: editando ? "Editar atividade" : "Nova atividade", conteudo: [form],
    acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), salvar] });
  salvar.addEventListener("click", () => form.requestSubmit());
  form.addEventListener("submit", async e => {
    e.preventDefault();
    mensagem(erro);
    const t = titulo.entrada.value.trim(), desc = descricao.entrada.value.trim(), n = lerNotaMaxima(nota.entrada.value);
    if (!t) return mensagem(erro, "Digite o título da atividade.");
    if (n.erro) return mensagem(erro, n.erro);
    let prazoMs = null;
    if (!editando) {
      prazoMs = prazo.ms();
      if (Number.isNaN(prazoMs)) return mensagem(erro, "Escolha a data do prazo.");
      if (prazoMs <= Date.now()) return mensagem(erro, "O prazo precisa ser depois de agora.");
    }
    salvar.disabled = true;
    try {
      if (editando) { await editarAtividade(at, { titulo: t, descricao: desc, notaMax: n.valor }); toast("Atividade salva."); }
      else { await criarAtividade(sessao, turma.id, { titulo: t, descricao: desc, prazoMs, notaMax: n.valor }); toast(`Atividade "${t}" criada.`); }
      j.fechar(); aoSalvar?.();
    } catch (err) { console.error(err); mensagem(erro, mensagemDeErro(err)); salvar.disabled = false; }
  });
}

// ===================================================================
// Professor: estender prazo / reabrir entrega / apagar (menu ⋯)
// ===================================================================
function janelaEstender(sessao, at, aoSalvar) {
  const prazo = campoPrazo("Novo prazo (data)", ms(at.prazo), "Horário de Brasília. A mudança fica no registro de alterações.");
  const erro = el("p", { class: "erro", role: "alert" });
  const ok = el("button", { type: "button", class: "botao" }, "Estender prazo");
  const j = abrirJanela({ titulo: "Estender prazo", conteudo: [el("p", {}, `Prazo atual de "${at.titulo}": ${dataHora(at.prazo)}.`), prazo.no, erro],
    acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
  ok.addEventListener("click", async () => {
    const novo = prazo.ms();
    if (Number.isNaN(novo)) return mensagem(erro, "Escolha a data do novo prazo.");
    if (novo <= ms(at.prazo)) return mensagem(erro, "O novo prazo precisa ser depois do prazo atual.");
    if (novo <= Date.now()) return mensagem(erro, "O novo prazo precisa ser depois de agora.");
    ok.disabled = true;
    try { await estenderPrazo(sessao, at, novo); j.fechar(); toast(`Prazo estendido para ${dataHora(novo)}.`); aoSalvar?.(); }
    catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); ok.disabled = false; }
  });
}
function janelaReabrir(sessao, at, aoSalvar) {
  const padrao = ms(at.prazo) + 24 * HORA;
  const ate = campoPrazo("Aceitar entregas até (data)", null, "Horário de Brasília. Fica no registro de alterações.");
  const erro = el("p", { class: "erro", role: "alert" });
  const ok = el("button", { type: "button", class: "botao" }, "Reabrir entrega");
  const j = abrirJanela({ titulo: "Reabrir entrega", conteudo: [
    el("p", {}, `O prazo continua ${dataHora(at.prazo)}: quem entregar agora fica marcado como "atrasada". ${limiteDeEntrega(at) < Date.now()
      ? `As entregas eram aceitas até ${dataHora(limiteDeEntrega(at))}.` : `Hoje as entregas são aceitas até ${dataHora(limiteDeEntrega(at))}.`}`),
    ate.no, erro],
  acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
  ok.addEventListener("click", async () => {
    const v = ate.ms();
    if (Number.isNaN(v)) return mensagem(erro, "Escolha a data.");
    if (v <= Date.now()) return mensagem(erro, "A data precisa ser depois de agora.");
    if (v <= padrao) return mensagem(erro, `Até ${dataHora(padrao)} as entregas já são aceitas (prazo + 24h). Escolha uma data depois disso.`);
    ok.disabled = true;
    try { await reabrirEntrega(sessao, at, v); j.fechar(); toast(`Entregas aceitas até ${dataHora(v)}.`); aoSalvar?.(); }
    catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); ok.disabled = false; }
  });
}
async function perguntarApagar(at, nEntregas, aoApagar) {
  const texto = nEntregas
    ? `"${at.titulo}" tem ${nEntregas} ${nEntregas === 1 ? "entrega" : "entregas"}. A atividade e ${nEntregas === 1 ? "a entrega" : "todas as entregas"} serão apagadas. Isso não pode ser desfeito.`
    : `"${at.titulo}" será apagada. Isso não pode ser desfeito.`;
  if (!await confirmar("Apagar atividade?", texto, "Apagar atividade")) return;
  try { await apagarAtividade(at); toast("Atividade apagada."); aoApagar?.(); }
  catch (e) { console.error(e); toast("Não foi possível apagar. " + mensagemDeErro(e), { tipo: "erro" }); }
}
// Botão ⋯ do autor da atividade.
export function botaoMenuAtividade(sessao, at, { nEntregas = 0, aoMudar, aoApagar }) {
  return el("button", { type: "button", class: "botao-icone", "aria-label": `Mais opções de ${at.titulo}`, "aria-haspopup": "menu",
    onclick: e => abrirMenu(e.currentTarget, [
      { texto: "Estender prazo", icone: iconeEl("relogio"), acao: () => janelaEstender(sessao, at, aoMudar) },
      { texto: "Reabrir entrega até…", icone: iconeEl("relogio"), acao: () => janelaReabrir(sessao, at, aoMudar) },
      "separador",
      { texto: "Apagar atividade", icone: iconeEl("arquivo"), acao: () => perguntarApagar(at, nEntregas, aoApagar || aoMudar) }
    ]) }, iconeEl("mais"));
}

// ===================================================================
// Professor: linha da lista (prévia, tela 6)
// opcoes: { alunos (nº), entregas [], hrefDetalhe, podeEditar, arquivada, mostrarTurma, aoMudar }
// ===================================================================
export function linhaAtividadeProfessor(sessao, turma, at, { alunos, entregas, hrefDetalhe, podeEditar, arquivada, mostrarTurma, aoMudar, notasPublicadas }) {
  const entregaram = entregas.length, paraCorrigir = entregas.filter(e => !e.corrigida).length;
  const s = situacao(at);
  const estado = s.estado === "aberta" ? { texto: "Aberta", icone: "relogio" }
    : s.estado === "atrasada" ? { texto: "Aceitando atrasadas", classe: "chip contorno", icone: "relogio" }
    : { texto: "Encerrada" };
  const acoes = [];
  if (paraCorrigir) {
    acoes.push(chip({ texto: `${paraCorrigir} ${paraCorrigir === 1 ? "entrega para corrigir" : "entregas para corrigir"}`, classe: "chip contorno", icone: "check" }),
      el("a", { class: "botao", href: hrefDetalhe }, "Corrigir"));
  } else {
    // prévia, tela 6: "✓ Notas publicadas" quando a folha da atividade já foi publicada
    acoes.push(notasPublicadas ? chip({ texto: "Notas publicadas", icone: "check", classe: "chip escuro" }) : chip(estado),
      el("a", { class: "botao neutro", href: hrefDetalhe }, "Ver entregas"));
  }
  if (podeEditar && !arquivada) acoes.push(el("button", { type: "button", class: "botao neutro", onclick: () => janelaAtividade(sessao, turma, at, aoMudar) }, "Editar"));
  return comCorDaTurma(el("div", { class: "linha linha-atividade" },
    el("div", { class: "linha-info" },
      el("span", { class: "linha-titulo" }, at.titulo),
      el("span", { class: "mudo" }, `${mostrarTurma ? turma.nome + " · " : ""}prazo ${quando(at.prazo)}${at.reabertaAte && ms(at.reabertaAte) > ms(at.prazo) ? ` · reaberta até ${quando(at.reabertaAte)}` : ""}`),
      el("span", { class: "linha-progresso" }, progresso(Math.min(entregaram, alunos), alunos), el("span", { class: "mudo" }, `${entregaram} de ${alunos} entregaram`))),
    el("div", { class: "linha-acoes" }, ...acoes)), turma.cor);
}

// ===================================================================
// Aluno: linha da lista + janela de entrega
// ===================================================================
export function linhaAtividadeAluno(sessao, at, { mostrarTurma, arquivada, aoMudar }) {
  const e = at.entrega, c = chipDePrazo(at);
  const info = el("div", { class: "linha-info" },
    el("span", { class: "linha-titulo" }, at.titulo),
    el("span", { class: "mudo" }, `${mostrarTurma ? at.turmaNome + " · " : ""}prazo ${quando(at.prazo)}${c.s.estado === "atrasada" ? " (passou)" : ""}`));
  const abrir = () => janelaEntrega(sessao, at, { arquivada, aoMudar });
  const acoes = el("div", { class: "linha-acoes" });
  if (e) {
    info.append(el("span", { class: "recibo" }, iconeEl("check", "icone p"),
      `Entregue em ${diaMesHora(e.entregueEm)}${e.atrasada ? " · com atraso" : ""}`));
    if (e.corrigida) acoes.append(chip({ texto: "Corrigida", icone: "check", classe: "chip escuro" }));
    const resta = arquivada ? 0 : restanteParaDesfazer(e);
    if (resta > 0) acoes.append(el("button", { type: "button", class: "botao sec", onclick: () => perguntarDesfazer(sessao, at, aoMudar) },
      `Desfazer · ${duracao(resta)}`));
    acoes.append(el("button", { type: "button", class: "botao neutro", onclick: abrir }, "Ver entrega"));
  } else if (c.s.estado === "encerrada" || arquivada) {
    acoes.append(chip({ texto: arquivada ? "Turma arquivada" : "Encerrada" }), el("button", { type: "button", class: "botao neutro", onclick: abrir }, "Detalhes"));
    info.append(el("span", { class: "mudo" }, "Não entregue"));
  } else {
    if (c.s.estado === "atrasada") info.append(el("span", { class: "alerta-texto" }, "Será sinalizada como atrasada para o professor"));
    acoes.append(chip({ texto: c.texto, curto: c.curto, classe: c.classe, icone: "relogio" }),
      el("button", { type: "button", class: "botao", onclick: abrir }, "Entregar"));
  }
  return comCorDaTurma(el("div", { class: "linha" }, info, acoes), at.turmaCor);
}

async function perguntarDesfazer(sessao, at, aoMudar) {
  const ok = await confirmar("Desfazer a entrega?", [
    "A entrega some e o professor vê que ela foi desfeita.",
    "O que você escreveu volta como rascunho, para entregar de novo enquanto o prazo estiver aberto."], "Desfazer entrega");
  if (!ok) return;
  try {
    await desfazerMinhaEntrega(sessao, at);
    const e = at.entrega;
    if (e) guardado.gravar(chaveRascunho(sessao.uid, at.turmaId, at.id), { texto: e.texto || "", link: e.link || "" });
    toast("Entrega desfeita. Ela voltou como rascunho.");
    aoMudar?.();
  } catch (err) {
    console.error(err);
    toast(restanteParaDesfazer(at.entrega) <= 0 ? "Passaram as 4 horas: agora só o professor pode desfazer." : "Não foi possível desfazer. " + mensagemDeErro(err), { tipo: "erro" });
  }
}

// Janela do aluno: formulário de entrega, ou o recibo (com "Desfazer") se já entregou.
export function janelaEntrega(sessao, at, { arquivada, aoMudar }) {
  const e = at.entrega, s = situacao(at);
  const cabeca = [
    el("p", { class: "mudo" }, `${at.turmaNome} · prazo ${dataHora(at.prazo)}${at.notaMax ? ` · nota máxima ${String(at.notaMax).replace(".", ",")}` : ""}`),
    at.descricao ? el("p", { class: "texto-longo" }, at.descricao) : null
  ];
  let j;
  const fechar = el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Fechar");

  if (e) { // recibo
    const resta = arquivada ? 0 : restanteParaDesfazer(e);
    const desfazer = resta > 0 ? el("button", { type: "button", class: "botao sec", onclick: () => { j.fechar(); perguntarDesfazer(sessao, at, aoMudar); } },
      `Desfazer · ${duracao(resta)}`) : null;
    j = abrirJanela({ titulo: at.titulo, conteudo: [...cabeca,
      el("div", { class: "recibo-caixa" },
        el("b", {}, iconeEl("check", "icone p"), `Entregue em ${diaMesHora(e.entregueEm)}${e.atrasada ? " · com atraso" : ""}`),
        e.texto ? el("p", { class: "texto-longo" }, e.texto) : null,
        e.link ? el("a", { class: "link-simples", href: e.link, target: "_blank", rel: "noopener noreferrer" }, e.link) : null,
        e.corrigida ? el("span", { class: "mudo" }, "O professor marcou como corrigida.") : null),
      resta > 0 ? null : el("p", { class: "mudo" }, "Passaram as 4 horas para desfazer. Se precisar mudar, fale com o professor.")],
    acoes: [fechar, desfazer].filter(Boolean) });
    return;
  }
  if (s.estado === "encerrada" || arquivada) {
    j = abrirJanela({ titulo: at.titulo, conteudo: [...cabeca,
      el("p", { class: "aviso-info" }, arquivada ? "A turma está arquivada: não aceita entregas." : `O prazo de entrega acabou em ${dataHora(limiteDeEntrega(at))}. Se precisar, fale com o professor.`)],
    acoes: [fechar] });
    return;
  }

  // formulário (com rascunho guardado neste aparelho)
  const chave = chaveRascunho(sessao.uid, at.turmaId, at.id), rascunho = guardado.ler(chave) || {};
  const texto = campo("Sua resposta", { maxlength: String(LIMITES.texto), rows: "6", placeholder: "Escreva aqui…" }, "textarea");
  texto.entrada.value = rascunho.texto || "";
  const link = campo("Link (opcional)", { type: "url", maxlength: String(LIMITES.link), placeholder: "https://…", value: rascunho.link || "", autocomplete: "off" });
  const salvo = el("span", { class: "dica-campo", "aria-live": "polite" }, rascunho.texto || rascunho.link ? "Rascunho recuperado deste aparelho." : "");
  const salvarRascunho = () => {
    const r = { texto: texto.entrada.value, link: link.entrada.value };
    if (r.texto.trim() || r.link.trim()) { guardado.gravar(chave, r); salvo.textContent = "Rascunho salvo neste aparelho."; }
    else guardado.apagar(chave);
  };
  texto.entrada.addEventListener("input", salvarRascunho);
  link.entrada.addEventListener("input", salvarRascunho);
  const anexo = el("div", { class: "anexo" },
    el("button", { type: "button", class: "botao neutro pequeno", disabled: true }, "Anexar arquivo"),
    el("span", { class: "mudo" }, "Disponível em breve"));
  const erro = el("p", { class: "erro", role: "alert" });
  const ok = el("button", { type: "button", class: "botao" }, "Entregar");
  j = abrirJanela({ titulo: at.titulo, conteudo: [...cabeca,
    s.estado === "atrasada" ? el("p", { class: "aviso-info" }, `O prazo passou. Ainda dá para entregar por mais ${duracao(s.restante)}, mas será sinalizada como atrasada para o professor.`)
      : el("p", { class: "mudo" }, `Fecha em ${duracao(s.restante)}.`),
    texto.no, link.no, anexo, salvo, erro],
  acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
  ok.addEventListener("click", async () => {
    mensagem(erro);
    const t = texto.entrada.value.trim(), l = link.entrada.value.trim();
    if (!t && !l) return mensagem(erro, "Escreva a resposta ou cole um link.");
    if (l && !linkValido(l)) return mensagem(erro, "O link precisa começar com http:// ou https:// e não pode ter espaços.");
    ok.disabled = true;
    try {
      await entregar(sessao, at, { texto: t, link: l });
      guardado.apagar(chave);
      j.fechar();
      toast("Entregue! Você pode desfazer nas próximas 4 horas.");
      aoMudar?.();
    } catch (err) {
      console.error(err);
      mensagem(erro, Date.now() > limiteDeEntrega(at) ? "O prazo de entrega acabou." :
        err.code === "permission-denied" ? "Não foi possível entregar. Talvez você já tenha entregue em outra aba: atualize a página." : mensagemDeErro(err));
      ok.disabled = false;
    }
  });
}
