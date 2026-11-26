// Apoio aos testes das regras: ambiente do emulador, contas de teste e um cenário base
// gravado (com as regras desligadas) antes de CADA teste.
import { before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp, serverTimestamp, writeBatch } from "firebase/firestore";
import { HOST, PORTA_FIRESTORE, PROJETO } from "../scripts/config.mjs";

export { assertFails as nega, assertSucceeds as ok };

export const HORA = 3600e3, DIA = 24 * HORA;
export const em = ms => Timestamp.fromMillis(Date.now() + ms);   // no futuro
export const ha = ms => Timestamp.fromMillis(Date.now() - ms);   // no passado
export const agora = () => serverTimestamp();                    // hora do servidor (request.time)

// ---------- pessoas ----------
export const NOMES = {
  "admin-1": "Administração Teste",
  "prof-a": "Helena Souza",       // professora ativa (turma A e turma arquivada)
  "prof-b": "Rogério Alves",      // professor ativo (turma B)
  "prof-p": "Marcos Lima",        // professor pendente
  "aluno-1": "Ana Costa",         // turma A + turma arquivada
  "aluno-2": "Bruno Martins",     // turma A
  "aluno-3": "Diego Nascimento",  // turma B
  "rep-1": "Camila Ferreira",     // turma A, representante do curso
  "aluno-sem": "Felipe Araújo"    // sem turma
};
// Professores e admin: @cps.sp.gov.br; alunos: @aluno.cps.sp.gov.br (subdomínio)
export const email = uid => uid.startsWith("prof") || uid.startsWith("admin") ? `${uid}@cps.sp.gov.br` : `${uid}@aluno.cps.sp.gov.br`;

let ambiente;
export const env = () => ambiente;

// Firestore "como" uma pessoa logada (e-mail verificado por padrão).
export function como(uid, { verificado = true, emailToken } = {}) {
  return ambiente.authenticatedContext(uid, { email: emailToken ?? email(uid), email_verified: verificado }).firestore();
}
export const visitante = () => ambiente.unauthenticatedContext().firestore();

// Grava direto, ignorando as regras (para montar situações).
export async function semRegras(fn) {
  await ambiente.withSecurityRulesDisabled(async ctx => { await fn(ctx.firestore()); });
}

// Registro de auditoria dentro de um lote.
export function registrar(lote, db, id, uid, acao, alvo, extras = {}) {
  lote.set(doc(db, "auditoria", id), {
    acao, autorUid: uid, autorNome: NOMES[uid], alvo, detalhes: "", criadoEm: agora(), ...extras
  });
}

export const lote = db => writeBatch(db);

