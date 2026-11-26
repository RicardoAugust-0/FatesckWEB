// Componentes de notas e boletim acadêmico. Montagem segura por el(): dados do banco nunca são interpretados como HTML.
import { el, abrirJanela, toast, mensagem } from "./ui.js";
import { chip, card, comCorDaTurma } from "./componentes.js";
import { diaMesHora } from "../utils/datas.js";
import { lerNota, formatarNota, media, lerPeso, calcularMediaAluno, calcularMediaTurma, classificarDesempenhoNota, gerarCsvBoletim, normalizarParaDez } from "../utils/notas-util.js";
import { lerNotaMaxima } from "../utils/prazos.js";
import { criarFolha, salvarNotas, alterarFolha, publicarFolha, despublicarFolha, apagarFolha } from "../servicos/notas.js";
import { itensDaFolha } from "../servicos/dados.js";
import { mensagemDeErro } from "../core/auth.js";

let seq = 0;
const idCampo = p => `${p}-${++seq}`;
const nAlunosTexto = n => `${n} ${n === 1 ? "aluno" : "alunos"}`;
const categorias = [{ value: "avaliacao", label: "Avaliação / Prova" }, { value: "trabalho", label: "Trabalho" }, { value: "atividade", label: "Atividade" }];
const categoriaLabel = c => categorias.find(x => x.value === c)?.label || "Avaliação / Prova";

function carregarCss() {
  if (document.getElementById("css-notas-academico")) return;
  const base = document.body?.dataset?.base || "..";
  const link = el("link", { id: "css-notas-academico", rel: "stylesheet", href: `${base}/css/notas-academico.css` });
  document.head.append(link);
}
carregarCss();

export const chipFolha = f => f.publicada ? chip({ texto: "Publicada", icone: "check", classe: "chip escuro" }) : chip({ texto: "Rascunho" });

export function resumoFolha(f, itens = {}, nAlunos = 0) {
  const valores = Object.values(itens).map(i => i.valor), m = media(valores);
  return f.publicada
    ? `Publicada em ${diaMesHora(f.publicadaEm).split(" às ")[0]}${m !== null ? ` · média da turma ${formatarNota(m)}` : ""}`
    : `Rascunho · ${valores.length} de ${nAlunos} notas lançadas`;
}

function campoCategoria(valor = "avaliacao", disabled = false) {
  return el("select", { disabled }, ...categorias.map(c => el("option", { value: c.value, selected: c.value === valor }, c.label)));
}

export function janelaNovaFolha(sessao, turma, aoCriar) {
  const idT = idCampo("folha-titulo"), idN = idCampo("folha-max"), idP = idCampo("folha-peso"), idC = idCampo("folha-cat");
  const titulo = el("input", { id: idT, type: "text", maxlength: "80", placeholder: "Ex.: Prova 1", autocomplete: "off" });
  const max = el("input", { id: idN, type: "text", inputmode: "decimal", value: "10" });
  const peso = el("input", { id: idP, type: "text", inputmode: "decimal", value: "1" });
  const categoria = campoCategoria(); categoria.id = idC;
  const erro = el("p", { class: "erro", role: "alert" });
  const ok = el("button", { type: "button", class: "botao" }, "Criar e lançar notas");
  const j = abrirJanela({ titulo: "Nova folha de notas", conteudo: [
    el("div", { class: "campo" }, el("label", { for: idT }, "Título"), titulo),
    el("div", { class: "form-linha" }, el("div", { class: "campo" }, el("label", { for: idN }, "Nota máxima"), max),
      el("div", { class: "campo" }, el("label", { for: idP }, "Peso na média"), peso)),
    el("div", { class: "campo" }, el("label", { for: idC }, "Categoria"), categoria),
    el("p", { class: "dica-campo" }, "O peso padrão é 1. Exemplo: Prova peso 2 e Atividade peso 1."),
    el("p", { class: "mudo" }, "A folha começa como rascunho: os alunos só veem as notas depois de Publicar."), erro],
  acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
  ok.addEventListener("click", async () => {
    mensagem(erro);
    const t = titulo.value.trim(), n = lerNotaMaxima(max.value), p = lerPeso(peso.value);
    if (!t) return mensagem(erro, "Digite o título (ex.: Prova 1).");
    if (n.erro || n.valor === null) return mensagem(erro, n.erro || "Digite a nota máxima.");
    if (p.erro) return mensagem(erro, p.erro);
    ok.disabled = true;
    try {
      const f = await criarFolha(sessao, turma.id, { titulo: t, notaMax: n.valor, peso: p.valor, categoria: categoria.value });
      j.fechar(); aoCriar?.(f);
    } catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); ok.disabled = false; }
  });
}

