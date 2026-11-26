// Fase 7a: avisos (turma e curso), "visto por último" (leituras) e o registro de alterações do admin,
// com as escritas/consultas montadas EXATAMENTE como em js/avisos.js, js/contadores.js e admin/avisos-registro-admin.js.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, orderBy, limit, getCountFromServer, Timestamp
} from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, semRegras, NOMES } from "./apoio.mjs";

prepararTestes();

const T = "turma-a";
const avisoTurma = (uid, extra = {}) => ({ texto: "Aula amanhã no lab 3.", autorUid: uid, autorNome: NOMES[uid], autorPapel: "professor", criadoEm: agora(), ...extra });
const avisoCurso = (uid, papel, extra = {}) => ({ texto: "Semana acadêmica.", autorUid: uid, autorNome: NOMES[uid], autorPapel: papel, criadoEm: agora(), ...extra });

describe("publicar (botão + janela)", () => {
  test("professor da turma publica na turma; aluno, outro professor e admin não", async () => {
    await ok(setDoc(doc(collection(como("prof-a"), `turmas/${T}/avisos`)), avisoTurma("prof-a")));
    await nega(setDoc(doc(collection(como("aluno-1"), `turmas/${T}/avisos`)), avisoTurma("aluno-1")));
    await nega(setDoc(doc(collection(como("prof-b"), `turmas/${T}/avisos`)), avisoTurma("prof-b")));
    await nega(setDoc(doc(collection(como("admin-1"), `turmas/${T}/avisos`)), avisoTurma("admin-1")));
  });
  test("mural do curso: representante (papel 'representante') e admin (papel 'admin'); aluno comum e professor não", async () => {
    await ok(setDoc(doc(collection(como("rep-1"), "avisosCurso")), avisoCurso("rep-1", "representante")));
    await ok(setDoc(doc(collection(como("admin-1"), "avisosCurso")), avisoCurso("admin-1", "admin")));
    await nega(setDoc(doc(collection(como("aluno-1"), "avisosCurso")), avisoCurso("aluno-1", "representante")));
    await nega(setDoc(doc(collection(como("prof-a"), "avisosCurso")), avisoCurso("prof-a", "admin")));
    await nega(setDoc(doc(collection(como("rep-1"), "avisosCurso")), avisoCurso("rep-1", "admin"))); // não finge ser admin
  });
});

describe("editar / apagar (com registro)", () => {
  const alvoT = `turmas/${T}/avisos/v1`, alvoC = "avisosCurso/c-rep";
  const editar = (quem, alvo, regId, { comRegistro = true, turmaId } = {}) => {
    const db = como(quem), b = lote(db);
    b.update(doc(db, alvo), { texto: "Texto corrigido.", editadoEm: agora(), auditoriaId: regId });
    if (comRegistro) registrar(b, db, regId, quem, "aviso_editado", alvo, turmaId ? { turmaId } : {});
    return b.commit();
  };
  const apagar = (quem, alvo, regId, turmaId) => {
    const db = como(quem), b = lote(db);
    b.delete(doc(db, alvo));
    registrar(b, db, regId, quem, "aviso_apagado", alvo, turmaId ? { turmaId } : {});
    return b.commit();
  };
  test("autor edita o aviso da turma com registro; sem registro é recusado", async () => {
    await nega(editar("prof-a", alvoT, "r1", { comRegistro: false }));
    await ok(editar("prof-a", alvoT, "r2", { turmaId: T }));
  });
  test("admin edita e apaga aviso de turma (id fixo do registro ao apagar)", async () => {
    await ok(editar("admin-1", alvoT, "r3", { turmaId: T }));
    await ok(apagar("admin-1", alvoT, `aviso_apagado_turma_${T}_v1`, T));
  });
  test("apagar com id de registro errado é recusado", async () => {
    await nega(apagar("prof-a", alvoT, "qualquer-id", T));
  });
  test("representante edita/apaga o próprio aviso do curso; outro aluno não", async () => {
    await nega(editar("aluno-1", alvoC, "r4"));
    await ok(editar("rep-1", alvoC, "r5"));
    await ok(apagar("rep-1", alvoC, "aviso_apagado_curso_c-rep"));
  });
  test("depois de deixar de ser representante (Ex-Representante), não mexe mais no aviso; o admin mexe", async () => {
    await semRegras(async db => { await deleteDoc(doc(db, "representantes/rep-1")); });
    await nega(editar("rep-1", alvoC, "r6"));
    await ok(apagar("admin-1", alvoC, "aviso_apagado_curso_c-rep"));
  });
});

describe("'visto por último' (leituras): abrir Avisos/Atividades marca tudo de uma vez", () => {
  test("um lote com curso_avisos + avisos e atividades de várias turmas: aceito", async () => {
    const db = como("aluno-1"), b = lote(db);
    for (const c of ["curso_avisos", `turma_${T}_avisos`, "turma_turma-arq_avisos", `turma_${T}_atividades`])
      b.set(doc(db, `usuarios/aluno-1/leituras/${c}`), { vistoEm: agora() });
    await ok(b.commit());
  });
  test("chave fora do formato, hora do aparelho ou leitura de outra pessoa: recusado", async () => {
    await nega(setDoc(doc(como("aluno-1"), "usuarios/aluno-1/leituras/qualquer_coisa"), { vistoEm: agora() }));
    await nega(setDoc(doc(como("aluno-1"), "usuarios/aluno-1/leituras/curso_avisos"), { vistoEm: Timestamp.now() }));
    await nega(setDoc(doc(como("aluno-1"), "usuarios/aluno-2/leituras/curso_avisos"), { vistoEm: agora() }));
    await nega(getDoc(doc(como("aluno-1"), "usuarios/aluno-2/leituras/curso_avisos")));
  });
  test("consultas do contador do menu: atividades e avisos novos depois da última visita", async () => {
    const db = como("aluno-1"), desde = Timestamp.fromMillis(0);
    const n = await ok(getCountFromServer(query(collection(db, `turmas/${T}/atividades`), where("criadoEm", ">", desde))));
    assert.ok(n.data().count >= 1);
    await ok(getDocs(query(collection(db, `turmas/${T}/avisos`), where("criadoEm", ">", desde))));
    await ok(getDocs(query(collection(db, "avisosCurso"), where("criadoEm", ">", desde))));
    await nega(getDocs(query(collection(db, "turmas/turma-b/avisos"), where("criadoEm", ">", desde)))); // turma dos outros
  });
});

describe("Registro de alterações (admin)", () => {
  test("admin lista o mais novo primeiro, com filtro por tipo e por turma, 30 por vez", async () => {
    const db = como("admin-1");
    await ok(getDocs(query(collection(db, "auditoria"), orderBy("criadoEm", "desc"), limit(30))));
    await ok(getDocs(query(collection(db, "auditoria"), where("acao", "==", "turma_arquivada"), orderBy("criadoEm", "desc"), limit(30))));
    await ok(getDocs(query(collection(db, "auditoria"), where("turmaId", "==", T), orderBy("criadoEm", "desc"), limit(30))));
  });
  test("professor e aluno não leem o registro", async () => {
    await nega(getDocs(query(collection(como("prof-a"), "auditoria"), orderBy("criadoEm", "desc"), limit(30))));
    await nega(getDocs(query(collection(como("aluno-1"), "auditoria"), limit(1))));
  });
});
