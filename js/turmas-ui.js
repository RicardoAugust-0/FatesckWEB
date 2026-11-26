// Peças de tela das turmas usadas em várias páginas: seletor de cores com prévia, janelas e menus ⋯.
import { el, abrirJanela, abrirMenu, toast, copiar, mensagem } from "./ui.js";
import { iconeEl } from "./icones.js";
import { cardTurma } from "./componentes.js";
import { CORES, criarTurma, alterarTurma, definirArquivada, pedirEntrada, aprovarTodos } from "./turmas.js";
import { mensagemDeErro } from "./auth.js";

// Formulário nome + 8 cores + "Prévia para o aluno" (prévia: tela 5).
// Devolve { no, valores(), validar() }.
export function formularioTurma({ nome = "", cor = CORES[0][0], professor = "", aoMudar } = {}) {
  let corAtual = cor;
  const id = "nt-" + Math.random().toString(36).slice(2);
  const entrada = el("input", { id, type: "text", maxlength: "80", value: nome, placeholder: "Ex.: Banco de Dados I", autocomplete: "off" });
  const previa = el("div", { class: "previa-turma" });
  const desenharPrevia = () => previa.replaceChildren(cardTurma({ turma: { nome: entrada.value.trim() || "Nome da turma", cor: corAtual }, subtitulo: professor }));
  const botoesCor = CORES.map(([valor, rotulo]) => {
    const b = el("button", { type: "button", class: "cor-opcao", role: "radio", "aria-checked": String(valor === corAtual), "aria-label": rotulo, title: rotulo,
      style: { background: valor } }, iconeEl("check"));
    b.addEventListener("click", () => { corAtual = valor; botoesCor.forEach(x => x.setAttribute("aria-checked", String(x === b))); desenharPrevia(); aoMudar?.(); });
    return b;
  });
  entrada.addEventListener("input", () => { desenharPrevia(); aoMudar?.(); });
  desenharPrevia();
  const no = el("div", { class: "painel-nova" },
    el("div", { class: "campo" }, el("label", { for: id }, "Nome da turma"), entrada),
    el("div", { class: "campo" }, el("span", { style: { fontWeight: "600", fontSize: "13px" }, id: id + "-c" }, "Cor da turma"),
      el("div", { class: "cores", role: "radiogroup", "aria-labelledby": id + "-c" }, botoesCor)),
    el("div", { class: "campo" }, el("span", { style: { fontWeight: "600", fontSize: "13px" } }, "Prévia para o aluno"), previa));
  return {
    no, entrada,
    valores: () => ({ nome: entrada.value.trim().replace(/\s+/g, " "), cor: corAtual }),
    validar() { const n = entrada.value.trim(); return n.length < 1 ? "Digite o nome da turma." : n.length > 80 ? "O nome pode ter até 80 caracteres." : ""; },
    limpar() { entrada.value = ""; desenharPrevia(); }
  };
}

// Painel "Nova turma" (lateral da tela Minhas turmas).
export function painelNovaTurma(sessao, aoCriar) {
  const form = formularioTurma({ professor: sessao.nome });
  const erro = el("p", { class: "erro", role: "alert" });
  const botao = el("button", { type: "submit", class: "botao" }, "Criar turma");
  const f = el("form", { class: "card card-corpo painel-nova", novalidate: true },
    el("h2", {}, "Nova turma"), form.no,
    el("p", { class: "dica-codigo" }, "O código de entrada é gerado ao criar a turma e fica no menu de três pontinhos do card."),
    erro, botao);
  f.addEventListener("submit", async e => {
    e.preventDefault();
    mensagem(erro, form.validar());
    if (erro.textContent) return;
    botao.disabled = true;
    try {
      const t = await criarTurma(sessao, form.valores());
      form.limpar();
      toast(`Turma criada! Código: ${t.codigo}`, { duracao: 7000 });
      aoCriar?.(t);
    } catch (err) { console.error(err); mensagem(erro, "Não foi possível criar a turma. " + mensagemDeErro(err)); }
    finally { botao.disabled = false; }
  });
  return f;
}

