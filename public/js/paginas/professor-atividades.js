// "Atividades" do professor (Fase 5):
//  - sem nada no endereço: todas as atividades das turmas ativas, com filtro por turma;
//  - com #turmaId/atividadeId: a TELA DA ATIVIDADE ("Ver entregas" / "Corrigir"): quem entregou e quem não entregou,
//    marcar como corrigida, desfazer entrega (com registro), editar, estender prazo, reabrir entrega, apagar.
import { el, toast, esqueletoLinhas, confirmar, mensagem } from "../ui/ui.js";
import { iconeEl } from "../ui/icones.js";
import { card, chip, comCorDaTurma } from "../ui/componentes.js";
import { diaMesHora, dataHora, ms } from "../utils/datas.js";
import { chipDePrazo, ordenarAtividades } from "../utils/prazos.js";
import { minhasTurmas, alunosDaTurma, atividadesComEntregas, atividadePorId, turmaPorId, entregasDaAtividade, desfeitasDaAtividade, folhaPorId, itensDaFolha, folhasDaTurma } from "../servicos/dados.js";
import { garantirFolhaDaAtividade, salvarNotas, publicarFolha, despublicarFolha, apagarFolha } from "../servicos/notas.js";
import { lerNota, formatarNota, media, idFolhaDaAtividade } from "../utils/notas-util.js";
import { chipFolha } from "../ui/notas-ui.js";
import { linhaAtividadeProfessor, janelaAtividade, botaoMenuAtividade, hrefAtividade } from "../ui/atividades-ui.js";
import { marcarCorrigida, desfazerEntregaDoAluno } from "../servicos/atividades.js";
import { mensagemDeErro } from "../core/auth.js";

let relogio = null; // atualização dos chips de prazo a cada minuto
// Notas digitadas e ainda não salvas, por atividade ("turma/atividade" -> Map(aluno -> { nota, comentario })).
// Sobrevivem a recarregar a tela (ex.: "Marcar como corrigida"); ao sair da página o navegador pergunta.
const notasNaoSalvas = new Map();
window.addEventListener("beforeunload", e => { if ([...notasNaoSalvas.values()].some(m => m.size)) { e.preventDefault(); e.returnValue = ""; } });

export async function montar(ctx) {
  const desenhar = () => {
    clearInterval(relogio);
    const [turmaId, atividadeId] = decodeURIComponent(location.hash.slice(1)).split("/");
    return turmaId && atividadeId ? telaAtividade(ctx, turmaId, atividadeId) : listaGeral(ctx);
  };
  window.addEventListener("hashchange", desenhar);
  await desenhar();
}

// ===================================================================
// Lista geral com filtro por turma
// ===================================================================
async function listaGeral({ sessao, conteudo, href, definirCabecalhoMovel }) {
  document.title = "Fatesck - Atividades";
  definirCabecalhoMovel("Atividades", "Carregando…");
  const filtro = el("select", { id: "filtro-turma", "aria-label": "Filtrar por turma" }, el("option", { value: "" }, "Todas as turmas"));
  const lista = card({ titulo: "Atividades", classe: "lista-cards", extra: el("div", { class: "campo campo-filtro" }, filtro), corpo: esqueletoLinhas(3) });
  conteudo.replaceChildren(el("h1", { class: "so-desktop", style: { marginBottom: "20px" } }, "Atividades"),
    el("div", { class: "so-movel filtro-movel" }), lista);

  const turmas = (await minhasTurmas(sessao.uid)).filter(t => t.meuPapel === "professor" && !t.arquivada);
  const dados = await Promise.all(turmas.map(async t => {
    const [alunos, atividades, folhas] = await Promise.all([alunosDaTurma(t.id), atividadesComEntregas(t.id), folhasDaTurma(t.id)]);
    const publicadas = new Set(folhas.filter(f => f.atividadeId && f.publicada).map(f => f.atividadeId));
    return { t, alunos: alunos.length, atividades: atividades.map(a => ({ ...a, turmaNome: t.nome, notasPublicadas: publicadas.has(a.id) })) };
  }));
  filtro.append(...turmas.map(t => el("option", { value: t.id }, t.nome)));
  // o filtro também aparece no celular (o cabeçalho do card some lá)
  conteudo.querySelector(".filtro-movel").append(el("div", { class: "campo" }, el("label", { for: "filtro-turma-movel" }, "Turma"),
    (() => { const f = filtro.cloneNode(true); f.id = "filtro-turma-movel"; f.addEventListener("change", () => { filtro.value = f.value; pintar(); }); return f; })()));
  filtro.addEventListener("change", pintar);

  function pintar() {
    const escolhidas = dados.filter(d => !filtro.value || d.t.id === filtro.value);
    const todas = ordenarAtividades(escolhidas.flatMap(d => d.atividades));
    const porTurma = Object.fromEntries(dados.map(d => [d.t.id, d]));
    const cabeca = lista.querySelector(".card-cabeca");
    const linhas = todas.map(a => linhaAtividadeProfessor(sessao, porTurma[a.turmaId].t, a, {
      alunos: porTurma[a.turmaId].alunos, entregas: a.entregas, hrefDetalhe: hrefAtividade(href, a.turmaId, a.id),
      podeEditar: a.autorUid === sessao.uid, mostrarTurma: true, notasPublicadas: a.notasPublicadas, aoMudar: () => location.reload()
    }));
    lista.replaceChildren(cabeca, ...(linhas.length ? linhas : [el("div", { class: "vazio" },
      turmas.length ? "Nenhuma atividade ainda. Crie uma na página da turma (aba Atividades)." : "Você ainda não tem turmas. Crie a primeira em \"Minhas turmas\".")]));
    const corrigir = todas.reduce((s, a) => s + a.entregas.filter(e => !e.corrigida).length, 0);
    definirCabecalhoMovel("Atividades", corrigir ? `${corrigir} ${corrigir === 1 ? "entrega" : "entregas"} para corrigir` : `${todas.length} ${todas.length === 1 ? "atividade" : "atividades"}`);
  }
  pintar();
  relogio = setInterval(pintar, 60000);
}

