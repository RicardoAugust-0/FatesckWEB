// Ferramentas do admin (Fase 4): turmas (criar, professores, alunos, pedidos, arquivar) e representantes do curso.
import { db } from "../../core/firebase.js";
import { el, mensagem, toast, abrirJanela, copiar } from "../../ui/ui.js";
import { iconeEl } from "../../ui/icones.js";
import { chip, corDaTurma } from "../../ui/componentes.js";
import { dataHora, quando } from "../../utils/datas.js";
import { mensagemDeErro } from "../../core/auth.js";
import { alunosDaTurma, professoresDaTurma, pedidosDaTurma } from "../../servicos/dados.js";
import { formularioTurma, janelaArquivar, janelaAprovarTodos } from "../../ui/turmas-ui.js";
import {
  criarTurma, buscarUsuarioPorEmail, professoresAtivos, adminAdicionarAluno, adminRemoverAluno, adminAdicionarProfessor,
  aprovarPedido, recusarPedido, adicionarRepresentante, removerRepresentante
} from "../../servicos/turmas.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Confirmação simples antes de ações que mudam membros.
function confirmar(titulo, texto, rotulo) {
  return new Promise(resolver => {
    const ok = el("button", { type: "button", class: "botao" }, rotulo);
    const j = abrirJanela({ titulo, conteudo: [el("p", {}, texto)], aoFechar: () => resolver(false),
      acoes: [el("button", { type: "button", class: "botao neutro", onclick: () => j.fechar() }, "Cancelar"), ok] });
    ok.addEventListener("click", () => { resolver(true); j.fechar(); });
  });
}