export async function janelaFolha(sessao, turma, folha, { alunos = [], podeEditar, aoMudar } = {}) {
  let itens = await itensDaFolha(turma.id, folha.id);
  let notaMax = folha.notaMax || 10;
  const avulsa = !folha.atividadeId;
  const erro = el("p", { class: "erro", role: "alert" });
  const aviso = el("p", { class: "aviso-info", role: "status", hidden: true });
  const resumo = el("p", { class: "mudo notas-estatisticas", "aria-live": "polite" });
  const nomes = new Map(alunos.map(a => [a.uid, a.nome]));
  const uids = [...alunos.map(a => a.uid), ...Object.keys(itens).filter(u => !nomes.has(u))];
  const idT = idCampo("ft"), idM = idCampo("fm"), idP = idCampo("fp"), idC = idCampo("fc");
  const campoTitulo = el("input", { id: idT, type: "text", maxlength: "80", value: folha.titulo, disabled: !podeEditar || !avulsa });
  const campoMax = el("input", { id: idM, type: "text", inputmode: "decimal", value: formatarNota(folha.notaMax), disabled: !podeEditar });
  const campoPeso = el("input", { id: idP, type: "text", inputmode: "decimal", value: String(folha.peso ?? 1).replace(".", ","), disabled: !podeEditar });
  const campoCat = campoCategoria(folha.categoria || "avaliacao", !podeEditar); campoCat.id = idC;
  const cabeca = el("div", { class: "notas-cabeca-form" },
    el("div", { class: "campo" }, el("label", { for: idT }, "Título"), campoTitulo),
    el("div", { class: "form-linha" }, el("div", { class: "campo" }, el("label", { for: idM }, "Nota máxima"), campoMax),
      el("div", { class: "campo" }, el("label", { for: idP }, "Peso"), campoPeso),
      el("div", { class: "campo" }, el("label", { for: idC }, "Categoria"), campoCat)));
  const linhas = uids.map(uid => {
    const item = itens[uid], idN = idCampo("n"), idCom = idCampo("c");
    const nota = el("input", { id: idN, type: "text", inputmode: "decimal", class: "campo-nota", value: item ? formatarNota(item.valor) : "", disabled: !podeEditar,
      "aria-label": `Nota de ${nomes.get(uid) || "aluno"}` });
    const comentario = el("input", { id: idCom, type: "text", maxlength: "500", value: item?.comentario || "", placeholder: podeEditar ? "Comentário (opcional)" : "", disabled: !podeEditar,
      "aria-label": `Comentário para ${nomes.get(uid) || "aluno"}` });
    const atencao = el("span", { class: "nota-atencao", hidden: true });
    const no = el("div", { class: "linha-nota" },
      el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, nomes.get(uid) || "Aluno que saiu da turma"),
        item ? el("span", { class: "mudo" }, `Atualizada em ${diaMesHora(item.atualizadoEm)}`) : null),
      el("div", { class: "campos-nota" }, nota, atencao, comentario));
    nota.addEventListener("input", () => { atualizarAtencao(nota, atencao); atualizarResumo(); });
    comentario.addEventListener("input", atualizarResumo);
    return { uid, nota, comentario, atencao, no };
  });
  function notaMaxDigitada() { const n = lerNotaMaxima(campoMax.value); return n.erro || n.valor === null ? null : n.valor; }
  function atualizarAtencao(campo, alvo) {
    const nmax = notaMaxDigitada() ?? notaMax, r = lerNota(campo.value, nmax);
    const abaixo = !r.erro && typeof r.valor === "number" && r.valor < nmax * .6;
    campo.classList.toggle("nota-abaixo", abaixo); alvo.hidden = !abaixo;
    alvo.textContent = abaixo ? `${formatarNota(normalizarParaDez(r.valor, nmax))}/10 · abaixo de 60%` : "";
  }
  function mudancas() {
    const lista = [], erros = [];
    for (const l of linhas) {
      const r = lerNota(l.nota.value, notaMaxDigitada() ?? notaMax), c = l.comentario.value.trim(), atual = itens[l.uid];
      if (r.erro) { erros.push(`${nomes.get(l.uid) || "Aluno"}: ${r.erro}`); continue; }
      if (r.valor === null && c) { erros.push(`${nomes.get(l.uid) || "Aluno"}: o comentário precisa de uma nota.`); continue; }
      const mudou = r.valor === null ? Boolean(atual) : (!atual || atual.valor !== r.valor || (atual.comentario || "") !== c);
      if (mudou) lista.push({ alunoUid: l.uid, valor: r.valor, comentario: c });
    }
    return { lista, erros };
  }
  const cabecaMudou = () => podeEditar && (campoTitulo.value.trim() !== folha.titulo || notaMaxDigitada() !== folha.notaMax || Number(campoPeso.value.replace(",", ".")) !== (folha.peso ?? 1) || campoCat.value !== (folha.categoria || "avaliacao"));
  const sujo = () => mudancas().lista.length > 0 || cabecaMudou();
  function atualizarResumo() {
    const valores = linhas.map(l => lerNota(l.nota.value, Infinity).valor).filter(v => typeof v === "number");
    const abaixo = valores.filter(v => v < (notaMaxDigitada() ?? notaMax) * .6).length;
    const m = media(valores), maior = valores.length ? Math.max(...valores) : null, menor = valores.length ? Math.min(...valores) : null;
    resumo.replaceChildren(
      el("span", {}, `Média da avaliação: ${m === null ? "—" : formatarNota(m)}`),
      el("span", {}, `Maior: ${maior === null ? "—" : formatarNota(maior)}`),
      el("span", {}, `Menor: ${menor === null ? "—" : formatarNota(menor)}`),
      el("span", { class: abaixo ? "nota-contador-atencao" : "" }, `${abaixo} abaixo de 60%`),
      el("span", {}, `${valores.length} de ${alunos.length} com nota`),
      sujo() ? el("b", {}, "Há mudanças não salvas") : null);
    avisoFechar = false; aviso.hidden = true;
  }
  campoMax.addEventListener("input", () => { linhas.forEach(l => atualizarAtencao(l.nota, l.atencao)); atualizarResumo(); });
  campoPeso.addEventListener("input", atualizarResumo); campoCat.addEventListener("change", atualizarResumo); campoTitulo.addEventListener("input", atualizarResumo);
  linhas.forEach(l => atualizarAtencao(l.nota, l.atencao));
  const btSalvar = el("button", { type: "button", class: "botao neutro" }, "Salvar");
  const btPublicar = el("button", { type: "button", class: "botao" }, folha.publicada ? "Despublicar" : "Publicar");
  const fechar = el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Fechar");
  const btApagar = !folha.publicada ? el("button", { type: "button", class: "botao sec" }, "Apagar rascunho") : null;
  let avisoFechar = false, confirmarPublicar = false, confirmarApagar = false;
  btApagar?.addEventListener("click", async () => {
    mensagem(erro);
    if (!confirmarApagar) { confirmarApagar = true; aviso.hidden = false; aviso.textContent = `Apagar "${folha.titulo}" e todas as notas dela? Isso não pode ser desfeito. Clique em "Confirmar apagar".`; btApagar.textContent = "Confirmar apagar"; return; }
    btApagar.disabled = true;
    try { await apagarFolha(sessao, folha, turma.nome); toast(`Folha "${folha.titulo}" apagada.`); j.fechar({ forcar: true }); aoMudar?.(); }
    catch (e) { console.error(e); mensagem(erro, "Não foi possível apagar. " + mensagemDeErro(e)); btApagar.disabled = false; }
  });
  async function salvar() {
    mensagem(erro);
    const { lista, erros } = mudancas();
    if (erros.length) { mensagem(erro, erros.slice(0, 3).join(" · ")); return false; }
    const t = campoTitulo.value.trim(), n = lerNotaMaxima(campoMax.value), p = lerPeso(campoPeso.value);
    if (!t) { mensagem(erro, "O título não pode ficar vazio."); return false; }
    if (n.erro || n.valor === null) { mensagem(erro, n.erro || "Digite a nota máxima."); return false; }
    if (p.erro) { mensagem(erro, p.erro); return false; }
    const maior = Math.max(0, ...linhas.map(l => lerNota(l.nota.value, Infinity).valor ?? 0));
    if (maior > n.valor) { mensagem(erro, `Há nota ${formatarNota(maior)}, maior que a nota máxima ${formatarNota(n.valor)}.`); return false; }
    if (t !== folha.titulo || n.valor !== folha.notaMax || p.valor !== (folha.peso ?? 1) || campoCat.value !== (folha.categoria || "avaliacao")) {
      await alterarFolha(folha, { titulo: t, notaMax: n.valor, peso: p.valor, categoria: campoCat.value });
      Object.assign(folha, { titulo: t, notaMax: n.valor, peso: p.valor, categoria: campoCat.value }); notaMax = n.valor;
    }
    await salvarNotas(folha, lista); itens = await itensDaFolha(turma.id, folha.id); atualizarResumo(); return true;
  }
  btSalvar.addEventListener("click", async () => {
    btSalvar.disabled = true;
    try { if (await salvar()) { toast("Notas salvas."); aoMudar?.(); } }
    catch (e) { console.error(e); mensagem(erro, "Não foi possível salvar. " + mensagemDeErro(e)); }
    finally { btSalvar.disabled = false; }
  });
  btPublicar.addEventListener("click", async () => {
    mensagem(erro); btPublicar.disabled = true;
    try {
      if (folha.publicada) {
        if (!confirmarPublicar) { confirmarPublicar = true; aviso.hidden = false; aviso.textContent = "Despublicar: os alunos deixam de ver estas notas. Clique em Confirmar despublicar."; btPublicar.textContent = "Confirmar despublicar"; return; }
        await despublicarFolha(sessao, folha, turma.nome); toast("Notas despublicadas."); j.fechar({ forcar: true }); aoMudar?.(); return;
      }
      if (!await salvar()) return;
      const semNota = alunos.filter(a => !itens[a.uid]).length;
      if (semNota && !confirmarPublicar) { confirmarPublicar = true; aviso.hidden = false; aviso.textContent = `${nAlunosTexto(semNota)} ainda sem nota. Clique em Publicar mesmo assim para continuar.`; btPublicar.textContent = "Publicar mesmo assim"; return; }
      await publicarFolha(folha); toast(`"${folha.titulo}" publicada.`); j.fechar({ forcar: true }); aoMudar?.();
    } catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); }
    finally { btPublicar.disabled = false; }
  });
  const j = abrirJanela({ titulo: folha.titulo, classe: "grande",
    conteudo: [el("div", { class: "turma-chips" }, chipFolha(folha), chip({ texto: turma.nome })),
      podeEditar ? cabeca : el("p", { class: "mudo" }, `Nota máxima ${formatarNota(folha.notaMax)}${folha.atividadeId ? " · notas da atividade" : ""}`), resumo,
      el("div", { class: "lista-notas" }, ...(linhas.length ? linhas.map(l => l.no) : [el("div", { class: "vazio" }, "A turma ainda não tem alunos.")])),
      podeEditar ? el("p", { class: "dica-campo" }, "Deixe a nota em branco para não lançar ou apagar uma nota. Os alunos só veem depois de Publicar.") : null, aviso, erro],
    acoes: podeEditar ? [btApagar, fechar, btSalvar, btPublicar].filter(Boolean) : [fechar],
    podeFechar: () => { if (!podeEditar || avisoFechar || !sujo()) return true; avisoFechar = true; aviso.hidden = false; aviso.textContent = "Há notas não salvas. Clique em Salvar ou feche de novo para descartar."; return false; }
  });
  atualizarResumo();
}