// ---------- cenário base ----------
async function cenarioBase(db) {
  const w = [];
  const s = (p, d) => w.push([p, d]);
  const usuario = (uid, perfil, status = "ativo") =>
    s(`usuarios/${uid}`, { nome: NOMES[uid], email: email(uid), perfil, status, criadoEm: ha(100 * DIA) });

  s("admins/admin-1", { nome: NOMES["admin-1"], email: email("admin-1") });
  usuario("prof-a", "professor"); usuario("prof-b", "professor"); usuario("prof-p", "professor", "pendente");
  for (const a of ["aluno-1", "aluno-2", "aluno-3", "rep-1", "aluno-sem"]) usuario(a, "aluno");
  s("representantes/rep-1", { nome: NOMES["rep-1"], adicionadoEm: ha(10 * DIA), auditoriaId: "reg-antigo-rep" });

  const turma = (id, codigo, prof, alunos, arquivada = false) => {
    s(`turmas/${id}`, { nome: "Turma " + id, cor: "#A61C24", codigo, arquivada, criadoPor: prof, criadoEm: ha(50 * DIA) });
    s(`codigos/${codigo}`, { turmaId: id, arquivada, nome: "Turma " + id, cor: "#A61C24" });
    s(`turmas/${id}/membros/${prof}`, { uid: prof, nome: NOMES[prof], papel: "professor", entrouEm: ha(50 * DIA) });
    for (const a of alunos) s(`turmas/${id}/membros/${a}`, { uid: a, nome: NOMES[a], papel: "aluno", entrouEm: ha(40 * DIA), codigo });
  };
  turma("turma-a", "ABCD2345", "prof-a", ["aluno-1", "aluno-2", "rep-1"]);
  turma("turma-b", "BCDE3456", "prof-b", ["aluno-3"]);
  turma("turma-arq", "CDEF4567", "prof-a", ["aluno-1"], true);

  const atividade = (t, id, autor, prazo, extra = {}) =>
    s(`turmas/${t}/atividades/${id}`, { titulo: "Atividade " + id, prazo, notaMax: 10, autorUid: autor, criadoEm: ha(20 * DIA), ...extra });
  atividade("turma-a", "atv-aberta", "prof-a", em(3 * DIA));
  atividade("turma-a", "atv-atrasada", "prof-a", ha(10 * HORA));             // atrasada, ainda aceita (24h)
  atividade("turma-a", "atv-fechada", "prof-a", ha(30 * HORA));              // passou de 24h: fechada
  atividade("turma-a", "atv-reaberta", "prof-a", ha(30 * HORA), { reabertaAte: em(2 * HORA) });
  atividade("turma-b", "atv-b", "prof-b", em(3 * DIA));
  atividade("turma-arq", "atv-arq", "prof-a", em(3 * DIA));

  const entrega = (t, a, aluno, quando, extra = {}) =>
    s(`turmas/${t}/atividades/${a}/entregas/${aluno}`, {
      texto: "Minha entrega", entregueEm: quando, atrasada: false, alunoUid: aluno, alunoNome: NOMES[aluno], corrigida: false, ...extra
    });
  entrega("turma-a", "atv-aberta", "aluno-2", ha(1 * HORA));                 // recente (dentro das 4h)
  entrega("turma-a", "atv-fechada", "aluno-1", ha(40 * HORA));               // antiga (passou das 4h)
  entrega("turma-b", "atv-b", "aluno-3", ha(1 * HORA));

  const folha = (t, id, autor, publicada, extra = {}) =>
    s(`turmas/${t}/notas/${id}`, { titulo: "Notas " + id, notaMax: 10, publicada, autorUid: autor, criadoEm: ha(5 * DIA),
                                   ...(publicada ? { publicadaEm: ha(4 * DIA) } : {}), ...extra });
  const item = (t, n, aluno, valor, atualizadoEm = ha(1 * DIA)) => s(`turmas/${t}/notas/${n}/itens/${aluno}`, { valor, atualizadoEm });
  folha("turma-a", "prova1", "prof-a", true);
  item("turma-a", "prova1", "aluno-1", 8); item("turma-a", "prova1", "aluno-2", 7);
  folha("turma-a", "rascunho", "prof-a", false);
  item("turma-a", "rascunho", "aluno-1", 5);
  folha("turma-a", "atv_atv-aberta", "prof-a", true, { atividadeId: "atv-aberta" });
  item("turma-a", "atv_atv-aberta", "aluno-2", 9, ha(30 * 60e3));            // entrega de 1h atrás: ainda escondida
  item("turma-a", "atv_atv-aberta", "aluno-1", 6, ha(30 * 60e3));            // sem entrega: visível
  folha("turma-a", "atv_atv-fechada", "prof-a", true, { atividadeId: "atv-fechada" });
  item("turma-a", "atv_atv-fechada", "aluno-1", 7);                          // entrega de 40h atrás: visível
  folha("turma-b", "prova-b", "prof-b", true);
  item("turma-b", "prova-b", "aluno-3", 9);

  s("turmas/turma-a/mensagens/m1", { texto: "Oi, turma", autorUid: "aluno-1", autorNome: NOMES["aluno-1"], autorPapel: "aluno", criadoEm: ha(HORA) });
  s("turmas/turma-a/avisos/v1", { texto: "Aviso da turma A", autorUid: "prof-a", autorNome: NOMES["prof-a"], autorPapel: "professor", criadoEm: ha(HORA) });
  s("turmas/turma-b/mensagens/mb1", { texto: "Oi, turma B", autorUid: "aluno-3", autorNome: NOMES["aluno-3"], autorPapel: "aluno", criadoEm: ha(HORA) });
  s("turmas/turma-b/avisos/vb1", { texto: "Aviso da turma B", autorUid: "prof-b", autorNome: NOMES["prof-b"], autorPapel: "professor", criadoEm: ha(HORA) });
  s("avisosCurso/c-rep", { texto: "Aviso da representante", autorUid: "rep-1", autorNome: NOMES["rep-1"], autorPapel: "representante", criadoEm: ha(HORA) });
  s("avisosCurso/c-adm", { texto: "Aviso da administração", autorUid: "admin-1", autorNome: NOMES["admin-1"], autorPapel: "admin", criadoEm: ha(HORA) });

  s("conversas/prof-a_aluno-1", { professorUid: "prof-a", alunoUid: "aluno-1", participantes: ["prof-a", "aluno-1"],
    professorNome: NOMES["prof-a"], alunoNome: NOMES["aluno-1"], turmaId: "turma-a", criadoEm: ha(DIA), atualizadoEm: ha(HORA) });
  s("conversas/prof-a_aluno-1/mensagens/pm1", { texto: "Olá, professora", autorUid: "aluno-1", autorNome: NOMES["aluno-1"], criadoEm: ha(HORA) });

  s("auditoria/reg-1", { acao: "turma_arquivada", autorUid: "prof-a", autorNome: NOMES["prof-a"], alvo: "turmas/turma-a",
    detalhes: "registro antigo", criadoEm: ha(DIA) });

  for (let i = 0; i < w.length; i += 400) {
    const b = writeBatch(db);
    for (const [p, d] of w.slice(i, i + 400)) b.set(doc(db, p), d);
    await b.commit();
  }
}

// Registra os ganchos do node:test no arquivo que importar este módulo.
export function prepararTestes() {
  before(async () => {
    ambiente = await initializeTestEnvironment({
      projectId: PROJETO,
      firestore: { host: HOST, port: PORTA_FIRESTORE, rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") }
    });
  });
  beforeEach(async () => {
    await ambiente.clearFirestore();
    await semRegras(cenarioBase);
  });
  after(async () => { await ambiente?.cleanup(); });
}

export { doc, setDoc };