// =====================================================================
// Turmas
// =====================================================================
export function iniciarTurmasAdmin(sessao) {
  const erro = $("erro-turmas"), listaEl = $("lista-turmas");
  const abertas = new Set(); // turmas com "Gerenciar" aberto

  // Nova turma (sem professor: o admin adiciona depois)
  const form = formularioTurma({ professor: "Sem professor (adicione depois)" });
  const criar = el("button", { type: "submit", class: "botao" }, "Criar turma");
  const f = el("form", { class: "card card-corpo", novalidate: true, style: { display: "grid", gap: "12px" } },
    el("h3", {}, "Nova turma"), form.no, criar);
  f.addEventListener("submit", async e => {
    e.preventDefault();
    mensagem(erro, form.validar());
    if (erro.textContent) return;
    criar.disabled = true;
    try {
      const t = await criarTurma(sessao, form.valores());
      form.limpar(); abertas.add(t.id);
      toast(`Turma criada! Código: ${t.codigo}. Agora adicione um professor.`, { duracao: 7000 });
      await carregar();
    } catch (err) { console.error(err); mensagem(erro, "Não foi possível criar a turma. " + mensagemDeErro(err)); }
    finally { criar.disabled = false; }
  });
  $("nova-turma-admin").replaceChildren(f);

  let profsAtivos = [];
  async function carregar() {
    mensagem(erro);
    try {
      const [snap, profs] = await Promise.all([getDocs(collection(db, "turmas")), professoresAtivos()]);
      profsAtivos = profs;
      const turmas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.arquivada - b.arquivada) || a.nome.localeCompare(b.nome, "pt-BR"));
      if (!turmas.length) { listaEl.replaceChildren(el("div", { class: "vazio" }, "Nenhuma turma ainda.")); return; }
      const linhas = await Promise.all(turmas.map(linhaTurma));
      listaEl.replaceChildren(...linhas);
    } catch (e) {
      console.error(e);
      listaEl.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar as turmas."));
      mensagem(erro, mensagemDeErro(e));
    }
  }

  async function linhaTurma(t) {
    const [profs, alunos, pedidos] = await Promise.all([professoresDaTurma(t.id), alunosDaTurma(t.id), pedidosDaTurma(t.id)]);
    const pendentes = pedidos.filter(p => p.status === "pendente");
    const ponto = el("span", { class: "ponto-cor", "aria-hidden": "true" }); ponto.style.background = corDaTurma(t.cor);
    const botao = el("button", { type: "button", class: "botao pequeno neutro", "aria-expanded": String(abertas.has(t.id)) }, "Gerenciar");
    const caixa = el("div", { style: { width: "100%" } });
    const linha = el("div", { class: "linha", style: { flexWrap: "wrap", padding: "0" } },
      el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", width: "100%", padding: "12px 16px", flexWrap: "wrap" } },
        el("div", { style: { display: "flex", gap: "10px", alignItems: "center", minWidth: "0" } }, ponto,
          el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, t.nome),
            el("span", { class: "mudo" }, `${profs.map(p => p.nome).join(", ") || "Sem professor"} · ${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"}`))),
        el("div", { class: "linha-acoes" },
          t.arquivada ? chip({ texto: "Arquivada", icone: "arquivo" }) : null,
          pendentes.length ? chip({ texto: `${pendentes.length} ${pendentes.length === 1 ? "pedido" : "pedidos"}`, classe: "chip forte" }) : null,
          botao)),
      caixa);
    const abrirFechar = () => {
      const abrir = !abertas.has(t.id) || !caixa.firstChild;
      if (abrir) { abertas.add(t.id); caixa.replaceChildren(painelGerenciar(t, profs, alunos, pendentes)); }
      else { abertas.delete(t.id); caixa.replaceChildren(); }
      botao.setAttribute("aria-expanded", String(abrir));
    };
    botao.addEventListener("click", abrirFechar);
    if (abertas.has(t.id)) caixa.replaceChildren(painelGerenciar(t, profs, alunos, pendentes));
    return linha;
  }

  function painelGerenciar(t, profs, alunos, pendentes) {
    const erroP = el("p", { class: "erro", role: "alert" });
    const agir = async (fn, ok) => {
      mensagem(erroP);
      try { await fn(); toast(ok); await carregar(); }
      catch (e) { console.error(e); mensagem(erroP, mensagemDeErro(e)); }
    };
    const somenteLeitura = t.arquivada;

    // código
    const codigo = el("div", { class: "item-sub" },
      el("span", {}, "Código: ", el("b", { style: { fontFamily: "ui-monospace, Consolas, monospace", letterSpacing: ".12em" } }, t.codigo)),
      el("button", { type: "button", class: "botao pequeno neutro", onclick: () => copiar(t.codigo, "Código copiado.") }, iconeEl("copiar"), "Copiar"));

    // professores
    const disponiveis = profsAtivos.filter(p => !profs.some(x => x.uid === p.uid));
    const sel = el("select", { id: "sel-prof-" + t.id, "aria-label": "Professor para adicionar" },
      el("option", { value: "" }, disponiveis.length ? "Escolha um professor…" : "Nenhum outro professor ativo"),
      ...disponiveis.map(p => el("option", { value: p.uid }, `${p.nome} (${p.email})`)));
    const addProf = el("button", { type: "button", class: "botao pequeno", disabled: somenteLeitura || !disponiveis.length }, "Adicionar professor");
    addProf.addEventListener("click", () => {
      const p = disponiveis.find(x => x.uid === sel.value);
      if (!p) return mensagem(erroP, "Escolha o professor na lista.");
      agir(() => adminAdicionarProfessor(t, p), `${p.nome} agora é professor(a) de "${t.nome}".`);
    });

    // pedidos
    const linhasPedidos = pendentes.map(p => el("div", { class: "item-sub" },
      el("span", {}, el("b", {}, p.nome), el("span", { class: "mudo" }, ` · pediu ${quando(p.pedidoEm)}`)),
      somenteLeitura ? null : el("div", { style: { display: "flex", gap: "8px" } },
        el("button", { type: "button", class: "botao pequeno sec", onclick: () => agir(() => recusarPedido(sessao, t.id, { ...p, turmaNome: t.nome }), `Pedido de ${p.nome} recusado.`) }, "Recusar"),
        el("button", { type: "button", class: "botao pequeno", onclick: () => agir(() => aprovarPedido(sessao, t.id, { ...p, turmaNome: t.nome }), `${p.nome} aprovado(a).`) }, "Aprovar"))));

    // alunos
    const linhasAlunos = alunos.map(a => el("div", { class: "item-sub" },
      el("span", {}, el("b", {}, a.nome), el("span", { class: "mudo" }, ` · desde ${dataHora(a.entrouEm)}`)),
      somenteLeitura ? null : el("button", { type: "button", class: "botao pequeno sec", onclick: async () => {
        if (await confirmar("Remover aluno?", `${a.nome} deixa de ver a turma "${t.nome}". As entregas e notas já feitas ficam guardadas.`, "Remover"))
          agir(() => adminRemoverAluno(sessao, t, a), `${a.nome} removido(a) da turma.`);
      } }, "Remover")));
    const emailAluno = el("input", { type: "email", id: "email-aluno-" + t.id, placeholder: "nome@aluno.cps.sp.gov.br", autocomplete: "off" });
    const addAluno = el("button", { type: "button", class: "botao pequeno", disabled: somenteLeitura }, "Adicionar aluno");
    addAluno.addEventListener("click", async () => {
      mensagem(erroP);
      const email = emailAluno.value.trim().toLowerCase();
      if (!emailValido(email)) return mensagem(erroP, "Digite o e-mail do aluno.");
      const u = await buscarUsuarioPorEmail(email).catch(e => { mensagem(erroP, mensagemDeErro(e)); return undefined; });
      if (u === undefined) return;
      if (!u) return mensagem(erroP, "Não existe cadastro com esse e-mail. O aluno precisa criar a conta primeiro.");
      if (u.perfil !== "aluno") return mensagem(erroP, "Esse e-mail é de um professor. Use \"Adicionar professor\".");
      if (alunos.some(a => a.uid === u.uid)) return mensagem(erroP, `${u.nome} já está nessa turma.`);
      agir(() => adminAdicionarAluno(sessao, t, u), `${u.nome} adicionado(a) à turma.`);
    });

    return el("div", { class: "gerenciar" },
      codigo,
      el("div", { class: "sublista" }, el("h3", {}, "Professores"),
        ...(profs.length ? profs.map(p => el("div", { class: "item-sub" }, el("span", {}, p.nome))) : [el("p", { class: "mudo" }, "Nenhum professor ainda.")]),
        somenteLeitura ? null : el("div", { class: "form-linha" }, el("div", { class: "campo" }, el("label", { for: sel.id }, "Adicionar professor ativo"), sel), addProf)),
      el("div", { class: "sublista" }, el("h3", {}, `Pedidos de entrada (${pendentes.length})`),
        ...(linhasPedidos.length ? linhasPedidos : [el("p", { class: "mudo" }, "Nenhum pedido aguardando.")]),
        // "Aprovar todos" a partir de 2 pedidos (com 1, é o mesmo que o "Aprovar" da linha).
        !somenteLeitura && pendentes.length > 1 ? el("div", {}, el("button", { type: "button", class: "botao pequeno",
          onclick: () => janelaAprovarTodos(sessao, t, pendentes, carregar) }, "Aprovar todos")) : null),
      el("div", { class: "sublista" }, el("h3", {}, `Alunos (${alunos.length})`),
        ...(linhasAlunos.length ? linhasAlunos : [el("p", { class: "mudo" }, "Nenhum aluno ainda.")]),
        somenteLeitura ? null : el("div", { class: "form-linha" }, el("div", { class: "campo" }, el("label", { for: emailAluno.id }, "Adicionar aluno pelo e-mail"), emailAluno), addAluno)),
      erroP,
      el("div", {}, el("button", { type: "button", class: "botao pequeno sec", onclick: () => janelaArquivar(sessao, t, !t.arquivada, carregar) },
        iconeEl("arquivo"), t.arquivada ? "Desarquivar turma" : "Arquivar turma")));
  }

  carregar();
}

