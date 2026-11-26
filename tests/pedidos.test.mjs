// Pedidos de entrada na turma: o aluno digita o código e PEDE; o professor da turma ou o admin aprova ou recusa (com registro).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, collectionGroup, query, where } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, NOMES, semRegras, ha, DIA } from "./apoio.mjs";

prepararTestes();

const P = (turma, uid) => `turmas/${turma}/pedidos/${uid}`;
const pedido = (uid, turma, codigo, extra = {}) =>
  ({ uid, nome: NOMES[uid], turmaNome: "Turma " + turma, turmaCor: "#A61C24", codigo, status: "pendente", pedidoEm: agora(), ...extra });
const pedir = (uid, turma, codigo, extra) => setDoc(doc(como(uid), P(turma, uid)), pedido(uid, turma, codigo, extra));

// Um pedido pendente já gravado (para testar aprovação/recusa)
async function comPedidoPendente(uid = "aluno-sem", turma = "turma-a", codigo = "ABCD2345") {
  await semRegras(async db => {
    await setDoc(doc(db, P(turma, uid)), { uid, nome: NOMES[uid], turmaNome: "Turma " + turma, turmaCor: "#A61C24", codigo, status: "pendente", pedidoEm: ha(DIA) });
  });
}
function aprovar(quem, { uid = "aluno-sem", turma = "turma-a", comRegistro = true, apagaPedido = true, regId = "reg-aprova" } = {}) {
  const db = como(quem), b = lote(db), alvo = `turmas/${turma}/membros/${uid}`;
  b.set(doc(db, alvo), { uid, nome: NOMES[uid], papel: "aluno", entrouEm: agora(), aprovadoPor: quem, auditoriaId: regId });
  if (apagaPedido) b.delete(doc(db, P(turma, uid)));
  if (comRegistro) registrar(b, db, regId, quem, "aluno_aprovado", alvo, { turmaId: turma });
  return b.commit();
}
function recusar(quem, { uid = "aluno-sem", turma = "turma-a", comRegistro = true, regId = "reg-recusa" } = {}) {
  const db = como(quem), b = lote(db);
  b.update(doc(db, P(turma, uid)), { status: "recusado", recusadoEm: agora(), auditoriaId: regId });
  if (comRegistro) registrar(b, db, regId, quem, "aluno_recusado", P(turma, uid), { turmaId: turma });
  return b.commit();
}

describe("aluno pede para entrar", () => {
  test("com o código certo, o pedido é criado (pendente)", async () => {
    await ok(pedir("aluno-sem", "turma-a", "ABCD2345"));
  });
  test("código errado, turma arquivada, nome/turma/cor falsos ou já sendo membro: recusado", async () => {
    await nega(pedir("aluno-sem", "turma-a", "BCDE3456"));
    await nega(pedir("aluno-sem", "turma-arq", "CDEF4567"));
    await nega(pedir("aluno-sem", "turma-a", "ABCD2345", { nome: "Nome Falso" }));
    await nega(pedir("aluno-sem", "turma-a", "ABCD2345", { turmaNome: "Outra" }));
    await nega(pedir("aluno-sem", "turma-a", "ABCD2345", { turmaCor: "#15171A" }));
    await nega(pedir("aluno-1", "turma-a", "ABCD2345"));
  });
  test("pedido já aprovado/recusado não nasce assim; hora do aparelho é recusada", async () => {
    await nega(pedir("aluno-sem", "turma-a", "ABCD2345", { status: "aprovado" }));
    await nega(pedir("aluno-sem", "turma-a", "ABCD2345", { pedidoEm: ha(0) }));
  });
  test("ninguém pede em nome de outra pessoa; professor não pede como aluno", async () => {
    await nega(setDoc(doc(como("aluno-1"), P("turma-b", "aluno-sem")), pedido("aluno-sem", "turma-b", "BCDE3456")));
    await nega(pedir("prof-b", "turma-a", "ABCD2345"));
  });
  test("o aluno vê e cancela só o próprio pedido", async () => {
    await comPedidoPendente();
    await ok(getDoc(doc(como("aluno-sem"), P("turma-a", "aluno-sem"))));
    await nega(getDoc(doc(como("aluno-1"), P("turma-a", "aluno-sem"))));
    await nega(deleteDoc(doc(como("aluno-1"), P("turma-a", "aluno-sem"))));
    await ok(deleteDoc(doc(como("aluno-sem"), P("turma-a", "aluno-sem"))));
  });
  test("o aluno lista só os próprios pedidos (consulta por uid)", async () => {
    await comPedidoPendente("aluno-sem", "turma-a");
    await comPedidoPendente("aluno-3", "turma-a");
    const snap = await ok(getDocs(query(collectionGroup(como("aluno-sem"), "pedidos"), where("uid", "==", "aluno-sem"))));
    assert.deepEqual(snap.docs.map(d => d.ref.path), [P("turma-a", "aluno-sem")]);
    await nega(getDocs(query(collectionGroup(como("aluno-sem"), "pedidos"), where("uid", "==", "aluno-3"))));
    await nega(getDocs(collectionGroup(como("aluno-sem"), "pedidos")));
  });
  test("o aluno não aprova o próprio pedido nem muda o status", async () => {
    await comPedidoPendente();
    await nega(updateDoc(doc(como("aluno-sem"), P("turma-a", "aluno-sem")), { status: "aprovado" }));
    await nega(aprovar("aluno-sem"));
  });
});