export function linhaFolha(sessao, turma, f, { itens = {}, alunos = [], podeEditar, hrefAtividade, aoMudar, compacta } = {}) {
  const abrir = () => janelaFolha(sessao, turma, f, { alunos, podeEditar, aoMudar });
  const valores = Object.values(itens).map(i => i.valor).filter(v => typeof v === "number");
  const abaixo = valores.filter(v => v < (f.notaMax || 10) * .6).length;
  const botao = f.atividadeId && hrefAtividade ? el("a", { class: "botao pequeno neutro", href: hrefAtividade }, "Abrir atividade")
    : el("button", { type: "button", class: "botao pequeno " + (f.publicada || !podeEditar ? "neutro" : ""), onclick: abrir }, f.publicada || !podeEditar ? "Ver notas" : "Lançar notas");
  return el("div", { class: "linha" + (compacta ? " linha-compacta" : "") },
    el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, f.titulo),
      el("span", { class: "mudo" }, resumoFolha(f, itens, alunos.length)),
      el("span", { class: "notas-chips" }, f.peso && f.peso !== 1 ? chip({ texto: `Peso ${formatarNota(f.peso)}` }) : null,
        chip({ texto: categoriaLabel(f.categoria), classe: "chip chip-categoria" }),
        f.publicada && abaixo ? chip({ texto: `${abaixo} abaixo de 60%`, classe: "chip chip-atencao" }) : null)),
    el("div", { class: "linha-acoes" }, chipFolha(f), botao));
}

