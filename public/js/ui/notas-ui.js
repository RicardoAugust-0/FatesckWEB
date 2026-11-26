// Peças de tela das notas (Fase 6). Decisões do Fernando: folha de notas numa JANELA GRANDE por cima;
// nota de atividade num campo em cada entrega (tela da atividade); grava só no botão "Salvar";
// aluno vê um quadro por turma. Sem média final nem pesos (só a média da turma, para o professor).
import { el, abrirJanela, toast, mensagem } from "./ui.js";
import { chip, card, comCorDaTurma } from "./componentes.js";
import { diaMesHora } from "../utils/datas.js";
import { lerNota, formatarNota, media } from "../utils/notas-util.js";
import { lerNotaMaxima } from "../utils/prazos.js";
import { criarFolha, salvarNotas, alterarFolha, publicarFolha, despublicarFolha, apagarFolha } from "../servicos/notas.js";
import { itensDaFolha } from "../servicos/dados.js";
import { mensagemDeErro } from "../core/auth.js";

let seq = 0;
const idCampo = p => `${p}-${++seq}`;
const nAlunosTexto = n => `${n} ${n === 1 ? "aluno" : "alunos"}`;

// Chip de situação da folha (prévia, tela 6: "✓ Publicada" escuro / "Rascunho" cinza)
export const chipFolha = f => f.publicada ? chip({ texto: "Publicada", icone: "check", classe: "chip escuro" }) : chip({ texto: "Rascunho" });

// Resumo de uma folha: "Publicada em 05/11 · média da turma 7,4" ou "Rascunho · 12 de 32 notas lançadas"
export function resumoFolha(f, itens, nAlunos) {
  const valores = Object.values(itens).map(i => i.valor), m = media(valores);
  return f.publicada
    ? `Publicada em ${diaMesHora(f.publicadaEm).split(" às ")[0]}${m !== null ? ` · média da turma ${formatarNota(m)}` : ""}`
    : `Rascunho · ${valores.length} de ${nAlunos} notas lançadas`;
}

// ===================================================================
// Nova folha (título + nota máxima)
// ===================================================================
export function janelaNovaFolha(sessao, turma, aoCriar) {
  const idT = idCampo("folha-titulo"), idN = idCampo("folha-max");
  const titulo = el("input", { id: idT, type: "text", maxlength: "80", placeholder: "Ex.: Prova 1", autocomplete: "off" });
  const max = el("input", { id: idN, type: "text", inputmode: "decimal", value: "10" });
  const erro = el("p", { class: "erro", role: "alert" });
  const ok = el("button", { type: "button", class: "botao" }, "Criar e lançar notas");
  const j = abrirJanela({ titulo: "Nova folha de notas", conteudo: [
    el("div", { class: "campo" }, el("label", { for: idT }, "Título"), titulo),
    el("div", { class: "campo" }, el("label", { for: idN }, "Nota máxima"), max, el("span", { class: "dica-campo" }, "Aceita decimais, como 7,5.")),
    el("p", { class: "mudo" }, "A folha começa como rascunho: os alunos só veem as notas depois de \"Publicar\"."), erro],
  acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
  ok.addEventListener("click", async () => {
    mensagem(erro);
    const t = titulo.value.trim(), n = lerNotaMaxima(max.value);
    if (!t) return mensagem(erro, "Digite o título (ex.: Prova 1).");
    if (n.erro || n.valor === null) return mensagem(erro, n.erro || "Digite a nota máxima.");
    ok.disabled = true;
    try { const f = await criarFolha(sessao, turma.id, { titulo: t, notaMax: n.valor }); j.fechar(); aoCriar?.(f); }
    catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); ok.disabled = false; }
  });
}

