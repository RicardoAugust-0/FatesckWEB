// Telas do chat (Fase 7b) — decisões do Fernando: no computador, lista à esquerda + conversa à direita;
// no celular, primeiro a lista e depois a conversa em tela cheia (com seta de voltar); mensagens em balões
// (as minhas à direita, em vermelho). Tudo em tempo real (onSnapshot); as escutas são desligadas ao sair.
import { el, toast, confirmar, abrirJanela } from "./ui.js";
import { iconeEl } from "./icones.js";
import { horaCurta, rotuloDia } from "./datas.js";
import { rotuloPapel, corDaTurma } from "./componentes.js";
import { mensagemDeErro } from "./auth.js";
import { marcarVisto } from "./avisos.js";
import {
  MAX_MENSAGEM, chaveLeitura, ouvirMensagens, ouvirNovas, ouvirMinhasConversas, enviarMensagem, abrirConversa, apagarMensagem
} from "./chat.js";
import { minhasTurmas, professoresDaTurma, alunosDaTurma, idsRepresentantes, minhasLeituras } from "./dados.js";

const inicial = nome => (nome || "?").trim().charAt(0).toUpperCase();

// ---------------------------------------------------------------------------------------------------
// Uma conversa aberta: cabeçalho, balões e caixa de escrever. Usada no site e na administração.
//   alvo: { tipo: "turma" | "privada", id } · papel: etiqueta de quem escreve no chat da turma
//   somenteLeitura: texto explicando por que não dá para escrever (turma arquivada, administração) ou null
//   podeApagar: professor da turma (chat da turma aberta) ou admin · professorUid: só nas privadas (etiqueta "Professor")
// Devolve { no, parar() }.
// ---------------------------------------------------------------------------------------------------
export function painelConversa({ sessao, alvo, titulo, subtitulo, onde, papel, somenteLeitura = null, podeApagar = false,
  representantes = new Set(), professorUid = null, aoVoltar = null, aoMensagens = null }) {
  const lista = el("div", { class: "chat-baloes" }, el("div", { class: "vazio" }, "Carregando…"));
  const area = el("div", { class: "chat-area", tabindex: "0", role: "group", "aria-label": `Mensagens: ${titulo}` }, lista);
  const anuncio = el("div", { class: "sr-only", "aria-live": "polite" });
  let primeira = true, idsVistos = new Set(), parado = false;

  function balao(m) {
    const minha = m.autorUid === sessao.uid;
    const etiqueta = alvo.tipo === "turma" ? rotuloPapel(m.autorPapel, m.autorUid, representantes)
      : (m.autorUid === professorUid ? "Professor" : "");
    const apagar = podeApagar ? el("button", { type: "button", class: "chat-apagar", title: "Apagar mensagem",
      "aria-label": `Apagar mensagem de ${m.autorNome}`, onclick: () => remover(m) }, iconeEl("lixeira")) : null;
    // nas minhas mensagens o nome não aparece; a etiqueta de representante sim (é como os outros me veem)
    const autor = minha
      ? (m.autorPapel === "representante" ? el("div", { class: "chat-autor" }, el("span", { class: "chip" }, etiqueta)) : null)
      : el("div", { class: "chat-autor" }, el("b", {}, m.autorNome), etiqueta ? el("span", { class: "chip" }, etiqueta) : null);
    return el("div", { class: "chat-msg" + (minha ? " minha" : "") }, autor,
      el("div", { class: "chat-linha" },
        el("div", { class: "chat-balao" }, el("p", {}, m.texto), el("span", { class: "chat-hora" }, horaCurta(m.criadoEm))),
        apagar));
  }

  function desenhar(msgs) {
    if (parado) return;
    const noFim = area.scrollHeight - area.scrollTop - area.clientHeight < 120;
    const nos = [];
    let dia = "";
    for (const m of msgs) {
      const r = rotuloDia(m.criadoEm);
      if (r !== dia) { dia = r; nos.push(el("div", { class: "chat-dia" }, el("span", {}, r))); }
      nos.push(balao(m));
    }
    const novas = msgs.filter(m => !idsVistos.has(m.id));
    lista.replaceChildren(...(nos.length ? nos : [el("div", { class: "vazio" },
      somenteLeitura ? "Nenhuma mensagem nesta conversa." : "Nenhuma mensagem ainda. Escreva a primeira!")]));
    if (primeira || noFim || novas.some(m => m.autorUid === sessao.uid)) area.scrollTop = area.scrollHeight;
    const deOutros = novas.filter(m => m.autorUid !== sessao.uid);
    if (!primeira && deOutros.length) anuncio.textContent = `Nova mensagem de ${deOutros[deOutros.length - 1].autorNome}`;
    idsVistos = new Set(msgs.map(m => m.id));
    primeira = false;
    aoMensagens?.(msgs);
  }

  async function remover(m) {
    const sim = await confirmar("Apagar esta mensagem?",
      [`A mensagem de ${m.autorNome} some para todo mundo e não dá para desfazer.`, "Fica anotado no registro de alterações quem apagou e quando (o texto não é guardado)."], "Apagar");
    if (!sim) return;
    try {
      await apagarMensagem(alvo, m, sessao, onde);
      toast("Mensagem apagada.");
    } catch (e) {
      console.error(e);
      toast("Não foi possível apagar a mensagem. " + mensagemDeErro(e), { tipo: "erro" });
    }
  }

  // ----- caixa de escrever (ou o aviso de somente leitura) -----
  let rodape;
  if (somenteLeitura) {
    rodape = el("div", { class: "chat-rodape leitura", role: "note" }, iconeEl("arquivo"), el("span", {}, somenteLeitura));
  } else {
    const campo = el("textarea", { rows: "1", maxlength: String(MAX_MENSAGEM), placeholder: "Escreva uma mensagem…", "aria-label": "Mensagem" });
    const botao = el("button", { type: "submit", class: "botao chat-enviar", "aria-label": "Enviar mensagem" }, iconeEl("enviar"), el("span", { class: "so-desktop" }, "Enviar"));
    const ajustar = () => { campo.style.height = "auto"; campo.style.height = Math.min(campo.scrollHeight + 2, 132) + "px"; };
    let enviando = false;
    const enviar = async () => {
      const texto = campo.value.trim();
      if (!texto || enviando) return;
      enviando = true;
      campo.value = ""; ajustar();
      try {
        await enviarMensagem(alvo, texto, sessao, papel);
      } catch (e) {
        console.error(e);
        if (!campo.value) { campo.value = texto; ajustar(); } // devolve o texto para a pessoa não perder
        toast("A mensagem não foi enviada. " + mensagemDeErro(e), { tipo: "erro" });
      } finally { enviando = false; }
    };
    campo.addEventListener("input", ajustar);
    // Enter envia; Shift+Enter quebra a linha (no celular, o Enter do teclado quebra a linha e o botão envia)
    campo.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !matchMedia("(max-width: 520px)").matches) { e.preventDefault(); enviar(); }
    });
    rodape = el("form", { class: "chat-rodape", novalidate: true, onsubmit: e => { e.preventDefault(); enviar(); campo.focus(); } }, campo, botao);
  }

  const cabeca = el("header", { class: "chat-cabeca" },
    aoVoltar ? el("button", { type: "button", class: "chat-voltar", "aria-label": "Voltar para a lista de conversas", onclick: aoVoltar }, iconeEl("voltar")) : null,
    el("div", { class: "chat-cabeca-texto" }, el("h2", {}, titulo), subtitulo ? el("span", {}, subtitulo) : null));
  const no = el("section", { class: "chat-conversa", "aria-label": `Conversa: ${titulo}` }, cabeca, area, anuncio, rodape);

  const desligar = ouvirMensagens(alvo, desenhar, () => {
    if (primeira) lista.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar as mensagens. Verifique sua conexão e tente de novo."));
  });
  return { no, parar() { parado = true; desligar(); } };
}