function calcularLinhaBoletim(aluno, folhas) {
  const notas = {}, avaliacoes = [];
  for (const f of folhas) {
    const item = f.itens?.[aluno.uid];
    notas[f.id] = item && typeof item.valor === "number" ? item.valor : null;
    if (notas[f.id] !== null) avaliacoes.push({ valor: item.valor, notaMax: f.notaMax || 10, peso: f.peso });
  }
  const m = calcularMediaAluno(avaliacoes), classe = classificarDesempenhoNota(m);
  return { alunoUid: aluno.uid, notas, media: m, situacao: classe.rotulo, classe };
}

export function quadroBoletimTurma(sessao, turma, { alunos = [], folhas = [], hrefAtividade, aoMudar } = {}) {
  let apenasPublicadas = true, busca = "";
  const raiz = el("section", { class: "boletim-turma" });
  const render = () => {
    const consideradas = folhas.filter(f => !apenasPublicadas || f.publicada);
    const linhas = alunos.map(a => ({ aluno: a, ...calcularLinhaBoletim(a, consideradas) }));
    const medias = linhas.map(l => l.media), mediaGeral = calcularMediaTurma(medias);
    const regulares = linhas.filter(l => l.media !== null && l.media >= 6).length;
    const atencao = linhas.filter(l => l.media !== null && l.media < 6).length;
    const publicados = folhas.filter(f => f.publicada).length, rascunhos = folhas.length - publicados;
    const filtro = busca.trim().toLocaleLowerCase("pt-BR");
    const visiveis = linhas.filter(l => !filtro || `${l.aluno.nome} ${l.aluno.ra || l.aluno.matricula || ""}`.toLocaleLowerCase("pt-BR").includes(filtro));
    const kpis = el("div", { class: "notas-kpis" },
      ...[["Média geral", mediaGeral === null ? "—" : formatarNota(mediaGeral)], ["Alunos ≥ 6,0", String(regulares)], ["Atenção / risco", String(atencao)], ["Publicadas / rascunhos", `${publicados} / ${rascunhos}`]].map(([t, v]) => el("div", { class: "notas-kpi" }, el("span", {}, t), el("b", {}, v))));
    const alternar = el("label", { class: "notas-toggle" }, el("input", { type: "checkbox", checked: apenasPublicadas, onchange: e => { apenasPublicadas = e.target.checked; render(); } }),
      apenasPublicadas ? "Considerar apenas publicadas" : "Simular incluindo rascunhos");
    const campoBusca = el("input", { id: "busca-boletim-turma", class: "notas-busca", type: "search", placeholder: "Buscar aluno ou RA…", value: busca, oninput: e => {
      const pos = e.target.selectionStart; busca = e.target.value; render();
      const novo = raiz.querySelector("#busca-boletim-turma"); novo?.focus(); novo?.setSelectionRange(pos, pos);
    } });
    const exportar = el("button", { type: "button", class: "botao pequeno neutro", onclick: () => {
      const csv = gerarCsvBoletim(turma.nome, alunos, consideradas, linhas);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }), url = URL.createObjectURL(blob), a = el("a", { href: url, download: `boletim-${String(turma.nome).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv` });
      document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); toast("Boletim exportado em CSV.");
    } }, "Exportar boletim (.csv)");
    const controles = el("div", { class: "notas-controles" }, alternar, campoBusca, exportar);
    const cab = el("thead", {}, el("tr", {}, el("th", { class: "col-aluno" }, "Aluno / RA"),
      ...consideradas.map(f => el("th", {}, el("button", { type: "button", class: "boletim-folha-link", title: "Abrir avaliação" , onclick: () => janelaFolha(sessao, turma, f, { alunos, podeEditar: f.autorUid === sessao.uid, aoMudar }) }, f.titulo),
        el("small", {}, `Peso ${formatarNota(f.peso || 1)}`))),
      el("th", { class: "col-media" }, "Média (0–10)"), el("th", {}, "Situação")));
    const corpo = el("tbody", {}, ...visiveis.map(l => el("tr", {},
      el("th", { class: "col-aluno", scope: "row" }, el("b", {}, l.aluno.nome), el("small", {}, l.aluno.ra || l.aluno.matricula || "RA não informado")),
      ...consideradas.map(f => { const n = l.notas[f.id]; return el("td", { class: typeof n === "number" && n < (f.notaMax || 10) * .6 ? "nota-celula nota-celula-atencao" : "nota-celula" }, n === null ? "—" : `${formatarNota(n)} / ${formatarNota(f.notaMax || 10)}`); }),
      el("td", { class: "col-media valor-media" }, l.media === null ? "—" : formatarNota(l.media)),
      el("td", {}, el("span", { class: `badge-desempenho ${l.classe.classe}` }, l.classe.rotulo)))));
    const tabela = el("div", { class: "boletim-scroll" }, el("table", { class: "tabela-boletim" }, cab, corpo));
    const vazio = !consideradas.length ? el("div", { class: "vazio" }, "Nenhuma avaliação para o filtro selecionado.") : !visiveis.length ? el("div", { class: "vazio" }, "Nenhum aluno encontrado.") : null;
    raiz.replaceChildren(kpis, controles, vazio || tabela);
  };
  render();
  return raiz;
}

