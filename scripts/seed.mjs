// npm run seed — carrega dados de teste NO EMULADOR (nunca no Firebase real).
// Pré-requisito: "npm run emulators" rodando em outro terminal.
// Pode ser rodado várias vezes: apaga tudo do emulador e recria.
// Os documentos seguem exatamente o esquema aprovado na Fase 1 (o mesmo que firestore.rules valida).
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, writeBatch, Timestamp } from "firebase/firestore";
import { fileURLToPath } from "node:url";
import { HOST, PORTA_AUTH, PORTA_FIRESTORE, PORTA_SITE, PORTA_UI, PROJETO } from "./config.mjs";

// Senha única de todas as contas de teste (só existe no emulador).
export const SENHA_TESTE = "fatesck123";

const AUTH = `http://${HOST}:${PORTA_AUTH}`;
const DONO = { Authorization: "Bearer owner", "Content-Type": "application/json" }; // credencial padrão do emulador

// ---------- tempo relativo a "agora" (os estados continuam válidos a cada seed) ----------
const agora = Date.now(), MIN = 60e3, HORA = 60 * MIN, DIA = 24 * HORA;
const em = ms => Timestamp.fromMillis(agora + ms);
const ha = ms => Timestamp.fromMillis(agora - ms);

// ---------- pessoas (nomes e e-mails fictícios) ----------
const ADMIN = { uid: "admin-01", nome: "Administração Fatesck", email: "admin.teste@cps.sp.gov.br" };
const HELENA = { uid: "prof-helena", nome: "Helena Souza", email: "helena.souza@cps.sp.gov.br" };       // professora ativa
const ROGERIO = { uid: "prof-rogerio", nome: "Rogério Alves", email: "rogerio.alves@cps.sp.gov.br" };  // 2º professor ativo
const MARCOS = { uid: "prof-marcos", nome: "Marcos Lima", email: "marcos.lima@cps.sp.gov.br" };         // professor pendente
const ALUNOS = [
  { uid: "aluno-ana", nome: "Ana Beatriz Costa", email: "ana.costa@aluno.cps.sp.gov.br" },
  { uid: "aluno-bruno", nome: "Bruno Martins", email: "bruno.martins@aluno.cps.sp.gov.br" },        // representante
  { uid: "aluno-camila", nome: "Camila Ferreira", email: "camila.ferreira@aluno.cps.sp.gov.br" },   // representante
  { uid: "aluno-diego", nome: "Diego Nascimento", email: "diego.nascimento@aluno.cps.sp.gov.br" },
  { uid: "aluno-eduarda", nome: "Eduarda Lopes", email: "eduarda.lopes@aluno.cps.sp.gov.br" },
  { uid: "aluno-felipe", nome: "Felipe Araújo", email: "felipe.araujo@aluno.cps.sp.gov.br" }        // sem turma (estado vazio)
];
const [ana, bruno, camila, diego, eduarda, felipe] = ALUNOS;
const REPRESENTANTES = [bruno, camila];

// ---------- turmas ----------
const TURMAS = [
  { id: "turma-bd", nome: "Banco de Dados I", cor: "#A61C24", codigo: "BD7K2MXQ", prof: HELENA, membros: [ana, bruno, camila, diego, eduarda] },
  { id: "turma-so", nome: "Sistemas Operacionais", cor: "#5B4BD5", codigo: "SO9HP3VC", prof: HELENA, membros: [ana, diego] },
  { id: "turma-es", nome: "Engenharia de Software", cor: "#C2570C", codigo: "ES4WN8RT", prof: ROGERIO, membros: [ana, bruno, camila] },
  { id: "turma-redes", nome: "Redes de Computadores", cor: "#1F7A66", codigo: "RD3TQ6ZB", prof: ROGERIO, membros: [bruno, diego, eduarda] },
  { id: "turma-alg", nome: "Algoritmos e Lógica de Programação", cor: "#2455C6", codigo: "AL6DJ5YF", prof: HELENA, membros: [ana, bruno], arquivada: true }
];
const turmaPorId = Object.fromEntries(TURMAS.map(t => [t.id, t]));
// Eduarda entrou em SO adicionada pelo admin (com registro), não pelo código
const ADICIONADOS_PELO_ADMIN = [{ turma: "turma-so", aluno: eduarda, quando: ha(15 * DIA), registro: "seed-aluno-adicionado" }];