// ---------------------------------------------------------------------------------------------------
// Chat do site (aluno e professor).
//   turmaFixa: a turma da aba "Chat" da página da turma (só a conversa, sem lista). Sem ela: página Chat completa.
//   aoContar(total): página Chat — total de não lidas, ao vivo (número do menu).
//   aoLer(): aba da turma — avisa que algo foi marcado como lido (para o menu recalcular).
// Devolve { parar() } na hora; os dados chegam depois.
// ---------------------------------------------------------------------------------------------------
export function montarChat(container, { sessao, perfil, turmaFixa = null, aoContar, aoLer }) {
  const ehProf = perfil === "professor", uid = sessao.uid;
  const escutas = new Map(); // chave -> desligar (contagens de não lidas)
  const limpezas = [];
  let parado = false, painel = null, ativa = null; // ativa: { chave, alvo }
  const visto = {};   // chave -> ms do "visto por último" (cópia local, atualizada ao marcar)
  const novas = {};   // chave -> [{ autorUid, quando }] que chegaram depois da última visita
  let agendado = null;

  const parar = () => {
    parado = true;
    painel?.parar();
    for (const d of escutas.values()) d();
    for (const f of limpezas) f();
    clearTimeout(agendado);
    document.body.classList.remove("chat-tela-cheia");
  };

  const naoLidas = chave => ativa?.chave === chave && !document.hidden ? 0
    : (novas[chave] || []).filter(m => m.autorUid !== uid && m.quando > (visto[chave] || 0)).length;

  // Marca a conversa aberta como lida (só com a página visível). Junta chamadas seguidas numa só.
  function marcarLida(msgs) {
    if (!ativa || ativa.semLeitura || document.hidden) return;
    const { chave } = ativa;
    const ultima = Math.max(0, ...(msgs || []).map(m => m.criadoEm?.toMillis?.() ?? 0));
    visto[chave] = Math.max(Date.now(), ultima, visto[chave] || 0);
    clearTimeout(agendado);
    agendado = setTimeout(async () => { await marcarVisto(uid, [chave]); if (!parado) aoLer?.(); }, 400);
  }

  container.replaceChildren(el("div", { class: "card" }, el("div", { class: "vazio" }, "Carregando o chat…")));
  (turmaFixa ? iniciarTurma() : iniciarPagina()).catch(e => {
    console.error(e);
    if (!parado) container.replaceChildren(el("div", { class: "card" }, el("div", { class: "vazio" }, "Não foi possível carregar o chat. Verifique sua conexão e tente de novo.")));
  });
  return { parar };

  // ----- aba "Chat" da página da turma: só a conversa da turma -----
  async function iniciarTurma() {
    const reps = await idsRepresentantes();
    if (parado) return;
    const alvo = { tipo: "turma", id: turmaFixa.id };
    ativa = { chave: chaveLeitura(alvo), alvo, semLeitura: !!turmaFixa.arquivada };
    painel = painelConversa(opcoesTurma(turmaFixa, reps, { aoMensagens: marcarLida }));
    const aoVoltarAVer = () => { if (!document.hidden) marcarLida(); };
    document.addEventListener("visibilitychange", aoVoltarAVer);
    limpezas.push(() => document.removeEventListener("visibilitychange", aoVoltarAVer));
    container.replaceChildren(el("div", { class: "chat-layout so-conversa aberta" }, painel.no));
  }

  function opcoesTurma(t, reps, extra = {}) {
    return {
      sessao, alvo: { tipo: "turma", id: t.id }, titulo: t.nome, subtitulo: "Chat da turma", onde: `chat da turma ${t.nome}`,
      papel: ehProf ? "professor" : (reps.has(uid) ? "representante" : "aluno"), representantes: reps,
      somenteLeitura: t.arquivada ? "Turma arquivada: o chat fica só para leitura." : null,
      podeApagar: ehProf && !t.arquivada, ...extra
    };
  }

  // ----- página Chat: lista (turmas + conversas privadas) e a conversa escolhida -----
  async function iniciarPagina() {
    const [todas, reps, leituras] = await Promise.all([minhasTurmas(uid), idsRepresentantes(), minhasLeituras(uid)]);
    if (parado) return;
    Object.assign(visto, leituras);
    const turmas = todas.filter(t => t.meuPapel === (ehProf ? "professor" : "aluno"));
    const abertas = turmas.filter(t => !t.arquivada);
    let conversas = [], conversasProntas = false;

    const listaNo = el("nav", { class: "chat-lista", "aria-label": "Conversas" });
    const palco = el("div", { class: "chat-palco" });
    const layout = el("div", { class: "chat-layout" }, listaNo, palco);
    container.replaceChildren(el("h1", { class: "so-desktop chat-titulo" }, "Chat"), layout);

    const movel = matchMedia("(max-width: 520px)");
    let empilhado = false; // no celular, o "voltar" do aparelho fecha a conversa (em vez de sair da página)

    function contar(chave, alvo) {
      if (escutas.has(chave)) return;
      escutas.set(chave, ouvirNovas(alvo, visto[chave], lista => { novas[chave] = lista; atualizarNumeros(); }));
    }
    function atualizarNumeros() {
      if (parado) return;
      let total = 0;
      for (const b of listaNo.querySelectorAll("[data-chave]")) {
        const n = naoLidas(b.dataset.chave);
        if (!b.dataset.semContagem) total += n;
        const c = b.querySelector(".contador");
        c.textContent = n > 99 ? "99+" : String(n);
        c.hidden = !n;
        c.setAttribute("aria-label", n === 1 ? "1 mensagem não lida" : `${n} mensagens não lidas`);
        b.classList.toggle("com-novas", n > 0);
      }
      aoContar?.(total);
    }

    function item({ chave, nome, sub, cor, arquivada, abrir }) {
      const b = el("button", { type: "button", class: "chat-item", "data-chave": chave, "data-sem-contagem": arquivada ? "1" : null,
        "aria-current": ativa?.chave === chave ? "true" : null, onclick: abrir },
        el("span", { class: "chat-avatar" + (cor ? " turma" : ""), style: cor ? { background: corDaTurma(cor) } : null, "aria-hidden": "true" }, inicial(nome)),
        el("span", { class: "chat-item-texto" }, el("b", {}, nome), el("span", {}, sub)),
        arquivada ? el("span", { class: "chip" }, "Arquivada") : null,
        el("span", { class: "contador", hidden: true }));
      return b;
    }
    const outroDe = c => ehProf ? c.alunoNome : c.professorNome;
    const nomeDaTurma = id => todas.find(t => t.id === id)?.nome;

    function desenharLista() {
      if (parado) return;
      const itensTurma = turmas.map(t => item({ chave: `turma_${t.id}_chat`, nome: t.nome, sub: "Chat da turma", cor: t.cor || "#A61C24", arquivada: t.arquivada, abrir: () => abrirTurma(t) }));
      const itensPrivados = conversas.map(c => item({ chave: `conversa_${c.id}`, nome: outroDe(c),
        sub: [ehProf ? "Aluno(a)" : "Professor(a)", nomeDaTurma(c.turmaId)].filter(Boolean).join(" · "), abrir: () => abrirPrivada(c) }));
      listaNo.replaceChildren(
        el("div", { class: "chat-lista-topo" }, el("h2", {}, "Conversas"),
          el("button", { type: "button", class: "botao pequeno", onclick: novaConversa }, "+ Nova conversa")),
        el("h3", { class: "chat-grupo" }, "Turmas"),
        ...(itensTurma.length ? itensTurma : [el("p", { class: "chat-nada" }, ehProf ? "Você ainda não tem turmas." : "Você ainda não está em nenhuma turma.")]),
        el("h3", { class: "chat-grupo" }, ehProf ? "Conversas com alunos" : "Conversas com professores"),
        ...(itensPrivados.length ? itensPrivados : [el("p", { class: "chat-nada" },
          !conversasProntas ? "Carregando…" : ehProf ? "Nenhuma conversa ainda. Use “+ Nova conversa” para falar em particular com um aluno."
            : "Nenhuma conversa ainda. Use “+ Nova conversa” para falar em particular com um professor.")]));
      atualizarNumeros();
    }

    function mostrar(novaAtiva, opcoes) {
      painel?.parar();
      ativa = novaAtiva;
      painel = painelConversa({ ...opcoes, aoVoltar: voltar, aoMensagens: marcarLida });
      palco.replaceChildren(painel.no);
      layout.classList.add("aberta");
      if (movel.matches) {
        document.body.classList.add("chat-tela-cheia");
        if (!empilhado) { history.pushState({ chatAberto: true }, ""); empilhado = true; }
      }
      for (const b of listaNo.querySelectorAll("[data-chave]")) {
        if (b.dataset.chave === ativa.chave) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      }
      atualizarNumeros();
      if (!movel.matches) painel.no.querySelector("textarea")?.focus();
    }
    function abrirTurma(t) {
      mostrar({ chave: `turma_${t.id}_chat`, alvo: { tipo: "turma", id: t.id }, semLeitura: !!t.arquivada }, opcoesTurma(t, reps));
    }
    function abrirPrivada(c) {
      const turma = nomeDaTurma(c.turmaId);
      mostrar({ chave: `conversa_${c.id}`, alvo: { tipo: "privada", id: c.id } }, {
        sessao, alvo: { tipo: "privada", id: c.id }, titulo: outroDe(c), onde: "conversa particular",
        subtitulo: ["Conversa particular", turma].filter(Boolean).join(" · "), professorUid: c.professorUid
      });
    }
    function fechar() {
      painel?.parar(); painel = null; ativa = null;
      palco.replaceChildren(vazioPalco());
      layout.classList.remove("aberta");
      document.body.classList.remove("chat-tela-cheia");
      for (const b of listaNo.querySelectorAll("[aria-current]")) b.removeAttribute("aria-current");
      atualizarNumeros();
    }
    function voltar() { if (empilhado) history.back(); else fechar(); }
    const aoPop = () => { if (empilhado) { empilhado = false; fechar(); } };
    addEventListener("popstate", aoPop);
    const aoVoltarAVer = () => { if (!document.hidden && ativa) { marcarLida(novas[ativa.chave]?.map(m => ({ criadoEm: { toMillis: () => m.quando } }))); atualizarNumeros(); } };
    document.addEventListener("visibilitychange", aoVoltarAVer);
    limpezas.push(() => removeEventListener("popstate", aoPop), () => document.removeEventListener("visibilitychange", aoVoltarAVer));

    const vazioPalco = () => el("div", { class: "chat-escolha" }, iconeEl("chat"), el("b", {}, "Escolha uma conversa"),
      el("span", {}, "As mensagens aparecem aqui na hora, sem precisar atualizar a página."));

    // Nova conversa particular: aluno -> só professores das turmas (abertas) dele; professor -> alunos das turmas dele.
    function novaConversa() {
      if (!abertas.length) { toast(ehProf ? "Você precisa de uma turma aberta para iniciar uma conversa." : "Você precisa estar em uma turma aberta para falar com um professor."); return; }
      const sel = el("select", { id: "nc-turma" }, abertas.map(t => el("option", { value: t.id }, t.nome)));
      const pessoas = el("div", { class: "lista" });
      const erro = el("p", { class: "erro", role: "alert" });
      const j = abrirJanela({ titulo: "Nova conversa particular", conteudo: [
        el("p", { class: "mudo" }, ehProf ? "Escolha a turma e o aluno. Só vocês dois (e a administração) leem a conversa."
          : "Escolha a turma e o professor. Só vocês dois (e a administração) leem a conversa."),
        el("div", { class: "campo" }, el("label", { for: "nc-turma" }, "Turma"), sel), erro, pessoas] });
      async function carregar() {
        const turmaId = sel.value;
        erro.textContent = "";
        pessoas.replaceChildren(el("div", { class: "vazio" }, "Carregando…"));
        try {
          const gente = ehProf ? await alunosDaTurma(turmaId) : (await professoresDaTurma(turmaId)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
          if (sel.value !== turmaId) return;
          pessoas.replaceChildren(...(gente.length ? gente.map(p => {
            const quem = { uid: p.uid || p.id, nome: p.nome };
            const botao = el("button", { type: "button", class: "botao pequeno", "aria-label": `Conversar com ${p.nome}` }, "Conversar");
            botao.addEventListener("click", async () => {
              botao.disabled = true; erro.textContent = "";
              try {
                const eu = { uid, nome: sessao.nome };
                const c = await abrirConversa(ehProf ? eu : quem, ehProf ? quem : eu, turmaId);
                j.fechar();
                if (!conversas.some(x => x.id === c.id)) { conversas = [c, ...conversas]; contar(`conversa_${c.id}`, { tipo: "privada", id: c.id }); desenharLista(); }
                abrirPrivada(c);
              } catch (e) {
                console.error(e);
                erro.textContent = "Não foi possível abrir a conversa. " + mensagemDeErro(e);
                botao.disabled = false;
              }
            });
            return el("div", { class: "linha" }, el("div", {}, el("b", {}, p.nome), el("div", { class: "mudo" }, ehProf ? "Aluno(a)" : "Professor(a)")), botao);
          }) : [el("div", { class: "vazio" }, ehProf ? "Esta turma ainda não tem alunos." : "Esta turma ainda não tem professor.")]));
        } catch (e) {
          console.error(e);
          pessoas.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar a lista."));
          erro.textContent = mensagemDeErro(e);
        }
      }
      sel.addEventListener("change", carregar);
      carregar();
    }

    palco.replaceChildren(vazioPalco());
    desenharLista();
    for (const t of abertas) contar(`turma_${t.id}_chat`, { tipo: "turma", id: t.id });
    // link direto: ?abrir=turma_{id}  ou  ?abrir=conversa_{id}
    let pedido = new URLSearchParams(location.search).get("abrir") || "";
    escutas.set("#conversas", ouvirMinhasConversas(uid, cs => {
      conversas = cs; conversasProntas = true;
      for (const c of cs) contar(`conversa_${c.id}`, { tipo: "privada", id: c.id });
      desenharLista();
      const c = cs.find(x => pedido === `conversa_${x.id}`);
      if (c) { pedido = ""; abrirPrivada(c); }
    }, () => { conversasProntas = true; desenharLista(); }));
    const t = turmas.find(x => pedido === `turma_${x.id}`);
    if (t) { pedido = ""; abrirTurma(t); }
  }
}
