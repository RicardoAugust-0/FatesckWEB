// Representantes do curso (só o admin altera) e avisos para o curso inteiro, com autoria que não pode ser forjada.
import { describe, test } from "node:test";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, NOMES } from "./apoio.mjs";

prepararTestes();

function adicionarRep(uid, alvoUid, { comRegistro = true, regId = "reg-rep-" + alvoUid } = {}) {
  const db = como(uid), b = lote(db), alvo = "representantes/" + alvoUid;
  b.set(doc(db, alvo), { nome: NOMES[alvoUid], adicionadoEm: agora(), auditoriaId: regId });
  if (comRegistro) registrar(b, db, regId, uid, "representante_adicionado", alvo);
  return b.commit();
}
async function removerRep(uid, alvoUid, { comRegistro = true } = {}) {
  const db = como(uid), alvo = "representantes/" + alvoUid;
  const adicionadoEm = (await getDoc(doc(como("admin-1"), alvo))).data().adicionadoEm.toMillis();
  const b = lote(db);
  b.delete(doc(db, alvo));
  if (comRegistro) registrar(b, db, `rep_remocao_${alvoUid}_${adicionadoEm}`, uid, "representante_removido", alvo);
  return b.commit();
}
const avisoCurso = (uid, papel, extra = {}) => ({ texto: "Reunião do curso na quinta.", autorUid: uid, autorNome: NOMES[uid], autorPapel: papel, criadoEm: agora(), ...extra });

describe("quem são os representantes: só o admin altera", () => {
  test("admin adiciona representante com registro", async () => { await ok(adicionarRep("admin-1", "aluno-1")); });
  test("sem registro é recusado", async () => { await nega(adicionarRep("admin-1", "aluno-1", { comRegistro: false })); });
  test("professor e aluno não adicionam representante (nem a si mesmos)", async () => {
    await nega(adicionarRep("prof-a", "aluno-1"));
    await nega(adicionarRep("aluno-1", "aluno-1"));
    await nega(setDoc(doc(como("aluno-1"), "representantes/aluno-1"), { nome: NOMES["aluno-1"], adicionadoEm: agora(), auditoriaId: "x" }));
  });
  test("só aluno pode ser representante; nome precisa bater com o perfil", async () => {
    await nega(adicionarRep("admin-1", "prof-a"));
    const db = como("admin-1"), b = lote(db);
    b.set(doc(db, "representantes/aluno-2"), { nome: "Nome Falso", adicionadoEm: agora(), auditoriaId: "reg-x" });
    registrar(b, db, "reg-x", "admin-1", "representante_adicionado", "representantes/aluno-2");
    await nega(b.commit());
  });
  test("sem limite de quantidade: admin adiciona um terceiro", async () => {
    await ok(adicionarRep("admin-1", "aluno-1"));
    await ok(adicionarRep("admin-1", "aluno-2"));
  });
  test("admin remove com registro; sem registro é recusado; outros não removem", async () => {
    await nega(removerRep("admin-1", "rep-1", { comRegistro: false }));
    await nega(deleteDoc(doc(como("prof-a"), "representantes/rep-1")));
    await nega(deleteDoc(doc(como("rep-1"), "representantes/rep-1")));
    await ok(removerRep("admin-1", "rep-1"));
  });
  test("ninguém edita um representante (trocar = remover e adicionar)", async () => {
    await nega(updateDoc(doc(como("admin-1"), "representantes/rep-1"), { nome: "Outra Pessoa" }));
  });
  test("todos os usuários ativos veem quem são os representantes; pendente não", async () => {
    await ok(getDocs(collection(como("aluno-3"), "representantes")));
    await ok(getDocs(collection(como("prof-b"), "representantes")));
    await nega(getDocs(collection(como("prof-p"), "representantes")));
  });
});

describe("avisos do curso: quem posta", () => {
  test("representante posta como 'representante'", async () => {
    await ok(setDoc(doc(como("rep-1"), "avisosCurso/novo"), avisoCurso("rep-1", "representante")));
  });
  test("admin posta como 'admin'", async () => {
    await ok(setDoc(doc(como("admin-1"), "avisosCurso/novo"), avisoCurso("admin-1", "admin")));
  });
  test("aluno comum não posta (nem fingindo ser representante)", async () => {
    await nega(setDoc(doc(como("aluno-1"), "avisosCurso/novo"), avisoCurso("aluno-1", "representante")));
    await nega(setDoc(doc(como("aluno-1"), "avisosCurso/novo"), avisoCurso("aluno-1", "aluno")));
  });
  test("professor não posta aviso do curso", async () => {
    await nega(setDoc(doc(como("prof-a"), "avisosCurso/novo"), avisoCurso("prof-a", "professor")));
    await nega(setDoc(doc(como("prof-a"), "avisosCurso/novo"), avisoCurso("prof-a", "admin")));
  });
  test("etiqueta ou nome forjados são recusados", async () => {
    await nega(setDoc(doc(como("rep-1"), "avisosCurso/novo"), avisoCurso("rep-1", "admin")));
    await nega(setDoc(doc(como("rep-1"), "avisosCurso/novo"), avisoCurso("rep-1", "representante", { autorNome: "Coordenação" })));
    await nega(setDoc(doc(como("rep-1"), "avisosCurso/novo"), avisoCurso("rep-1", "representante", { autorUid: "admin-1" })));
    await nega(setDoc(doc(como("admin-1"), "avisosCurso/novo"), avisoCurso("admin-1", "representante")));
  });
  test("todos os usuários ativos leem; pendente e não verificado não", async () => {
    await ok(getDocs(collection(como("aluno-3"), "avisosCurso")));
    await ok(getDocs(collection(como("prof-b"), "avisosCurso")));
    await ok(getDocs(collection(como("aluno-sem"), "avisosCurso")));
    await nega(getDocs(collection(como("prof-p"), "avisosCurso")));
    await nega(getDocs(collection(como("aluno-1", { verificado: false }), "avisosCurso")));
  });
});