// ---------- atividades e entregas ----------
// entregas: [aluno, quando, texto, link?, corrigida?]
const ATIVIDADES = [
  { turma: "turma-bd", id: "bd-lista3", titulo: "Lista de exercícios 3", descricao: "Exercícios 1 a 12 do capítulo de normalização.",
    prazo: em(5 * HORA + 40 * MIN), notaMax: 10, criadoEm: ha(6 * DIA),                                   // fecha em menos de 6h
    entregas: [[bruno, ha(2 * DIA), "Segue a lista resolvida.", "https://exemplo.com/bruno/lista3", true],
               [diego, ha(30 * MIN), "Respostas no documento do link.", "https://exemplo.com/diego/lista3"]] }, // Diego: dentro das 4h
  { turma: "turma-bd", id: "bd-modelo-er", titulo: "Modelo ER da biblioteca", descricao: "Diagrama entidade-relacionamento do sistema de biblioteca.",
    prazo: em(5 * DIA), criadoEm: ha(2 * DIA),
    entregas: [[ana, ha(1 * HORA), "Diagrama feito no draw.io.", "https://exemplo.com/ana/modelo-er"],    // dentro das 4h
               [eduarda, ha(26 * HORA), "Primeira versão do modelo."]] },                                 // fora das 4h
  { turma: "turma-bd", id: "bd-sql-basico", titulo: "Consultas SQL básicas", prazo: ha(10 * DIA), notaMax: 10, criadoEm: ha(20 * DIA),
    entregas: [[ana, ha(11 * DIA), "Consultas no link.", "https://exemplo.com/ana/sql", true], [bruno, ha(10 * DIA + 3 * HORA), "Feito.", null, true],
               [camila, ha(9 * DIA + 20 * HORA), "Entreguei com atraso, desculpe.", null, true], [diego, ha(12 * DIA), "Consultas 1 a 8.", null, true]] }, // encerrada
  { turma: "turma-es", id: "es-diagrama", titulo: "Diagrama de classes (entrega parcial)", descricao: "Versão parcial do diagrama de classes do projeto.",
    prazo: ha(10 * HORA), criadoEm: ha(7 * DIA), autor: ROGERIO,                                          // atrasada, aberta por mais ~14h
    entregas: [[camila, ha(2 * HORA), "Versão parcial, faltam os métodos.", "https://exemplo.com/camila/classes"], [bruno, ha(3 * DIA), "Diagrama parcial."]] },
  { turma: "turma-es", id: "es-requisitos", titulo: "Levantamento de requisitos", prazo: ha(3 * DIA), reabertaAte: em(2 * DIA), criadoEm: ha(12 * DIA), autor: ROGERIO,
    reabertura: "seed-reabertura", entregas: [[ana, ha(4 * DIA), "Documento de requisitos v1.", "https://exemplo.com/ana/requisitos"]] }, // reaberta pelo professor
  { turma: "turma-es", id: "es-casos-uso", titulo: "Casos de uso do sistema", prazo: em(4 * DIA), criadoEm: ha(5 * DIA), autor: ROGERIO,
    prazoEstendido: "seed-prazo", entregas: [] },                                                         // prazo estendido (com registro)
  { turma: "turma-so", id: "so-relatorio", titulo: "Relatório de processos", descricao: "Criação e escalonamento de processos.",
    prazo: em(3 * DIA), notaMax: 10, criadoEm: ha(1 * DIA), entregas: [] },                                // aberta, ninguém entregou
  { turma: "turma-so", id: "so-resumo", titulo: "Resumo: gerência de memória", prazo: ha(3 * DIA), criadoEm: ha(14 * DIA),
    entregas: [[diego, ha(4 * DIA), "Resumo de duas páginas.", null, true], [eduarda, ha(3 * DIA + 2 * HORA), "Resumo no link.", "https://exemplo.com/eduarda/memoria"]] }, // encerrada
  { turma: "turma-redes", id: "redes-camadas", titulo: "Modelo OSI x TCP/IP", prazo: em(2 * DIA), notaMax: 10, criadoEm: ha(3 * DIA), autor: ROGERIO,
    entregas: [[eduarda, ha(5 * HORA), "Tabela comparativa no link.", "https://exemplo.com/eduarda/osi"]] },
  { turma: "turma-alg", id: "alg-lista1", titulo: "Lista 1 — estruturas de repetição", prazo: ha(120 * DIA), notaMax: 10, criadoEm: ha(135 * DIA),
    entregas: [[ana, ha(121 * DIA), "Lista resolvida.", null, true], [bruno, ha(122 * DIA), "Lista resolvida.", null, true]] } // turma arquivada
];