// ===================================================================
// Tela da atividade
// ===================================================================
async function telaAtividade({ sessao, conteudo, href, definirCabecalhoMovel }, turmaId, atividadeId) {
  conteudo.replaceChildren(card({ titulo: "Carregando…", corpo: esqueletoLinhas(3) }));
  const voltarLista = el("a", { class: "voltar", href: href("atividades") }, iconeEl("voltar"), "Atividades");
  let turma, at;
  try { [turma, at] = await Promise.all([turmaPorId(turmaId), atividadePorId(turmaId, atividadeId)]); }
  catch (e) { console.warn(e); }
  if (!turma || !at) {
    definirCabecalhoMovel("Atividade", "");
    conteudo.replaceChildren(voltarLista, el("div", { class: "card" }, el("div", { class: "vazio" }, "Atividade não encontrada. Ela pode ter sido apagada.")));
    return;
  }
  at.turmaNome = turma.nome;
  document.title = "Fatesck - " + at.titulo;
  definirCabecalhoMovel(at.titulo, turma.nome);
  const [alunos, entregas, desfeitas, folha] = await Promise.all([alunosDaTurma(turmaId), entregasDaAtividade(turmaId, atividadeId),
    desfeitasDaAtividade(turmaId, atividadeId), folhaPorId(turmaId, idFolhaDaAtividade(atividadeId))]);
  const itens = folha ? await itensDaFolha(turmaId, folha.id) : {};
  const ehAutor = at.autorUid === sessao.uid, pode = ehAutor && !turma.arquivada;
  const recarregar = () => telaAtividade({ sessao, conteudo, href, definirCabecalhoMovel }, turmaId, atividadeId);
  const hrefTurma = href("turma") + "?id=" + encodeURIComponent(turmaId) + "#atividades";

  // ----- topo -----
  const c = chipDePrazo(at);
  const entregou = new Set(entregas.map(e => e.alunoUid));
  const faltam = alunos.filter(a => !entregou.has(a.uid));
  const nEntregas = entregas.length, total = alunos.length;
  const barra = el("span", { class: "progresso grande", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(Math.min(nEntregas, total)) }, el("span"));
  barra.firstChild.style.width = total ? `${Math.min(100, Math.round(nEntregas / total * 100))}%` : "0%";
  const topo = comCorDaTurma(el("section", { class: "card" },
    el("div", { class: "card-corpo topo-atividade" },
      el("div", { class: "linha-info" },
        el("a", { class: "voltar", href: hrefTurma }, iconeEl("voltar"), turma.nome),
        el("h1", { class: "titulo-atividade" }, at.titulo),
        el("span", { class: "mudo" }, `Prazo ${dataHora(at.prazo)}${at.reabertaAte && ms(at.reabertaAte) > ms(at.prazo) + 24 * 3600e3 ? ` · entregas reabertas até ${dataHora(at.reabertaAte)}` : ""}${at.notaMax ? ` · nota máxima ${String(at.notaMax).replace(".", ",")}` : ""}`),
        el("div", { class: "turma-chips", style: { paddingTop: "8px" } },
          chip({ texto: c.texto, curto: c.curto, classe: c.classe, icone: "relogio" }),
          turma.arquivada ? chip({ texto: "Turma arquivada", icone: "arquivo" }) : null,
          !ehAutor ? chip({ texto: "Atividade de outro professor" }) : null)),
      pode ? el("div", { class: "linha-acoes" },
        el("button", { type: "button", class: "botao neutro", onclick: () => janelaAtividade(sessao, turma, at, recarregar) }, iconeEl("lapis"), "Editar"),
        botaoMenuAtividade(sessao, at, { nEntregas, aoMudar: recarregar, aoApagar: () => { location.href = hrefTurma; } })) : null),
    at.descricao ? el("div", { class: "card-corpo", style: { paddingTop: "0" } }, el("p", { class: "texto-longo" }, at.descricao)) : null,
    el("div", { class: "card-rodape" }, el("span", { class: "linha-progresso" }, barra, el("b", {}, `${nEntregas} de ${total} entregaram`)),
      el("span", {}, `${entregas.filter(e => !e.corrigida).length} para corrigir · ${entregas.filter(e => e.atrasada).length} com atraso`))), turma.cor);

  // ----- notas da atividade (decisão do Fernando: campo de nota em cada entrega; grava no botão "Salvar notas") -----
  const notaMax = folha?.notaMax || at.notaMax || 10;
  const chave = `${turmaId}/${atividadeId}`;
  const pendentes = notasNaoSalvas.get(chave) || new Map();  // o que foi digitado e ainda não foi salvo (sobrevive a "Marcar como corrigida")
  notasNaoSalvas.set(chave, pendentes);
  const nomeDe = uid => alunos.find(a => a.uid === uid)?.nome || entregas.find(e => e.alunoUid === uid)?.alunoNome || "Aluno";
  const resumoNotas = el("span", { class: "mudo", "aria-live": "polite" });
  const erroNotas = el("p", { class: "erro", role: "alert" });
  function camposDeNota(uid) {
    const item = itens[uid], p = pendentes.get(uid);
    const nota = el("input", { type: "text", inputmode: "decimal", class: "campo-nota", disabled: !pode, placeholder: "—",
      value: p ? p.nota : item ? formatarNota(item.valor) : "", "aria-label": `Nota de ${nomeDe(uid)} (de 0 a ${formatarNota(notaMax)})` });
    const comentario = el("input", { type: "text", maxlength: "500", disabled: !pode, placeholder: "Comentário (opcional)",
      value: p ? p.comentario : item?.comentario || "", "aria-label": `Comentário para ${nomeDe(uid)}` });
    const guardar = () => {
      const original = { nota: item ? formatarNota(item.valor) : "", comentario: item?.comentario || "" };
      if (nota.value.trim() === original.nota && comentario.value.trim() === original.comentario) pendentes.delete(uid);
      else pendentes.set(uid, { nota: nota.value, comentario: comentario.value });
      atualizarResumoNotas();
    };
    nota.addEventListener("input", () => { guardar(); atualizarDestaqueNota(nota); }); comentario.addEventListener("input", guardar);
    atualizarDestaqueNota(nota);
    return el("div", { class: "campos-nota" }, el("span", { class: "rotulo-nota" }, `Nota (de ${formatarNota(notaMax)})`), nota, comentario);
  }
  function atualizarDestaqueNota(campo) {
    const r = lerNota(campo.value, notaMax), abaixo = !r.erro && typeof r.valor === "number" && r.valor < notaMax * .6;
    campo.classList.toggle("nota-abaixo", abaixo);
    campo.title = abaixo ? "Nota abaixo de 60% da nota máxima" : "";
  }
  function valoresAtuais() {
    const uids = new Set([...Object.keys(itens), ...pendentes.keys()]);
    return [...uids].map(uid => pendentes.has(uid) ? lerNota(pendentes.get(uid).nota, notaMax).valor : itens[uid]?.valor).filter(v => typeof v === "number");
  }
  function atualizarResumoNotas() {
    const v = valoresAtuais(), m = media(v), abaixo = v.filter(n => n < notaMax * .6).length;
    resumoNotas.textContent = `${v.length} de ${total} com nota${m !== null ? ` · média da turma ${formatarNota(m)}` : ""} · ${abaixo} abaixo de 60%${pendentes.size ? ` · ${pendentes.size} ${pendentes.size === 1 ? "mudança não salva" : "mudanças não salvas"}` : ""}`;
  }
  async function salvarNotasDaAtividade() {
    mensagem(erroNotas);
    const mudancas = [], erros = [];
    for (const [uid, p] of pendentes) {
      const r = lerNota(p.nota, notaMax), c = p.comentario.trim();
      if (r.erro) { erros.push(`${nomeDe(uid)}: ${r.erro}`); continue; }
      if (r.valor === null && c) { erros.push(`${nomeDe(uid)}: o comentário precisa de uma nota.`); continue; }
      if (r.valor === null && !itens[uid]) continue;
      mudancas.push({ alunoUid: uid, valor: r.valor, comentario: c });
    }
    if (erros.length) { mensagem(erroNotas, erros.slice(0, 3).join(" · ")); return null; }
    if (!mudancas.length) { pendentes.clear(); return folha; }
    const f = await garantirFolhaDaAtividade(sessao, at); // cria "atv_{id}" na primeira vez (antes das notas)
    await salvarNotas(f, mudancas);
    pendentes.clear();
    return f;
  }
  const btSalvarNotas = el("button", { type: "button", class: "botao neutro" }, "Salvar notas");
  btSalvarNotas.addEventListener("click", async () => {
    btSalvarNotas.disabled = true;
    try { if (await salvarNotasDaAtividade() !== null) { toast("Notas salvas."); recarregar(); } }
    catch (e) { console.error(e); mensagem(erroNotas, "Não foi possível salvar. " + mensagemDeErro(e)); }
    finally { btSalvarNotas.disabled = false; }
  });
  const btPublicar = el("button", { type: "button", class: "botao" }, folha?.publicada ? "Despublicar" : "Publicar notas");
  btPublicar.addEventListener("click", async () => {
    mensagem(erroNotas);
    try {
      if (folha?.publicada) {
        if (!await confirmar("Despublicar as notas?", ["Os alunos deixam de ver as notas desta atividade.", "A ação fica no registro de alterações."], "Despublicar")) return;
        await despublicarFolha(sessao, folha, turma.nome); toast("Notas despublicadas."); recarregar(); return;
      }
      const f = await salvarNotasDaAtividade();
      if (f === null) return;
      if (!f) { mensagem(erroNotas, "Lance pelo menos uma nota antes de publicar."); return; }
      const comNota = new Set(Object.keys(await itensDaFolha(turmaId, f.id)));
      const semNota = alunos.filter(a => !comNota.has(a.uid)).length;
      if (!await confirmar("Publicar as notas?", [
        `Cada aluno vê só a própria nota. Quem entregou há menos de 4 horas só vê depois que completar 4 horas.`,
        semNota ? `${semNota} ${semNota === 1 ? "aluno está" : "alunos estão"} sem nota e não ${semNota === 1 ? "verá" : "verão"} nada.` : "Todos os alunos têm nota."], "Publicar")) { recarregar(); return; }
      await publicarFolha(f); toast("Notas publicadas."); recarregar();
    } catch (e) { console.error(e); mensagem(erroNotas, mensagemDeErro(e)); }
  });
  // Apagar o rascunho de notas da atividade (nunca publicada): apaga a folha e as notas, com registro.
  const btApagarRascunho = folha && !folha.publicada ? el("button", { type: "button", class: "botao sec" }, "Apagar rascunho") : null;
  btApagarRascunho?.addEventListener("click", async () => {
    mensagem(erroNotas);
    if (!await confirmar("Apagar o rascunho de notas?", [`Todas as notas lançadas em "${at.titulo}" serão apagadas. Isso não pode ser desfeito.`,
      "A ação fica no registro de alterações. Você pode lançar as notas de novo depois."], "Apagar rascunho")) return;
    try { await apagarFolha(sessao, folha, turma.nome); pendentes.clear(); toast("Rascunho de notas apagado."); recarregar(); }
    catch (e) { console.error(e); mensagem(erroNotas, "Não foi possível apagar. " + mensagemDeErro(e)); }
  });
  const barraNotas = comCorDaTurma(el("section", { class: "card barra-notas", "aria-label": "Notas desta atividade" },
    el("div", { class: "card-corpo topo-atividade" },
      el("div", { class: "linha-info" },
        el("h2", { class: "titulo-secao" }, "Notas desta atividade"),
        el("div", { class: "turma-chips", style: { paddingTop: "4px" } }, folha ? chipFolha(folha) : chip({ texto: "Sem notas ainda" }), resumoNotas),
        el("span", { class: "dica-campo" }, pode ? "Digite a nota em cada entrega e clique em \"Salvar notas\". Os alunos só veem depois de \"Publicar\"." : "Só o professor que criou a atividade lança as notas."),
        erroNotas),
      pode ? el("div", { class: "linha-acoes" }, btApagarRascunho, btSalvarNotas, btPublicar) : null)), turma.cor);
  atualizarResumoNotas();

  // ----- quem entregou -----
  const quemDesfez = d => d.desfeitaPorPapel === "aluno" ? "pelo aluno" : d.desfeitaPorPapel === "admin" ? "pela administração" : "pelo professor";
  const linhaEntrega = e => {
    const acoes = el("div", { class: "linha-acoes" });
    if (e.corrigida) {
      acoes.append(chip({ texto: "Corrigida", icone: "check", classe: "chip escuro" }));
      if (pode) acoes.append(el("button", { type: "button", class: "link", onclick: ev => corrigir(ev.currentTarget, e, false) }, "Desmarcar"));
    } else if (pode) acoes.append(el("button", { type: "button", class: "botao pequeno", onclick: ev => corrigir(ev.currentTarget, e, true) }, iconeEl("check"), "Marcar como corrigida"));
    if (pode) acoes.append(el("button", { type: "button", class: "botao pequeno neutro", onclick: () => desfazer(e) }, "Desfazer entrega"));
    const d = desfeitas[e.alunoUid];
    return el("div", { class: "linha linha-entrega" },
      el("div", { class: "linha-info" },
        el("span", { class: "linha-titulo" }, e.alunoNome),
        el("span", { class: "mudo" }, `Entregue em ${diaMesHora(e.entregueEm)}`, e.atrasada ? el("span", { class: "alerta-texto" }, " · atrasada") : null),
        d && ms(d.desfeitaEm) < ms(e.entregueEm) ? el("span", { class: "mudo" }, `Entregou de novo (a entrega anterior foi desfeita ${quemDesfez(d)} em ${diaMesHora(d.desfeitaEm)}).`) : null,
        e.texto ? el("p", { class: "texto-longo resposta" }, e.texto) : null,
        e.link ? el("a", { class: "link-simples quebra", href: e.link, target: "_blank", rel: "noopener noreferrer" }, e.link) : null,
        camposDeNota(e.alunoUid)),
      acoes);
  };
  async function corrigir(botao, e, valor) {
    botao.disabled = true;
    try { await marcarCorrigida(at, e.alunoUid, valor); toast(valor ? `Entrega de ${e.alunoNome} marcada como corrigida.` : "Correção desmarcada."); recarregar(); }
    catch (err) { console.error(err); toast("Não foi possível. " + mensagemDeErro(err), { tipo: "erro" }); botao.disabled = false; }
  }
  async function desfazer(e) {
    if (!await confirmar("Desfazer a entrega?", [`A entrega de ${e.alunoNome} (feita em ${diaMesHora(e.entregueEm)}) será apagada e ficará no registro de alterações.`,
      "O aluno poderá entregar de novo enquanto o prazo estiver aberto."], "Desfazer entrega")) return;
    try { await desfazerEntregaDoAluno(sessao, at, e); toast(`Entrega de ${e.alunoNome} desfeita.`); recarregar(); }
    catch (err) { console.error(err); toast("Não foi possível desfazer. " + mensagemDeErro(err), { tipo: "erro" }); }
  }
  const cardEntregaram = card({ titulo: `Entregaram (${nEntregas})`,
    corpo: nEntregas ? entregas.map(linhaEntrega) : [el("div", { class: "vazio" }, "Ninguém entregou ainda.")] });

  // ----- quem não entregou -----
  const cardFaltam = card({ titulo: `Não entregaram (${faltam.length})`,
    corpo: faltam.length ? faltam.map(a => {
      const d = desfeitas[a.uid];
      // a nota de quem teve a entrega desfeita FICA para o professor (decisão A3): ele pode editar ou apagar
      return el("div", { class: "linha linha-entrega" }, el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, a.nome),
        d ? el("span", { class: "alerta-texto" }, `Entrega desfeita ${quemDesfez(d)} em ${diaMesHora(d.desfeitaEm)}`) : null,
        itens[a.uid] || pendentes.has(a.uid) ? camposDeNota(a.uid) : null));
    }) : [el("div", { class: "vazio" }, total ? "Todos entregaram." : "A turma ainda não tem alunos.")] });

  conteudo.replaceChildren(el("div", { class: "so-desktop", style: { marginBottom: "12px" } }, voltarLista), topo, barraNotas,
    el("div", { class: "grade-atividade" }, cardEntregaram, cardFaltam));
}