describe("professor da turma / admin aprova", () => {
  test("professor da turma lista os pedidos; professor de outra turma não", async () => {
    await comPedidoPendente();
    await ok(getDocs(collection(como("prof-a"), "turmas/turma-a/pedidos")));
    await nega(getDocs(collection(como("prof-b"), "turmas/turma-a/pedidos")));
  });
  test("aprovar: cria o membro, apaga o pedido e registra (tudo junto)", async () => {
    await comPedidoPendente();
    await ok(aprovar("prof-a"));
    await ok(getDoc(doc(como("aluno-sem"), "turmas/turma-a")));
  });
  test("sem registro, sem apagar o pedido, ou sem pedido: recusado", async () => {
    await comPedidoPendente();
    await nega(aprovar("prof-a", { comRegistro: false }));
    await nega(aprovar("prof-a", { apagaPedido: false }));
    await nega(aprovar("prof-a", { uid: "aluno-3" })); // aluno-3 não pediu
  });
  test("professor de outra turma e professor pendente não aprovam", async () => {
    await comPedidoPendente();
    await nega(aprovar("prof-b"));
    await nega(aprovar("prof-p"));
  });
  test("admin aprova", async () => {
    await comPedidoPendente();
    await ok(aprovar("admin-1"));
  });
  test("pedido recusado não pode ser aprovado sem o aluno pedir de novo", async () => {
    await comPedidoPendente();
    await ok(recusar("prof-a"));
    await nega(aprovar("prof-a", { regId: "reg-aprova-2" }));
  });
  test("professor não apaga pedido sem aprovar", async () => {
    await comPedidoPendente();
    await nega(deleteDoc(doc(como("prof-a"), P("turma-a", "aluno-sem"))));
  });
});

describe("recusar e pedir de novo", () => {
  test("recusar exige registro; com registro é aceito; admin também recusa", async () => {
    await comPedidoPendente();
    await nega(recusar("prof-a", { comRegistro: false }));
    await ok(recusar("prof-a"));
    await comPedidoPendente("aluno-3", "turma-a");
    await ok(recusar("admin-1", { uid: "aluno-3", regId: "reg-recusa-2" }));
  });
  test("aluno não se recusa/aprova; professor de outra turma não recusa", async () => {
    await comPedidoPendente();
    await nega(recusar("prof-b"));
    await nega(recusar("aluno-sem"));
  });
  test("o aluno vê que foi recusado e pode pedir de novo (com o código certo)", async () => {
    await comPedidoPendente();
    await ok(recusar("prof-a"));
    const s = await ok(getDoc(doc(como("aluno-sem"), P("turma-a", "aluno-sem"))));
    assert.equal(s.data().status, "recusado");
    await nega(setDoc(doc(como("aluno-sem"), P("turma-a", "aluno-sem")), pedido("aluno-sem", "turma-a", "BCDE3456")));
    await ok(setDoc(doc(como("aluno-sem"), P("turma-a", "aluno-sem")), pedido("aluno-sem", "turma-a", "ABCD2345")));
  });
  test("pedido pendente não pode ser 'reenviado' pelo aluno (só depois de recusado)", async () => {
    await comPedidoPendente();
    await nega(setDoc(doc(como("aluno-sem"), P("turma-a", "aluno-sem")), pedido("aluno-sem", "turma-a", "ABCD2345")));
  });
  test("turma arquivada: não aprova nem recusa", async () => {
    await comPedidoPendente("aluno-sem", "turma-arq", "CDEF4567");
    await nega(aprovar("prof-a", { turma: "turma-arq" }));
    await nega(recusar("prof-a", { turma: "turma-arq" }));
  });
});