// ---------- notas ----------
// itens: [aluno, valor, comentário?]
const NOTAS = [
  { turma: "turma-bd", id: "atv_bd-sql-basico", atividadeId: "bd-sql-basico", titulo: "Consultas SQL básicas", publicada: true, publicadaEm: ha(7 * DIA),
    itens: [[ana, 9.5, "Ótimo trabalho."], [bruno, 7], [camila, 6.5, "Entregue com atraso."], [diego, 8.5]] },   // publicada (ligada a atividade)
  { turma: "turma-bd", id: "bd-prova1", titulo: "Prova 1", publicada: false,
    itens: [[ana, 8], [bruno, 5.5, "Rever junções."], [camila, 7.5]] },                                           // rascunho: alunos não veem
  { turma: "turma-es", id: "es-prova1", titulo: "Prova 1", publicada: false, autor: ROGERIO, despublicada: "seed-despublicada",
    itens: [[ana, 6], [bruno, 9], [camila, 8]] },                                                                 // despublicada (com registro)
  { turma: "turma-alg", id: "atv_alg-lista1", atividadeId: "alg-lista1", titulo: "Lista 1 — estruturas de repetição", publicada: true, publicadaEm: ha(117 * DIA),
    itens: [[ana, 10], [bruno, 8]] }
];

// ---------- avisos, chat e conversas ----------
const AVISOS = [
  ["turma-bd", HELENA, "A aula de segunda será online. O link estará no chat da turma.", ha(3 * HORA)],
  ["turma-bd", HELENA, "As notas de \"Consultas SQL básicas\" foram publicadas.", ha(7 * DIA)],
  ["turma-es", ROGERIO, "Levantamento de requisitos reaberto por mais 2 dias.", ha(9 * HORA)],
  ["turma-so", HELENA, "Semana que vem não haverá aula presencial.", ha(2 * DIA)]
];
const AVISOS_CURSO = [
  [ADMIN, "admin", "Inscrições para a semana de tecnologia vão até sexta-feira, na secretaria.", ha(5 * HORA)],
  [camila, "representante", "Reunião dos representantes com a coordenação na quinta, às 19h. Mandem sugestões no chat da turma.", ha(1 * DIA)]
];
// [turma, autor, papel, texto, quando]
const CHAT_TURMA = [
  ["turma-bd", HELENA, "professor", "Boa noite, turma! Dúvidas da lista 3 podem ser enviadas por aqui.", ha(26 * HORA)],
  ["turma-bd", diego, "aluno", "Professora, o exercício 7 é para fazer até a 3ª forma normal?", ha(25 * HORA)],
  ["turma-bd", HELENA, "professor", "Isso mesmo, Diego. Até a 3FN.", ha(24 * HORA)],
  ["turma-bd", bruno, "representante", "Pessoal, a reunião com a coordenação é quinta. Quem tiver sugestão me chama.", ha(3 * HORA)],
  ["turma-bd", ana, "aluno", "Obrigada! Eu tinha a mesma dúvida do Diego.", ha(2 * HORA)],
  ["turma-es", ROGERIO, "professor", "Lembrem de colocar os nomes do grupo no diagrama.", ha(2 * DIA)],
  ["turma-es", camila, "representante", "Professor, pode ser feito no draw.io?", ha(40 * MIN)],
  // turma arquivada (Algoritmos): mensagens antigas, para testar o chat somente leitura
  ["turma-alg", HELENA, "professor", "Turma, a Lista 1 de estruturas de repetição já está no ar.", ha(134 * DIA)],
  ["turma-alg", ana, "aluno", "Professora, no exercício 4 pode usar while em vez de for?", ha(130 * DIA)],
  ["turma-alg", HELENA, "professor", "Pode sim, Ana. O importante é a lógica estar certa.", ha(130 * DIA - 2 * HORA)],
  ["turma-alg", bruno, "representante", "Pessoal, a prova final ficou para a última semana do semestre.", ha(122 * DIA)]
];
const CONVERSAS = [
  { prof: HELENA, aluno: ana, turma: "turma-bd", mensagens: [[ana, "Professora, posso entregar o modelo ER em PDF?", ha(5 * HORA)],
      [HELENA, "Pode sim, Ana. Coloque o link na entrega.", ha(4 * HORA)], [ana, "Combinado, obrigada!", ha(50 * MIN)]] },
  { prof: HELENA, aluno: diego, turma: "turma-so", mensagens: [[diego, "Boa tarde! Vou faltar na próxima aula, tem como repor o conteúdo?", ha(20 * MIN)]] },
  { prof: ROGERIO, aluno: bruno, turma: "turma-redes", mensagens: [[ROGERIO, "Bruno, sua entrega de Redes ainda não apareceu.", ha(3 * HORA)]] }
];