// Janela "Código da turma"
export function janelaCodigo(turma) {
  const j = abrirJanela({
    titulo: "Código da turma",
    conteudo: [
      el("p", { class: "mudo" }, turma.nome),
      el("div", { class: "codigo-grande", "aria-label": "Código " + turma.codigo.split("").join(" ") }, turma.codigo),
      el("p", { class: "mudo" }, turma.arquivada ? "Esta turma está arquivada: o código não aceita novos alunos." : "Os alunos digitam este código em \"Entrar em uma turma\". Você aprova cada pedido.")
    ],
    acoes: [
      el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Fechar"),
      el("button", { type: "button", class: "botao", onclick: () => copiar(turma.codigo, "Código copiado.") }, "Copiar código")
    ]
  });
}

// Janela "Alterar cor e nome"
export function janelaAlterar(turma, professor, aoSalvar) {
  const form = formularioTurma({ nome: turma.nome, cor: turma.cor, professor });
  const erro = el("p", { class: "erro", role: "alert" });
  const salvar = el("button", { type: "button", class: "botao" }, "Salvar");
  const j = abrirJanela({ titulo: "Alterar cor e nome", conteudo: [form.no, erro],
    acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), salvar] });
  salvar.addEventListener("click", async () => {
    mensagem(erro, form.validar());
    if (erro.textContent) return;
    salvar.disabled = true;
    try { await alterarTurma(turma, form.valores()); j.fechar(); toast("Turma atualizada."); aoSalvar?.(); }
    catch (e) { console.error(e); mensagem(erro, "Não foi possível salvar. " + mensagemDeErro(e)); salvar.disabled = false; }
  });
}

// Confirma e arquiva/desarquiva.
export function janelaArquivar(sessao, turma, arquivar, aoConcluir) {
  const confirmar = el("button", { type: "button", class: "botao" }, arquivar ? "Arquivar turma" : "Desarquivar");
  const erro = el("p", { class: "erro", role: "alert" });
  const j = abrirJanela({
    titulo: arquivar ? "Arquivar turma?" : "Desarquivar turma?",
    conteudo: [el("p", {}, arquivar
      ? `"${turma.nome}" sai da tela principal. Atividades, entregas, notas e mensagens ficam guardadas, mas a turma vira somente leitura e o código para de aceitar alunos.`
      : `"${turma.nome}" volta para a tela principal e o código volta a aceitar pedidos de entrada.`), erro],
    acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), confirmar]
  });
  confirmar.addEventListener("click", async () => {
    confirmar.disabled = true;
    try { await definirArquivada(sessao, turma, arquivar); j.fechar(); toast(arquivar ? "Turma arquivada." : "Turma desarquivada."); aoConcluir?.(); }
    catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); confirmar.disabled = false; }
  });
}

// "Aprovar todos" os pedidos pendentes (professor da turma e admin): confirma mostrando quantos são,
// aprova em lotes mostrando o andamento e, se algum falhar, diz quem ficou de fora (continua na lista de pedidos).
export function janelaAprovarTodos(sessao, turma, pendentes, aoConcluir) {
  const n = pendentes.length;
  const confirmar = el("button", { type: "button", class: "botao" }, `Aprovar ${n}`);
  const cancelar = el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar");
  const texto = el("p", {}, `${n} ${n === 1 ? "aluno entra" : "alunos entram"} na turma "${turma.nome}" agora. Cada aprovação fica no registro de alterações.`);
  const andamento = el("p", { class: "mudo", role: "status", "aria-live": "polite" });
  const erro = el("p", { class: "erro", role: "alert" });
  let fechada = false;
  const j = abrirJanela({ titulo: `Aprovar ${n} ${n === 1 ? "pedido" : "pedidos"}?`, conteudo: [texto, andamento, erro],
    acoes: [cancelar, confirmar], aoFechar: () => { fechada = true; } });
  confirmar.addEventListener("click", async () => {
    confirmar.disabled = cancelar.disabled = true;
    mensagem(erro);
    andamento.textContent = `Aprovando… 0 de ${n}`;
    const { aprovados, falhas } = await aprovarTodos(sessao, turma, pendentes, (feitos, total) => { andamento.textContent = `Aprovando… ${feitos} de ${total}`; });
    aoConcluir?.();
    const ok = `${aprovados.length} ${aprovados.length === 1 ? "aluno aprovado" : "alunos aprovados"}.`;
    if (!falhas.length) { j.fechar(); toast(ok); return; }
    const nomes = falhas.map(f => f.pedido.nome).join(", ");
    // "permission-denied" aqui quase sempre é pedido que mudou nesse meio-tempo (aluno cancelou, outra pessoa já aprovou/recusou).
    const motivo = falhas.every(f => f.erro?.code === "permission-denied")
      ? "Talvez o aluno tenha cancelado o pedido, ou ele já foi aprovado ou recusado por outra pessoa."
      : mensagemDeErro(falhas[0].erro);
    const aviso = `${aprovados.length} de ${n} aprovados. Não foi possível aprovar: ${nomes}. ${motivo} Se o pedido ainda aparecer na lista, tente de novo.`;
    if (fechada) { toast(aviso, { tipo: "erro", duracao: 9000 }); return; }
    andamento.textContent = "";
    mensagem(erro, aviso);
    confirmar.remove();
    cancelar.textContent = "Fechar"; cancelar.disabled = false; cancelar.focus();
  });
}