describe("avisos do curso: editar e apagar", () => {
  const editar = (uid, id, comRegistro = true) => {
    const db = como(uid), b = lote(db), alvo = "avisosCurso/" + id;
    b.update(doc(db, alvo), { texto: "Texto corrigido", editadoEm: agora(), auditoriaId: "reg-ed" });
    if (comRegistro) registrar(b, db, "reg-ed", uid, "aviso_editado", alvo);
    return b.commit();
  };
  const apagar = (uid, id, comRegistro = true) => {
    const db = como(uid), b = lote(db), alvo = "avisosCurso/" + id;
    b.delete(doc(db, alvo));
    if (comRegistro) registrar(b, db, "aviso_apagado_curso_" + id, uid, "aviso_apagado", alvo);
    return b.commit();
  };
  test("representante edita o próprio aviso com registro; sem registro é recusado", async () => {
    await nega(editar("rep-1", "c-rep", false));
    await ok(editar("rep-1", "c-rep"));
  });
  test("representante apaga o próprio aviso com registro", async () => {
    await nega(apagar("rep-1", "c-rep", false));
    await ok(apagar("rep-1", "c-rep"));
  });
  test("representante não edita nem apaga aviso de outra pessoa", async () => {
    await nega(editar("rep-1", "c-adm"));
    await nega(apagar("rep-1", "c-adm"));
  });
  test("ao editar, papel e nome não mudam", async () => {
    const db = como("rep-1"), b = lote(db);
    b.update(doc(db, "avisosCurso/c-rep"), { autorPapel: "admin", editadoEm: agora(), auditoriaId: "reg-ed" });
    registrar(b, db, "reg-ed", "rep-1", "aviso_editado", "avisosCurso/c-rep");
    await nega(b.commit());
  });
  test("admin edita e apaga qualquer aviso do curso", async () => {
    await ok(editar("admin-1", "c-rep"));
    await ok(apagar("admin-1", "c-rep"));
  });
  test("aluno comum e professor não editam", async () => {
    await nega(editar("aluno-1", "c-rep"));
    await nega(editar("prof-a", "c-adm"));
  });
});

describe("depois de deixar de ser representante", () => {
  test("ex-representante não posta, não edita nem apaga os próprios avisos antigos", async () => {
    await ok(removerRep("admin-1", "rep-1"));
    await nega(setDoc(doc(como("rep-1"), "avisosCurso/novo"), avisoCurso("rep-1", "representante")));
    const db = como("rep-1"), b = lote(db);
    b.update(doc(db, "avisosCurso/c-rep"), { texto: "x", editadoEm: agora(), auditoriaId: "reg-ed" });
    registrar(b, db, "reg-ed", "rep-1", "aviso_editado", "avisosCurso/c-rep");
    await nega(b.commit());
    await nega(deleteDoc(doc(como("rep-1"), "avisosCurso/c-rep")));
  });
  test("os avisos antigos continuam visíveis (com o papel gravado na época)", async () => {
    await ok(removerRep("admin-1", "rep-1"));
    const snap = await ok(getDoc(doc(como("aluno-1"), "avisosCurso/c-rep")));
    if (snap.data().autorPapel !== "representante") throw new Error("papel gravado mudou");
  });
  test("no chat, ex-representante posta como 'aluno' e não mais como 'representante'", async () => {
    await ok(removerRep("admin-1", "rep-1"));
    const m = papel => ({ texto: "Oi", autorUid: "rep-1", autorNome: NOMES["rep-1"], autorPapel: papel, criadoEm: agora() });
    await nega(setDoc(doc(como("rep-1"), "turmas/turma-a/mensagens/r1"), m("representante")));
    await ok(setDoc(doc(como("rep-1"), "turmas/turma-a/mensagens/r2"), m("aluno")));
  });
  test("aluno que vira representante passa a usar a etiqueta", async () => {
    await ok(adicionarRep("admin-1", "aluno-1"));
    const m = papel => ({ texto: "Oi", autorUid: "aluno-1", autorNome: NOMES["aluno-1"], autorPapel: papel, criadoEm: agora() });
    await nega(setDoc(doc(como("aluno-1"), "turmas/turma-a/mensagens/r1"), m("aluno")));
    await ok(setDoc(doc(como("aluno-1"), "turmas/turma-a/mensagens/r2"), m("representante")));
  });
});