// =====================================================================================

async function emuladorNoAr() {
  try { return (await fetch(`http://${HOST}:${PORTA_FIRESTORE}/`)).ok && (await fetch(`${AUTH}/`)).ok; } catch { return false; }
}

async function recriarContas() {
  const limpar = await fetch(`${AUTH}/emulator/v1/projects/${PROJETO}/accounts`, { method: "DELETE", headers: DONO });
  if (!limpar.ok) throw new Error("Falha ao limpar as contas do emulador: " + limpar.status);
  for (const p of CONTAS) {
    const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts`, {
      method: "POST", headers: DONO,
      body: JSON.stringify({ localId: p.uid, email: p.email, password: SENHA_TESTE, displayName: p.nome, emailVerified: true })
    });
    if (!r.ok) throw new Error(`Falha ao criar a conta ${p.email}: ${r.status} ${await r.text()}`);
  }
}

async function gravarDados(db) {
  const escritas = montarEscritas();
  for (let i = 0; i < escritas.length; i += 400) {
    const lote = writeBatch(db);
    for (const [caminho, dados] of escritas.slice(i, i + 400)) lote.set(doc(db, caminho), dados);
    await lote.commit();
  }
  return escritas.length;
}

// Monta a lista [caminho, dados] de todos os documentos de teste (usada aqui e em seed-demo.mjs).
export function montarEscritas() {
  const escritas = []; // [caminho, dados]
  const gravar = (caminho, dados) => escritas.push([caminho, Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined && v !== null))]);
  const registro = (id, autor, acao, alvo, detalhes, quando, turmaId) =>
    gravar(`auditoria/${id}`, { acao, autorUid: autor.uid, autorNome: autor.nome, turmaId, alvo, detalhes, criadoEm: quando });

  // ----- usuários -----
  gravar(`admins/${ADMIN.uid}`, { nome: ADMIN.nome, email: ADMIN.email }); // admin: sem documento em "usuarios"
  gravar(`usuarios/${HELENA.uid}`, { nome: HELENA.nome, email: HELENA.email, perfil: "professor", status: "ativo", criadoEm: ha(180 * DIA),
                                     aprovadoEm: ha(179 * DIA), aprovadoPor: ADMIN.uid });
  gravar(`usuarios/${ROGERIO.uid}`, { nome: ROGERIO.nome, email: ROGERIO.email, perfil: "professor", status: "ativo", criadoEm: ha(90 * DIA),
                                      aprovadoEm: ha(89 * DIA), aprovadoPor: ADMIN.uid });
  registro(`aprovacao_${HELENA.uid}`, ADMIN, "professor_aprovado", `usuarios/${HELENA.uid}`, `Professora ${HELENA.nome} aprovada.`, ha(179 * DIA));
  registro(`aprovacao_${ROGERIO.uid}`, ADMIN, "professor_aprovado", `usuarios/${ROGERIO.uid}`, `Professor ${ROGERIO.nome} aprovado.`, ha(89 * DIA));
  gravar(`usuarios/${MARCOS.uid}`, { nome: MARCOS.nome, email: MARCOS.email, perfil: "professor", status: "pendente", criadoEm: ha(1 * DIA) });
  for (const a of ALUNOS) gravar(`usuarios/${a.uid}`, { nome: a.nome, email: a.email, perfil: "aluno", status: "ativo", criadoEm: ha(150 * DIA) });

  // ----- representantes do curso -----
  REPRESENTANTES.forEach((r, i) => {
    const regId = `seed-representante-${i + 1}`, quando = ha((60 - i) * DIA);
    gravar(`representantes/${r.uid}`, { nome: r.nome, adicionadoEm: quando, auditoriaId: regId });
    registro(regId, ADMIN, "representante_adicionado", `representantes/${r.uid}`, `${r.nome} é representante do curso.`, quando);
  });

  // ----- turmas, códigos e membros -----
  for (const t of TURMAS) {
    const arquivada = !!t.arquivada;
    gravar(`turmas/${t.id}`, { nome: t.nome, cor: t.cor, codigo: t.codigo, arquivada, criadoPor: t.prof.uid, criadoEm: ha(160 * DIA),
                               auditoriaId: arquivada ? "seed-turma-arquivada" : undefined });
    gravar(`codigos/${t.codigo}`, { turmaId: t.id, arquivada, nome: t.nome, cor: t.cor });
    gravar(`turmas/${t.id}/membros/${t.prof.uid}`, { uid: t.prof.uid, nome: t.prof.nome, papel: "professor", entrouEm: ha(160 * DIA) });
    for (const m of t.membros) gravar(`turmas/${t.id}/membros/${m.uid}`, { uid: m.uid, nome: m.nome, papel: "aluno", entrouEm: ha(140 * DIA), codigo: t.codigo });
    if (arquivada) registro("seed-turma-arquivada", t.prof, "turma_arquivada", `turmas/${t.id}`, `Turma "${t.nome}" arquivada.`, ha(30 * DIA), t.id);
  }
  // pedidos de entrada: Felipe aguardando em Banco de Dados I; Diego recusado em Engenharia de Software
  for (const [aluno, t, status, quando] of [[felipe, turmaPorId["turma-bd"], "pendente", ha(3 * HORA)], [diego, turmaPorId["turma-es"], "recusado", ha(2 * DIA)]]) {
    const alvo = `turmas/${t.id}/pedidos/${aluno.uid}`;
    gravar(alvo, { uid: aluno.uid, nome: aluno.nome, turmaNome: t.nome, turmaCor: t.cor, codigo: t.codigo, status, pedidoEm: quando,
                   recusadoEm: status === "recusado" ? ha(1 * DIA) : undefined, auditoriaId: status === "recusado" ? "seed-pedido-recusado" : undefined });
    if (status === "recusado") registro("seed-pedido-recusado", t.prof, "aluno_recusado", alvo, `Pedido de ${aluno.nome} recusado na turma "${t.nome}".`, ha(1 * DIA), t.id);
  }
  for (const a of ADICIONADOS_PELO_ADMIN) {
    const alvo = `turmas/${a.turma}/membros/${a.aluno.uid}`;
    gravar(alvo, { uid: a.aluno.uid, nome: a.aluno.nome, papel: "aluno", entrouEm: a.quando, auditoriaId: a.registro });
    registro(a.registro, ADMIN, "aluno_adicionado", alvo, `${a.aluno.nome} adicionada à turma pela administração.`, a.quando, a.turma);
  }

  // ----- atividades e entregas (id da entrega = uid do aluno) -----
  for (const a of ATIVIDADES) {
    const base = `turmas/${a.turma}/atividades/${a.id}`, autor = a.autor ?? HELENA;
    const regId = a.reabertura ?? a.prazoEstendido;
    gravar(base, { titulo: a.titulo, descricao: a.descricao, prazo: a.prazo, reabertaAte: a.reabertaAte, notaMax: a.notaMax,
                   autorUid: autor.uid, criadoEm: a.criadoEm, atualizadoEm: regId ? ha(1 * DIA) : undefined, auditoriaId: regId });
    if (a.reabertura) registro(a.reabertura, autor, "entrega_reaberta", base, `"${a.titulo}": entrega reaberta por mais 2 dias.`, ha(1 * DIA), a.turma);
    if (a.prazoEstendido) registro(a.prazoEstendido, autor, "prazo_alterado", base, `"${a.titulo}": prazo estendido em 3 dias.`, ha(1 * DIA), a.turma);
    for (const [aluno, quando, texto, link, corrigida] of a.entregas) {
      gravar(`${base}/entregas/${aluno.uid}`, {
        texto, link, entregueEm: quando, atrasada: quando.toMillis() > a.prazo.toMillis(),
        alunoUid: aluno.uid, alunoNome: aluno.nome, corrigida: !!corrigida, corrigidaEm: corrigida ? Timestamp.fromMillis(quando.toMillis() + DIA) : undefined
      });
    }
  }

  // ----- notas -----
  for (const n of NOTAS) {
    const base = `turmas/${n.turma}/notas/${n.id}`, autor = n.autor ?? HELENA;
    gravar(base, { titulo: n.titulo, notaMax: 10, atividadeId: n.atividadeId, publicada: n.publicada, publicadaEm: n.publicadaEm,
                   autorUid: autor.uid, criadoEm: ha(8 * DIA), auditoriaId: n.despublicada });
    if (n.despublicada) registro(n.despublicada, autor, "notas_despublicadas", base, `"${n.titulo}" despublicada para correção.`, ha(2 * HORA), n.turma);
    for (const [aluno, valor, comentario] of n.itens) gravar(`${base}/itens/${aluno.uid}`, { valor, comentario, atualizadoEm: ha(7 * DIA + HORA) });
  }

  // ----- avisos da turma e do curso -----
  AVISOS.forEach(([turma, autor, texto, quando], i) =>
    gravar(`turmas/${turma}/avisos/aviso-${i + 1}`, { texto, autorUid: autor.uid, autorNome: autor.nome, autorPapel: "professor", criadoEm: quando }));
  AVISOS_CURSO.forEach(([autor, papel, texto, quando], i) =>
    gravar(`avisosCurso/aviso-curso-${i + 1}`, { texto, autorUid: autor.uid, autorNome: autor.nome, autorPapel: papel, criadoEm: quando }));

  // ----- chat da turma e conversas privadas -----
  CHAT_TURMA.forEach(([turma, autor, papel, texto, quando], i) =>
    gravar(`turmas/${turma}/mensagens/msg-${i + 1}`, { texto, autorUid: autor.uid, autorNome: autor.nome, autorPapel: papel, criadoEm: quando }));
  for (const c of CONVERSAS) {
    const id = `${c.prof.uid}_${c.aluno.uid}`, ultima = c.mensagens[c.mensagens.length - 1];
    gravar(`conversas/${id}`, { professorUid: c.prof.uid, alunoUid: c.aluno.uid, participantes: [c.prof.uid, c.aluno.uid],
      professorNome: c.prof.nome, alunoNome: c.aluno.nome, turmaId: c.turma, criadoEm: c.mensagens[0][2], atualizadoEm: ultima[2] });
    c.mensagens.forEach(([autor, texto, quando], i) =>
      gravar(`conversas/${id}/mensagens/msg-${i + 1}`, { texto, autorUid: autor.uid, autorNome: autor.nome, criadoEm: quando }));
  }
  return escritas;
}

// Contas de teste e textos de resumo (usados também por seed-demo.mjs).
export const CONTAS = [ADMIN, HELENA, ROGERIO, MARCOS, ...ALUNOS];
export function resumoContas() {
  const linhas = ["Contas de teste (a senha de todas está na constante SENHA_TESTE de scripts/seed.mjs):",
    `  admin (entra em /admin/)  ${ADMIN.email}`,
    `  professora ativa          ${HELENA.email}   (Banco de Dados I, Sistemas Operacionais, Algoritmos [arquivada])`,
    `  professor ativo           ${ROGERIO.email}  (Engenharia de Software, Redes de Computadores)`,
    `  professor pendente        ${MARCOS.email}`];
  for (const a of ALUNOS) {
    const obs = REPRESENTANTES.includes(a) ? "  (representante do curso)" : a === felipe ? "  (sem turma; pedido pendente em Banco de Dados I)" : a === diego ? "  (pedido recusado em Engenharia de Software)" : "";
    linhas.push(`  aluno                     ${a.email}${obs}`);
  }
  linhas.push("", "Códigos das turmas:");
  for (const t of TURMAS) linhas.push(`  ${t.codigo}  ${t.nome} — ${t.prof.nome}${t.arquivada ? "  (arquivada)" : ""}`);
  return linhas.join("\n");
}

// Conferência de coerência dos dados de teste (evita seed fora do esquema).
export function conferir() {
  const ehAluno = (turmaId, aluno) => turmaPorId[turmaId].membros.includes(aluno)
    || ADICIONADOS_PELO_ADMIN.some(x => x.turma === turmaId && x.aluno === aluno);
  for (const a of ATIVIDADES) {
    const t = turmaPorId[a.turma];
    if (t.prof.uid !== (a.autor ?? HELENA).uid) throw new Error(`Atividade ${a.id}: autor não é professor da turma ${t.id}`);
    for (const [aluno] of a.entregas) if (!ehAluno(a.turma, aluno)) throw new Error(`Entrega de ${aluno.uid} em ${a.id}: não é aluno da turma`);
  }
  for (const [turma, autor, papel] of CHAT_TURMA) {
    const t = turmaPorId[turma];
    if (!t) throw new Error("Turma inexistente: " + turma);
    const esperado = autor === t.prof ? "professor" : REPRESENTANTES.includes(autor) ? "representante" : "aluno";
    if (papel !== esperado || (autor !== t.prof && !ehAluno(turma, autor))) throw new Error(`Mensagem de ${autor.uid} em ${turma}: etiqueta ou turma errada`);
  }
  for (const [turma, autor] of AVISOS) if (turmaPorId[turma].prof !== autor) throw new Error(`Aviso em ${turma}: autor não é o professor`);
  for (const n of NOTAS) if (turmaPorId[n.turma].prof !== (n.autor ?? HELENA)) throw new Error(`Notas ${n.id}: autor não é o professor`);
  for (const c of CONVERSAS) {
    if (turmaPorId[c.turma].prof !== c.prof || !ehAluno(c.turma, c.aluno)) throw new Error(`Conversa ${c.prof.uid}_${c.aluno.uid} sem turma em comum`);
  }
}

// ---------- execução (só quando rodado direto: "npm run seed"; seed-demo.mjs apenas importa os dados) ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!PROJETO.startsWith("demo-")) { console.error("[seed] Projeto inválido: o seed só roda em projeto \"demo-\"."); process.exit(1); }
  if (!(await emuladorNoAr())) {
    console.error("\n[seed] Os emuladores não estão rodando. Abra outro terminal, rode \"npm run emulators\" e tente de novo.\n");
    process.exit(1);
  }
  conferir();

  // Sem "rules": mantém as regras já carregadas no emulador (o seed grava com as regras desligadas).
  const ambiente = await initializeTestEnvironment({ projectId: PROJETO, firestore: { host: HOST, port: PORTA_FIRESTORE } });
  try {
    await ambiente.clearFirestore();
    await recriarContas();
    let total = 0;
    await ambiente.withSecurityRulesDisabled(async contexto => { total = await gravarDados(contexto.firestore()); });

    console.log(`\n[seed] Pronto: ${CONTAS.length} contas (todas com e-mail verificado) e ${total} documentos gravados no emulador (${PROJETO}).\n`);
    console.log(resumoContas());
    console.log(`\nSite: http://${HOST}:${PORTA_SITE}/   Painel do emulador: http://${HOST}:${PORTA_UI}/\n`);
  } catch (e) {
    console.error("[seed] Falhou:", e.message || e);
    process.exitCode = 1;
  } finally {
    await ambiente.cleanup();
  }
}
