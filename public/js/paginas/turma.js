// Página da turma (prévia: tela 6), para professor e aluno.
// Professor: abas Atividades, Entregas, Notas, Chat, Avisos, Alunos. Aluno: Atividades, Notas, Chat, Avisos.
// Funcionam: o topo, Atividades (professor e aluno), Entregas (agrupadas por atividade) e Alunos (pedidos de entrada).
// A aba Chat (Fase 7b) mostra o chat desta turma em tempo real; a escuta é desligada ao trocar de aba.
import { el, toast, esqueletoLinhas, mensagem } from "../ui/ui.js";
import { iconeEl } from "../ui/icones.js";
import { dataHora, quando, diaMesHora } from "../utils/datas.js";
import { situacao, ordenarAtividades } from "../utils/prazos.js";
import { card, chip, botaoBanner, comCorDaTurma } from "../ui/componentes.js";
import { turmaPorId, professoresDaTurma, alunosDaTurma, pedidosDaTurma, atividadesDaTurma, atividadesComEntregas, minhaEntrega } from "../servicos/dados.js";
import { janelaCodigo, janelaArquivar, janelaAprovarTodos } from "../ui/turmas-ui.js";
import { aprovarPedido, recusarPedido } from "../servicos/turmas.js";
import { janelaAtividade, linhaAtividadeProfessor, linhaAtividadeAluno, hrefAtividade } from "../ui/atividades-ui.js";
import { marcarCorrigida } from "../servicos/atividades.js";
import { folhasDaTurma, itensDaFolha, minhaNota } from "../servicos/dados.js";
import { linhaFolha, janelaFolha, janelaNovaFolha, quadroNotasAluno } from "../ui/notas-ui.js";
import { avisosDaTurma, idsRepresentantes, minhasLeituras } from "../servicos/dados.js";
import { quadroAvisosTurma } from "../ui/avisos-ui.js";
import { marcarVisto } from "../servicos/avisos.js";
import { mensagemDeErro } from "../core/auth.js";
import { montarChat } from "../ui/chat-ui.js";

const ABAS = {
  professor: [["atividades", "Atividades", 5], ["entregas", "Entregas", 5], ["notas", "Notas", 6], ["chat", "Chat", 7], ["avisos", "Avisos", 7], ["alunos", "Alunos", 0]],
  aluno: [["atividades", "Atividades", 5], ["notas", "Notas", 6], ["chat", "Chat", 7], ["avisos", "Avisos", 7]]
};