// =====================================================================
// Representantes do curso
// =====================================================================
export function iniciarRepresentantes(sessao) {
  const erro = $("erro-reps"), listaEl = $("lista-reps"), form = $("form-rep"), entrada = $("email-rep");

  async function carregar() {
    try {
      const snap = await getDocs(collection(db, "representantes"));
      const reps = await Promise.all(snap.docs.map(async d => {
        const u = await getDoc(doc(db, "usuarios", d.id));
        return { uid: d.id, ...d.data(), email: u.exists() ? u.data().email : "" };
      }));
      reps.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      listaEl.replaceChildren(...(reps.length ? reps.map(r => {
        const b = el("button", { type: "button", class: "botao pequeno sec" }, "Remover");
        b.addEventListener("click", async () => {
          if (!(await confirmar("Remover representante?", `${r.nome} deixa de poder publicar avisos para o curso. Os avisos que já publicou continuam, com o rótulo "Ex-Representante".`, "Remover"))) return;
          b.disabled = true;
          try { await removerRepresentante(sessao, r); toast(`${r.nome} não é mais representante.`); carregar(); }
          catch (e) { console.error(e); mensagem(erro, mensagemDeErro(e)); b.disabled = false; }
        });
        return el("div", { class: "linha" },
          el("div", { class: "linha-info" }, el("span", { class: "linha-titulo" }, r.nome), el("span", { class: "mudo" }, `${r.email} · desde ${dataHora(r.adicionadoEm)}`)), b);
      }) : [el("div", { class: "vazio" }, "Nenhum representante ainda.")]));
    } catch (e) { console.error(e); listaEl.replaceChildren(el("div", { class: "vazio" }, "Não foi possível carregar os representantes.")); }
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    mensagem(erro);
    const email = entrada.value.trim().toLowerCase();
    if (!emailValido(email)) return mensagem(erro, "Digite o e-mail do aluno.");
    const botao = form.querySelector("button"); botao.disabled = true;
    try {
      const u = await buscarUsuarioPorEmail(email);
      if (!u) return mensagem(erro, "Não existe cadastro com esse e-mail.");
      if (u.perfil !== "aluno") return mensagem(erro, "Só alunos podem ser representantes do curso.");
      if (u.status !== "ativo") return mensagem(erro, "Essa conta não está ativa.");
      if ((await getDoc(doc(db, "representantes", u.uid))).exists()) return mensagem(erro, `${u.nome} já é representante.`);
      await adicionarRepresentante(sessao, u);
      entrada.value = "";
      toast(`${u.nome} agora é representante do curso.`);
      carregar();
    } catch (err) { console.error(err); mensagem(erro, mensagemDeErro(err)); }
    finally { botao.disabled = false; }
  });

  carregar();
}