// Menu ⋯ do professor (prévia: tela 5)
export function menuProfessor(sessao, turma, professor, recarregar) {
  return e => {
    e.stopPropagation();
    const ic = n => iconeEl(n);
    abrirMenu(e.currentTarget, turma.arquivada
      ? [{ texto: "Mostrar código da turma", icone: ic("olho"), acao: () => janelaCodigo(turma) },
         "separador",
         { texto: "Desarquivar", icone: ic("arquivo"), acao: () => janelaArquivar(sessao, turma, false, recarregar) }]
      : [{ texto: "Mostrar código da turma", icone: ic("olho"), acao: () => janelaCodigo(turma) },
         { texto: "Copiar código", icone: ic("copiar"), acao: () => copiar(turma.codigo, "Código copiado.") },
         { texto: "Alterar cor e nome", icone: ic("lapis"), acao: () => janelaAlterar(turma, professor, recarregar) },
         "separador",
         { texto: "Arquivar turma", icone: ic("arquivo"), acao: () => janelaArquivar(sessao, turma, true, recarregar) }]);
  };
}

// Menu ⋯ do aluno: Abrir turma, Copiar código
export function menuAluno(turma, hrefTurma) {
  return e => {
    e.stopPropagation();
    abrirMenu(e.currentTarget, [
      { texto: "Abrir turma", icone: iconeEl("turmas"), acao: () => { location.href = hrefTurma; } },
      { texto: "Copiar código", icone: iconeEl("copiar"), acao: () => copiar(turma.codigo, "Código copiado. Quem usar o código ainda precisa ser aprovado.") }
    ]);
  };
}

// Janela "Entrar em uma turma" (aluno)
export function janelaEntrar(sessao, aoPedir) {
  const entrada = el("input", { id: "codigo-entrar", type: "text", maxlength: "12", autocomplete: "off", autocapitalize: "characters",
    spellcheck: "false", inputmode: "text", placeholder: "Ex.: BD7K2MXQ", "aria-describedby": "dica-entrar" });
  const erro = el("p", { class: "erro", role: "alert" });
  const enviar = el("button", { type: "button", class: "botao" }, "Pedir para entrar");
  const j = abrirJanela({
    titulo: "Entrar em uma turma",
    conteudo: [
      el("p", { class: "mudo", id: "dica-entrar" }, "Digite o código que o professor passou. O professor (ou a administração) aprova a sua entrada."),
      el("div", { class: "campo campo-codigo" }, el("label", { for: "codigo-entrar" }, "Código da turma"), entrada), erro],
    acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), enviar]
  });
  const ir = async () => {
    mensagem(erro); enviar.disabled = true;
    try {
      const r = await pedirEntrada(sessao, entrada.value);
      if (r.erro) { mensagem(erro, r.erro); return; }
      j.fechar();
      toast(`Pedido enviado para "${r.turmaNome}". Aguarde a aprovação do professor.`, { duracao: 7000 });
      aoPedir?.();
    } catch (e) { console.error(e); mensagem(erro, "Não foi possível enviar o pedido. " + mensagemDeErro(e)); }
    finally { enviar.disabled = false; }
  };
  enviar.addEventListener("click", ir);
  entrada.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ir(); } });
}