export function quadroNotasAluno(turma, notas, { mostrarTitulo = true } = {}) {
  const avaliacoes = notas.map(({ folha, item }) => ({ valor: item.valor, notaMax: folha.notaMax || 10, peso: folha.peso }));
  const mediaAtual = calcularMediaAluno(avaliacoes), situacao = classificarDesempenhoNota(mediaAtual);
  const percentual = mediaAtual === null ? 0 : Math.max(0, Math.min(100, mediaAtual * 10));
  const progresso = el("div", { class: "notas-progresso" }, el("span", { class: "notas-progresso-preenchido", style: { width: `${percentual}%` } }), el("i", { class: "notas-meta-marcador", style: { left: "60%" }, title: "Meta de aprovação: 6,0" }));
  const resumo = el("div", { class: "resumo-desempenho" },
    el("div", { class: "resumo-media" }, el("span", {}, "Média atual"), el("b", {}, mediaAtual === null ? "—" : formatarNota(mediaAtual)), el("small", {}, "Meta de aprovação: 6,0")),
    el("div", { class: "resumo-status" }, el("span", { class: `badge-desempenho ${situacao.classe}` }, situacao.rotulo), progresso),
    mediaAtual !== null && mediaAtual < 6 ? el("p", { class: "dica-atencao" }, "Sua média atual está abaixo de 6,0. Fique atento às próximas avaliações e procure o professor no chat se tiver dúvidas.") : null);
  const linhas = notas.map(({ folha, item }) => {
    const n10 = normalizarParaDez(item.valor, folha.notaMax || 10);
    return el("div", { class: "linha linha-nota-aluno" },
      el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, folha.titulo),
        item.comentario ? el("span", { class: "comentario-nota" }, `“${item.comentario}”`) : null,
        el("span", { class: "mudo" }, `Publicada em ${diaMesHora(folha.publicadaEm).split(" às ")[0]}${folha.peso && folha.peso !== 1 ? ` · Peso ${formatarNota(folha.peso)}` : ""}${folha.notaMax !== 10 ? ` · Equivalente: ${formatarNota(n10)}/10` : ""}`)),
      el("div", { class: "valor-nota", "aria-label": `${formatarNota(item.valor)} de ${formatarNota(folha.notaMax)}` }, el("b", {}, formatarNota(item.valor)), el("span", {}, ` de ${formatarNota(folha.notaMax)}`)));
  });
  const c = card({ titulo: mostrarTitulo ? turma.nome : "Minhas notas", corpo: [resumo, ...(linhas.length ? linhas : [el("div", { class: "vazio" }, "Nenhuma nota publicada ainda.")])] });
  return comCorDaTurma(c, turma.cor);
}