// ===================================================================
// Janela grande da folha: uma linha por aluno (nota + comentário), média, Salvar, Publicar / Despublicar
// alunos: [{ uid, nome }] ; podeEditar: autor da folha (ou admin) e turma aberta
// ===================================================================
export async function janelaFolha(sessao, turma, folha, { alunos, podeEditar, aoMudar }) {
  let itens = await itensDaFolha(turma.id, folha.id);
  let notaMax = folha.notaMax;
  const avulsa = !folha.atividadeId;
  const erro = el("p", { class: "erro", role: "alert" });
  const aviso = el("p", { class: "aviso-info", role: "status", hidden: true });
  const resumo = el("p", { class: "mudo", "aria-live": "polite" });
  // quem tem nota mas saiu da turma continua aparecendo (a nota não some)
  const nomes = new Map(alunos.map(a => [a.uid, a.nome]));
  const uids = [...alunos.map(a => a.uid), ...Object.keys(itens).filter(u => !nomes.has(u))];

  // título e nota máxima (só folha avulsa; a de atividade segue a atividade)
  const idT = idCampo("ft"), idM = idCampo("fm");
  const campoTitulo = el("input", { id: idT, type: "text", maxlength: "80", value: folha.titulo, disabled: !podeEditar || !avulsa });
  const campoMax = el("input", { id: idM, type: "text", inputmode: "decimal", value: formatarNota(folha.notaMax), disabled: !podeEditar });
  const cabeca = el("div", { class: "form-linha" },
    el("div", { class: "campo" }, el("label", { for: idT }, "Título"), campoTitulo),
    el("div", { class: "campo campo-curto" }, el("label", { for: idM }, "Nota máxima"), campoMax));

  const linhas = uids.map(uid => {
    const item = itens[uid], idN = idCampo("n"), idC = idCampo("c");
    const nota = el("input", { id: idN, type: "text", inputmode: "decimal", class: "campo-nota", value: item ? formatarNota(item.valor) : "", disabled: !podeEditar,
      "aria-label": `Nota de ${nomes.get(uid) || "aluno"}` });
    const comentario = el("input", { id: idC, type: "text", maxlength: "500", value: item?.comentario || "", placeholder: podeEditar ? "Comentário (opcional)" : "", disabled: !podeEditar,
      "aria-label": `Comentário para ${nomes.get(uid) || "aluno"}` });
    const no = el("div", { class: "linha-nota" },
      el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, nomes.get(uid) || "Aluno que saiu da turma"),
        item ? el("span", { class: "mudo" }, `Atualizada em ${diaMesHora(item.atualizadoEm)}`) : null),
      el("div", { class: "campos-nota" }, nota, comentario));
    nota.addEventListener("input", atualizarResumo);
    comentario.addEventListener("input", atualizarResumo);
    return { uid, nota, comentario, no };
  });

  // mudanças em relação ao que está gravado
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
  function notaMaxDigitada() { const n = lerNotaMaxima(campoMax.value); return n.erro || n.valor === null ? null : n.valor; }
  const cabecaMudou = () => podeEditar && (campoTitulo.value.trim() !== folha.titulo || notaMaxDigitada() !== folha.notaMax);
  const sujo = () => mudancas().lista.length > 0 || cabecaMudou();

  function atualizarResumo() {
    const valores = linhas.map(l => lerNota(l.nota.value, Infinity).valor).filter(v => typeof v === "number");
    const m = media(valores);
    resumo.textContent = `${valores.length} de ${alunos.length} com nota${m !== null ? ` · média da turma ${formatarNota(m)}` : ""}${sujo() ? " · há mudanças não salvas" : ""}`;
    avisoFechar = false; aviso.hidden = true;
  }

  // botões
  const btSalvar = el("button", { type: "button", class: "botao neutro" }, "Salvar");
  const btPublicar = el("button", { type: "button", class: "botao" }, folha.publicada ? "Despublicar" : "Publicar");
  const fechar = el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Fechar");
  // Apagar: só rascunho (as regras recusam folha publicada); pede confirmação na própria janela.
  const btApagar = !folha.publicada ? el("button", { type: "button", class: "botao sec" }, "Apagar rascunho") : null;
  let avisoFechar = false, confirmarPublicar = false, confirmarApagar = false;
  btApagar?.addEventListener("click", async () => {
    mensagem(erro);
    if (!confirmarApagar) {
      confirmarApagar = true; aviso.hidden = false;
      aviso.textContent = `Apagar "${folha.titulo}" e todas as notas dela? Isso não pode ser desfeito e fica no registro de alterações. Clique em "Confirmar apagar".`;
      btApagar.textContent = "Confirmar apagar";
      return;
    }
    btApagar.disabled = true;
    try { await apagarFolha(sessao, folha, turma.nome); toast(`Folha "${folha.titulo}" apagada.`); j.fechar({ forcar: true }); aoMudar?.(); }
    catch (e) { console.error(e); mensagem(erro, "Não foi possível apagar. " + mensagemDeErro(e)); btApagar.disabled = false; }
  });

  async function salvar() {
    mensagem(erro);
    const { lista, erros } = mudancas();
    if (erros.length) { mensagem(erro, erros.slice(0, 3).join(" · ")); return false; }
    const t = campoTitulo.value.trim(), n = lerNotaMaxima(campoMax.value);
    if (!t) { mensagem(erro, "O título não pode ficar vazio."); return false; }
    if (n.erro || n.valor === null) { mensagem(erro, n.erro || "Digite a nota máxima."); return false; }
    const maior = Math.max(0, ...linhas.map(l => lerNota(l.nota.value, Infinity).valor ?? 0));
    if (maior > n.valor) { mensagem(erro, `Há nota ${formatarNota(maior)}, maior que a nota máxima ${formatarNota(n.valor)}.`); return false; }
    // título/nota máxima primeiro: as regras comparam cada nota com a nota máxima JÁ gravada
    if (t !== folha.titulo || n.valor !== folha.notaMax) {
      await alterarFolha(folha, { titulo: t, notaMax: n.valor });
      Object.assign(folha, { titulo: t, notaMax: n.valor }); notaMax = n.valor;
    }
    await salvarNotas(folha, lista);
    itens = await itensDaFolha(turma.id, folha.id);
    atualizarResumo();
    return true;
  }
  btSalvar.addEventListener("click", async () => {
    btSalvar.disabled = true;
    try { if (await salvar()) { toast("Notas salvas."); aoMudar?.(); } }
    catch (e) { console.error(e); mensagem(erro, "Não foi possível salvar. " + mensagemDeErro(e)); }
    finally { btSalvar.disabled = false; }
  });
  btPublicar.addEventListener("click", async () => {
    mensagem(erro);
    btPublicar.disabled = true;
    try {
      if (folha.publicada) {
        if (!confirmarPublicar) {
          confirmarPublicar = true; aviso.hidden = false;
          aviso.textContent = "Despublicar: os alunos deixam de ver estas notas e a ação fica no registro de alterações. Clique em \"Confirmar despublicar\".";
          btPublicar.textContent = "Confirmar despublicar";
          return;
        }
        await despublicarFolha(sessao, folha, turma.nome);
        toast("Notas despublicadas. Os alunos não veem mais."); j.fechar({ forcar: true }); aoMudar?.();
        return;
      }
      if (!await salvar()) return;
      const semNota = alunos.filter(a => !itens[a.uid]).length;
      if (semNota && !confirmarPublicar) {
        confirmarPublicar = true; aviso.hidden = false;
        aviso.textContent = `${nAlunosTexto(semNota)} ainda sem nota. Eles não verão nada nesta folha. Clique em "Publicar mesmo assim" para continuar.`;
        btPublicar.textContent = "Publicar mesmo assim";
        return;
      }
      await publicarFolha(folha);
      toast(`"${folha.titulo}" publicada. Os alunos já podem ver as próprias notas.`); j.fechar({ forcar: true }); aoMudar?.();
    } catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); }
    finally { btPublicar.disabled = false; }
  });

  const j = abrirJanela({
    titulo: folha.titulo, classe: "grande",
    conteudo: [
      el("div", { class: "turma-chips" }, chipFolha(folha), chip({ texto: turma.nome })),
      podeEditar ? cabeca : el("p", { class: "mudo" }, `Nota máxima ${formatarNota(folha.notaMax)}${folha.atividadeId ? " · notas da atividade" : ""}`),
      resumo,
      el("div", { class: "lista-notas" }, ...(linhas.length ? linhas.map(l => l.no) : [el("div", { class: "vazio" }, "A turma ainda não tem alunos.")])),
      podeEditar ? el("p", { class: "dica-campo" }, "Deixe a nota em branco para não lançar (ou para apagar uma nota já lançada). Os alunos só veem depois de \"Publicar\".") : null,
      aviso, erro],
    acoes: podeEditar ? [btApagar, fechar, btSalvar, btPublicar].filter(Boolean) : [fechar],
    podeFechar: () => {
      if (!podeEditar || avisoFechar || !sujo()) return true;
      avisoFechar = true; aviso.hidden = false;
      aviso.textContent = "Há notas não salvas. Clique em \"Salvar\" ou feche de novo para descartar.";
      return false;
    }
  });
  atualizarResumo();
}