export async function montar({ sessao, perfil, conteudo, href, definirCabecalhoMovel, atualizarContadores }) {
  const turmaId = new URLSearchParams(location.search).get("id") || "";
  const ehProf = perfil === "professor";
  const voltar = el("a", { class: "voltar", href: href("turmas") }, iconeEl("voltar"), "Minhas turmas");
  conteudo.replaceChildren(card({ titulo: "Carregando…", corpo: esqueletoLinhas(2) }));

  let turma = null;
  try { turma = turmaId ? await turmaPorId(turmaId) : null; } catch (e) { console.warn(e); }
  if (!turma) {
    definirCabecalhoMovel("Turma", "");
    conteudo.replaceChildren(voltar, el("div", { class: "card" }, el("div", { class: "vazio" },
      "Turma não encontrada, ou você não faz parte dela.")));
    return;
  }
  document.title = "Fatesck - " + turma.nome;
  const profs = await professoresDaTurma(turma.id);
  const nomesProfs = profs.map(p => p.nome).join(", ") || "Sem professor";
  let alunos = ehProf ? await alunosDaTurma(turma.id) : [];

  // ----- topo vermelho + abas -----
  const subtitulo = el("p", {}, ehProf ? `${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"} · ${nomesProfs}` : nomesProfs);
  const recarregar = () => location.reload();
  const topo = el("section", { class: "turma-topo", "aria-label": turma.nome },
    el("div", { class: "turma-topo-conteudo" },
      el("div", {}, voltar, el("h1", {}, turma.nome), subtitulo),
      ehProf ? botaoBanner("Código da turma", "chave", { onclick: () => janelaCodigo(turma) }) : null));
  definirCabecalhoMovel(turma.nome, ehProf ? `${alunos.length} alunos` : nomesProfs);

  const abas = ABAS[ehProf ? "professor" : "aluno"];
  const lista = el("div", { class: "abas", role: "tablist", "aria-label": "Seções da turma" });
  const painel = el("div", { class: "painel-aba", role: "tabpanel", tabindex: "-1" });
  const botoes = abas.map(([chave, rotulo]) => {
    const b = el("button", { type: "button", class: "aba", role: "tab", id: "aba-" + chave, "aria-controls": "painel-aba", "aria-selected": "false", tabindex: "-1" }, rotulo);
    b.addEventListener("click", () => abrir(chave));
    b.addEventListener("keydown", e => {
      const i = abas.findIndex(a => a[0] === chave);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prox = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length][0];
        abrir(prox); document.getElementById("aba-" + prox).focus();
      }
    });
    return b;
  });
  lista.append(...botoes);
  painel.id = "painel-aba";

  const faixa = turma.arquivada ? el("div", { class: "faixa-arquivada", role: "status" }, iconeEl("arquivo"),
    el("span", { style: { flex: "1" } }, "Turma arquivada: somente leitura. Nada novo pode ser publicado, entregue ou enviado."),
    ehProf ? el("button", { type: "button", class: "botao pequeno sec", onclick: () => janelaArquivar(sessao, turma, false, recarregar) }, "Desarquivar") : null) : null;
  conteudo.replaceChildren(el("div", {}, topo, lista), faixa || "", painel);

  // ----- abas -----
  function abrir(chave) {
    if (!abas.some(a => a[0] === chave)) chave = abas[0][0];
    history.replaceState(null, "", "#" + chave);
    for (const b of botoes) { const sel = b.id === "aba-" + chave; b.setAttribute("aria-selected", String(sel)); b.tabIndex = sel ? 0 : -1; }
    painel.setAttribute("aria-labelledby", "aba-" + chave);
    const [, rotulo, fase] = abas.find(a => a[0] === chave);
    clearInterval(relogio);
    chatAberto?.parar(); chatAberto = null;
    if (chave === "alunos") return abaAlunos();
    if (chave === "atividades") return ehProf ? abaAtividadesProfessor() : abaAtividadesAluno();
    if (chave === "entregas" && ehProf) return abaEntregas();
    if (chave === "notas") return ehProf ? abaNotasProfessor() : abaNotasAluno();
    if (chave === "avisos") return abaAvisos();
    if (chave === "chat") { chatAberto = montarChat(painel, { sessao, perfil, turmaFixa: turma, aoLer: atualizarContadores }); return; }
    painel.replaceChildren(emConstrucao(rotulo, fase));
  }
  let relogio = null; // contagens regressivas da aba aberta
  let chatAberto = null; // chat da aba "Chat" (tem escutas em tempo real para desligar)
  const emConstrucao = (rotulo, fase) => el("div", { class: "card" }, el("div", { class: "em-construcao" },
    el("b", {}, `${rotulo}: em construção`), el("span", {}, `Esta aba chega na Fase ${fase} do projeto.`)));
  const minhaParaCorrigir = lista => lista.filter(a => a.autorUid === sessao.uid).reduce((s, a) => s + a.entregas.filter(e => !e.corrigida).length, 0);
  // número de entregas para corrigir na aba "Entregas" (prévia, tela 6)
  function marcarAbaEntregas(n) {
    const b = document.getElementById("aba-entregas");
    if (!b) return;
    b.querySelector(".contador")?.remove();
    if (n) b.append(el("span", { class: "contador", "aria-label": `${n} para corrigir` }, n > 99 ? "99+" : String(n)));
  }

  // Atividades (professor): "Atividades da turma" + "Resumo da turma" (prévia, tela 6).
  async function abaAtividadesProfessor() {
    const lista = card({ titulo: "Atividades da turma", classe: "lista-cards", corpo: esqueletoLinhas(3),
      extra: turma.arquivada ? null : el("button", { type: "button", class: "botao", onclick: () => janelaAtividade(sessao, turma, null, abaAtividadesProfessor) }, "+ Nova atividade") });
    const resumo = card({ titulo: "Resumo da turma", corpo: esqueletoLinhas(3) });
    const notas = card({ titulo: "Notas lançadas", corpo: esqueletoLinhas(2) });
    const novaMovel = turma.arquivada ? null : el("button", { type: "button", class: "botao so-movel", style: { width: "100%", marginBottom: "12px" },
      onclick: () => janelaAtividade(sessao, turma, null, abaAtividadesProfessor) }, "+ Nova atividade");
    painel.replaceChildren(el("div", { class: "grade-turma" }, el("div", {}, novaMovel, lista), el("div", { class: "coluna-lateral" }, resumo, notas)));
    try {
      const [atividadesLidas, folhas] = await Promise.all([atividadesComEntregas(turma.id), carregarFolhas()]);
      const atividades = ordenarAtividades(atividadesLidas);
      const publicadaDaAtividade = new Set(folhas.filter(f => f.atividadeId && f.publicada).map(f => f.atividadeId));
      // "Notas lançadas" (prévia, tela 6): cada folha com situação, média e "Lançar notas"
      notas.replaceChildren(notas.firstChild, ...(folhas.length ? folhas.map(f => linhaDeFolha(f, true)) : [el("div", { class: "vazio" }, "Nenhuma nota lançada ainda.")]),
        el("div", { class: "card-rodape" }, el("span", {}, "Os alunos só veem depois de \"Publicar\"."),
          turma.arquivada ? null : el("button", { type: "button", class: "botao pequeno sec", onclick: () => janelaNovaFolha(sessao, turma, abrirFolhaNova) }, "+ Nova folha")));
      const pintar = () => {
        const linhas = ordenarAtividades(atividades).map(a => linhaAtividadeProfessor(sessao, turma, a, {
          alunos: alunos.length, entregas: a.entregas, hrefDetalhe: hrefAtividade(href, turma.id, a.id), notasPublicadas: publicadaDaAtividade.has(a.id),
          podeEditar: a.autorUid === sessao.uid, arquivada: turma.arquivada, aoMudar: abaAtividadesProfessor }));
        lista.replaceChildren(lista.firstChild, ...(linhas.length ? linhas : [el("div", { class: "vazio" },
          turma.arquivada ? "Esta turma não teve atividades." : "Nenhuma atividade ainda. Clique em \"+ Nova atividade\" para criar a primeira.")]));
      };
      pintar();
      relogio = setInterval(pintar, 60000);
      const abertas = atividades.filter(a => situacao(a).estado !== "encerrada").length;
      const paraCorrigir = atividades.filter(a => a.autorUid === sessao.uid && a.entregas.some(e => !e.corrigida)).length;
      const linha = (r, v) => el("div", { class: "resumo-linha" }, el("span", {}, r), el("b", {}, String(v)));
      resumo.replaceChildren(resumo.firstChild, linha("Alunos", alunos.length), linha("Atividades abertas", abertas),
        linha("Atividades para corrigir", paraCorrigir));
      marcarAbaEntregas(minhaParaCorrigir(atividades));
    } catch (e) {
      console.error(e);
      lista.replaceChildren(lista.firstChild, el("div", { class: "vazio" }, "Não foi possível carregar as atividades."));
      resumo.replaceChildren(resumo.firstChild, el("div", { class: "vazio" }, "Não foi possível carregar o resumo."));
    }
  }

  // ----- notas (Fase 6) -----
  // Professor: todas as folhas da turma, cada uma com as notas lançadas.
  async function carregarFolhas() {
    const folhas = await folhasDaTurma(turma.id);
    const itens = await Promise.all(folhas.map(f => itensDaFolha(turma.id, f.id)));
    return folhas.map((f, i) => ({ ...f, itens: itens[i] }));
  }
  const recarregarAba = () => abrir(location.hash.slice(1));
  const linhaDeFolha = (f, compacta) => linhaFolha(sessao, turma, f, {
    itens: f.itens, alunos, compacta, podeEditar: f.autorUid === sessao.uid && !turma.arquivada,
    hrefAtividade: f.atividadeId ? hrefAtividade(href, turma.id, f.atividadeId) : null, aoMudar: recarregarAba });
  // folha recém-criada: já abre a janela para lançar as notas
  const abrirFolhaNova = f => { recarregarAba(); janelaFolha(sessao, turma, f, { alunos, podeEditar: true, aoMudar: recarregarAba }); };

  // Notas (professor): todas as folhas da turma + "Nova folha de notas".
  async function abaNotasProfessor() {
    const quadro = card({ titulo: "Notas da turma", corpo: esqueletoLinhas(3),
      extra: turma.arquivada ? null : el("button", { type: "button", class: "botao", onclick: () => janelaNovaFolha(sessao, turma, abrirFolhaNova) }, "+ Nova folha de notas") });
    painel.replaceChildren(quadro);
    try {
      const folhas = await carregarFolhas();
      quadro.replaceChildren(quadro.firstChild, ...(folhas.length ? folhas.map(f => linhaDeFolha(f, false)) : [el("div", { class: "vazio" },
        "Nenhuma folha de notas ainda. Crie uma (ex.: \"Prova 1\") ou lance notas pela tela de uma atividade.")]),
        el("div", { class: "card-rodape" }, el("span", {}, "Os alunos só veem as próprias notas, e só depois de \"Publicar\". Notas de atividade aparecem para o aluno 4h depois da entrega.")));
    } catch (e) { console.error(e); quadro.replaceChildren(quadro.firstChild, el("div", { class: "vazio" }, "Não foi possível carregar as notas.")); }
  }

  // Notas (aluno): só as próprias, só das folhas publicadas (e com as regras de visibilidade da decisão A3).
  async function abaNotasAluno() {
    painel.replaceChildren(card({ titulo: "Minhas notas", corpo: esqueletoLinhas(2) }));
    try {
      const folhas = await folhasDaTurma(turma.id, { soPublicadas: true });
      const itens = await Promise.all(folhas.map(f => minhaNota(turma.id, f.id, sessao.uid)));
      const notas = folhas.map((folha, i) => ({ folha, item: itens[i] })).filter(n => n.item);
      painel.replaceChildren(quadroNotasAluno(turma, notas, { mostrarTitulo: false }));
    } catch (e) { console.error(e); painel.replaceChildren(el("div", { class: "card" }, el("div", { class: "vazio" }, "Não foi possível carregar as notas."))); }
  }

  // Avisos (professor e aluno): os desta turma. Professor da turma publica (botão + janela) e edita/apaga os próprios.
  // Abrir a aba marca os avisos desta turma como vistos.
  async function abaAvisos() {
    painel.replaceChildren(card({ titulo: "Avisos da turma", corpo: esqueletoLinhas(3) }));
    try {
      const [avisos, representantes, leituras] = await Promise.all([avisosDaTurma(turma.id, 50), idsRepresentantes(), minhasLeituras(sessao.uid)]);
      const desenhar = async () => {
        const lista = await avisosDaTurma(turma.id, 50);
        painel.replaceChildren(quadroAvisosTurma(turma, lista, { representantes, vistoMs: leituras[`turma_${turma.id}_avisos`], sessao, titulo: "Avisos da turma", mostrar: 20,
          podePublicar: ehProf && !turma.arquivada, podeMexer: a => ehProf && !turma.arquivada && a.autorUid === sessao.uid, aoMudar: desenhar }));
      };
      painel.replaceChildren(quadroAvisosTurma(turma, avisos, { representantes, vistoMs: leituras[`turma_${turma.id}_avisos`], sessao, titulo: "Avisos da turma", mostrar: 20,
        podePublicar: ehProf && !turma.arquivada, podeMexer: a => ehProf && !turma.arquivada && a.autorUid === sessao.uid, aoMudar: desenhar }));
      marcarVisto(sessao.uid, [`turma_${turma.id}_avisos`]);
    } catch (e) { console.error(e); painel.replaceChildren(el("div", { class: "card" }, el("div", { class: "vazio" }, "Não foi possível carregar os avisos."))); }
  }

  // Atividades (aluno): as desta turma, com "Entregar" / recibo / "Desfazer".
  async function abaAtividadesAluno() {
    const lista = card({ titulo: "Atividades da turma", classe: "lista-cards", corpo: esqueletoLinhas(3) });
    painel.replaceChildren(lista);
    try {
      const atividades = await atividadesDaTurma(turma.id);
      const entregas = await Promise.all(atividades.map(a => minhaEntrega(turma.id, a.id, sessao.uid)));
      const comEntrega = atividades.map((a, i) => ({ ...a, turmaNome: turma.nome, turmaCor: turma.cor, entrega: entregas[i] }));
      const pintar = () => {
        const linhas = ordenarAtividades(comEntrega).map(a => linhaAtividadeAluno(sessao, a, { arquivada: turma.arquivada, aoMudar: abaAtividadesAluno }));
        lista.replaceChildren(lista.firstChild, ...(linhas.length ? linhas : [el("div", { class: "vazio" }, "O professor ainda não publicou atividades nesta turma.")]));
      };
      pintar();
      relogio = setInterval(pintar, 60000);
      marcarVisto(sessao.uid, [`turma_${turma.id}_atividades`]); // atividades desta turma: vistas
    } catch (e) { console.error(e); lista.replaceChildren(lista.firstChild, el("div", { class: "vazio" }, "Não foi possível carregar as atividades.")); }
  }

  // Entregas (professor): agrupadas por atividade (decisão do Fernando). Cada grupo: quem entregou, hora, atraso, correção.
  async function abaEntregas() {
    painel.replaceChildren(card({ titulo: "Entregas", corpo: esqueletoLinhas(3) }));
    try {
      const atividades = ordenarAtividades(await atividadesComEntregas(turma.id));
      marcarAbaEntregas(minhaParaCorrigir(atividades));
      if (!atividades.length) {
        painel.replaceChildren(el("div", { class: "card" }, el("div", { class: "vazio" }, "Nenhuma atividade ainda, então não há entregas.")));
        return;
      }
      painel.replaceChildren(el("div", { style: { display: "grid", gap: "22px" } }, ...atividades.map(a => {
        const pode = a.autorUid === sessao.uid && !turma.arquivada;
        const paraCorrigir = a.entregas.filter(e => !e.corrigida).length;
        const linhas = [...a.entregas].sort((x, y) => (x.corrigida - y.corrigida) || (y.entregueEm?.toMillis?.() || 0) - (x.entregueEm?.toMillis?.() || 0)).map(e => {
          const acoes = el("div", { class: "linha-acoes" });
          if (e.corrigida) acoes.append(chip({ texto: "Corrigida", icone: "check", classe: "chip escuro" }));
          else if (pode) {
            const b = el("button", { type: "button", class: "botao pequeno" }, "Marcar como corrigida");
            b.addEventListener("click", async () => {
              b.disabled = true;
              try { await marcarCorrigida({ ...a, turmaId: turma.id }, e.alunoUid, true); toast(`Entrega de ${e.alunoNome} marcada como corrigida.`); abaEntregas(); }
              catch (err) { console.error(err); toast("Não foi possível. " + mensagemDeErro(err), { tipo: "erro" }); b.disabled = false; }
            });
            acoes.append(b);
          } else acoes.append(chip({ texto: "Para corrigir" }));
          return el("div", { class: "linha" },
            el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, e.alunoNome),
              el("span", { class: "mudo" }, `Entregue em ${diaMesHora(e.entregueEm)}`, e.atrasada ? el("span", { class: "alerta-texto" }, " · atrasada") : null)),
            acoes);
        });
        return comCorDaTurma(card({ titulo: a.titulo,
          extra: el("div", { class: "linha-acoes" },
            paraCorrigir ? chip({ texto: `${paraCorrigir} para corrigir`, classe: "chip contorno", icone: "check" }) : null,
            el("span", { class: "mudo" }, `${a.entregas.length} de ${alunos.length} entregaram`),
            el("a", { class: "botao pequeno neutro", href: hrefAtividade(href, turma.id, a.id) }, "Abrir atividade")),
          corpo: linhas.length ? linhas : [el("div", { class: "vazio" }, `Ninguém entregou ainda · prazo ${quando(a.prazo)}`)] }), turma.cor);
      })));
    } catch (e) {
      console.error(e);
      painel.replaceChildren(el("div", { class: "card" }, el("div", { class: "vazio" }, "Não foi possível carregar as entregas.")));
    }
  }

  // Alunos (professor): pedidos de entrada (aprovar/recusar) + lista de alunos.
  async function abaAlunos() {
    const cardPedidos = card({ titulo: "Pedidos de entrada", corpo: esqueletoLinhas(1) });
    const cardAlunos = card({ titulo: `Alunos (${alunos.length})`, corpo: esqueletoLinhas(3) });
    painel.replaceChildren(el("div", { style: { display: "grid", gap: "22px" } }, cardPedidos, cardAlunos));
    try {
      const [pedidos, lista] = await Promise.all([pedidosDaTurma(turma.id), alunosDaTurma(turma.id)]);
      alunos = lista;
      const pendentes = pedidos.filter(p => p.status === "pendente");
      const recusados = pedidos.filter(p => p.status === "recusado");
      const cab = cardPedidos.firstChild;
      if (pendentes.length) cab.append(chip({ texto: `${pendentes.length} ${pendentes.length === 1 ? "aguardando" : "aguardando"}`, classe: "chip forte" }));
      // "Aprovar todos" aparece a partir de 2 pedidos (com 1, é o mesmo que o "Aprovar" da linha).
      if (pendentes.length > 1 && !turma.arquivada) cab.append(el("button", { type: "button", class: "botao pequeno",
        onclick: () => janelaAprovarTodos(sessao, turma, pendentes, abaAlunos) }, "Aprovar todos"));
      const erro = el("p", { class: "erro", role: "alert", style: { padding: "0 20px" } });
      const linhaPedido = p => {
        const aprovar = el("button", { type: "button", class: "botao pequeno" }, "Aprovar");
        const recusar = el("button", { type: "button", class: "botao pequeno sec" }, "Recusar");
        const l = el("div", { class: "linha" },
          el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, p.nome), el("span", { class: "mudo" }, `Pediu ${quando(p.pedidoEm)}`)),
          turma.arquivada ? chip({ texto: "Turma arquivada" }) : el("div", { class: "linha-acoes" }, recusar, aprovar));
        const agir = async (fn, ok) => {
          mensagem(erro); aprovar.disabled = recusar.disabled = true;
          try { await fn(sessao, turma.id, { ...p, turmaNome: turma.nome }); toast(ok); abaAlunos(); }
          catch (e) { console.error(e); mensagem(erro, `Não foi possível concluir para ${p.nome}. ${mensagemDeErro(e)}`); aprovar.disabled = recusar.disabled = false; }
        };
        aprovar.addEventListener("click", () => agir(aprovarPedido, `${p.nome} agora faz parte da turma.`));
        recusar.addEventListener("click", () => agir(recusarPedido, `Pedido de ${p.nome} recusado.`));
        return l;
      };
      cardPedidos.replaceChildren(cab, erro,
        ...(pendentes.length ? pendentes.map(linhaPedido) : [el("div", { class: "vazio" }, "Nenhum pedido aguardando. Passe o código da turma para os alunos pedirem para entrar.")]),
        ...(recusados.length ? [el("div", { class: "card-rodape" }, `${recusados.length} ${recusados.length === 1 ? "pedido recusado" : "pedidos recusados"} (o aluno pode pedir de novo).`)] : []));

      const origem = a => a.aprovadoPor ? "aprovado pelo pedido" : a.auditoriaId ? "adicionado pela administração" : "entrou pelo código";
      cardAlunos.firstChild.querySelector("h2").textContent = `Alunos (${alunos.length})`;
      cardAlunos.replaceChildren(cardAlunos.firstChild, ...(alunos.length ? alunos.map(a => el("div", { class: "linha" },
        el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, a.nome), el("span", { class: "mudo" }, `Desde ${dataHora(a.entrouEm)} · ${origem(a)}`))))
        : [el("div", { class: "vazio" }, "Nenhum aluno ainda.")]));
      subtitulo.textContent = `${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"} · ${nomesProfs}`;
    } catch (e) {
      console.error(e);
      cardPedidos.replaceChildren(cardPedidos.firstChild, el("div", { class: "vazio" }, "Não foi possível carregar os pedidos e alunos."));
    }
  }

  abrir(location.hash.slice(1));
}