// ===================================================================
// Linha de folha (aba Notas / card "Notas lançadas" / página Notas do professor)
// ===================================================================
export function linhaFolha(sessao, turma, f, { itens, alunos, podeEditar, hrefAtividade, aoMudar, compacta }) {
  const abrir = () => janelaFolha(sessao, turma, f, { alunos, podeEditar, aoMudar });
  const botao = f.atividadeId && hrefAtividade
    ? el("a", { class: "botao pequeno neutro", href: hrefAtividade }, "Abrir atividade")
    : el("button", { type: "button", class: "botao pequeno " + (f.publicada || !podeEditar ? "neutro" : ""), onclick: abrir },
      f.publicada || !podeEditar ? "Ver notas" : "Lançar notas");
  return el("div", { class: "linha" + (compacta ? " linha-compacta" : "") },
    el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, f.titulo),
      el("span", { class: "mudo" }, resumoFolha(f, itens, alunos.length))),
    el("div", { class: "linha-acoes" }, chipFolha(f), botao));
}

// ===================================================================
// Aluno: quadro de uma turma com as próprias notas publicadas
// notas: [{ folha, item }]
// ===================================================================
export function quadroNotasAluno(turma, notas, { mostrarTitulo = true } = {}) {
  const linhas = notas.map(({ folha, item }) => el("div", { class: "linha linha-nota-aluno" },
    el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, folha.titulo),
      item.comentario ? el("span", { class: "comentario-nota" }, `“${item.comentario}”`) : null,
      el("span", { class: "mudo" }, `Publicada em ${diaMesHora(folha.publicadaEm).split(" às ")[0]}`)),
    el("div", { class: "valor-nota", "aria-label": `${formatarNota(item.valor)} de ${formatarNota(folha.notaMax)}` },
      el("b", {}, formatarNota(item.valor)), el("span", {}, ` de ${formatarNota(folha.notaMax)}`))));
  const c = card({ titulo: mostrarTitulo ? turma.nome : "Minhas notas",
    corpo: linhas.length ? linhas : [el("div", { class: "vazio" }, "Nenhuma nota publicada ainda.")] });
  return comCorDaTurma(c, turma.cor);
}

