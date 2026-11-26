// Chat da turma (com a etiqueta do autor), avisos da turma e conversas privadas professor <-> aluno.
import { describe, test } from "node:test";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, Timestamp } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, NOMES, semRegras } from "./apoio.mjs";

prepararTestes();

const msg = (uid, papel, extra = {}) => ({ texto: "Olá!", autorUid: uid, autorNome: NOMES[uid], autorPapel: papel, criadoEm: agora(), ...extra });
const postar = (uid, papel, turma = "turma-a", extra = {}) => setDoc(doc(como(uid), `turmas/${turma}/mensagens/nova-${uid}`), msg(uid, papel, extra));

describe("chat da turma: etiqueta do autor conferida pela regra", () => {
  test("aluno posta como 'aluno'", async () => { await ok(postar("aluno-1", "aluno")); });
  test("aluno não se passa por representante nem por professor", async () => {
    await nega(postar("aluno-1", "representante"));
    await nega(postar("aluno-1", "professor"));
  });
  test("representante posta como 'representante' e não consegue esconder a etiqueta", async () => {
    await ok(postar("rep-1", "representante"));
    await nega(postar("rep-1", "aluno"));
  });
  test("professor posta como 'professor'", async () => { await ok(postar("prof-a", "professor")); });
  test("nome do autor diferente do perfil, autor falso ou hora do aparelho: recusado", async () => {
    await nega(postar("aluno-1", "aluno", "turma-a", { autorNome: "Professora Helena" }));
    await nega(setDoc(doc(como("aluno-1"), "turmas/turma-a/mensagens/x"), msg("aluno-2", "aluno")));
    await nega(postar("aluno-1", "aluno", "turma-a", { criadoEm: Timestamp.now() }));
  });
  test("quem não é da turma não posta; turma arquivada não recebe mensagem", async () => {
    await nega(postar("aluno-3", "aluno"));
    await nega(postar("prof-b", "professor"));
    await nega(postar("aluno-1", "aluno", "turma-arq"));
  });
  test("ninguém edita mensagem", async () => {
    await nega(updateDoc(doc(como("aluno-1"), "turmas/turma-a/mensagens/m1"), { texto: "editada" }));
  });
});

describe("chat da turma: apagar mensagem", () => {
  const apagar = (uid, comRegistro = true) => {
    const db = como(uid), b = lote(db), alvo = "turmas/turma-a/mensagens/m1";
    b.delete(doc(db, alvo));
    if (comRegistro) registrar(b, db, "mensagem_turma-a_m1", uid, "mensagem_removida", alvo, { turmaId: "turma-a" });
    return b.commit();
  };
  test("professor da turma apaga com registro; sem registro é recusado", async () => {
    await nega(apagar("prof-a", false));
    await ok(apagar("prof-a"));
  });
  test("admin apaga com registro", async () => { await ok(apagar("admin-1")); });
  test("aluno não apaga mensagem de outros (nem a própria)", async () => {
    await nega(deleteDoc(doc(como("aluno-2"), "turmas/turma-a/mensagens/m1")));
    await nega(deleteDoc(doc(como("aluno-1"), "turmas/turma-a/mensagens/m1")));
  });
  test("professor de outra turma não apaga", async () => { await nega(apagar("prof-b")); });
});

describe("avisos da turma", () => {
  const aviso = (uid, extra = {}) => ({ texto: "Prova na sexta.", autorUid: uid, autorNome: NOMES[uid], autorPapel: "professor", criadoEm: agora(), ...extra });
  test("professor da turma posta aviso com papel 'professor'", async () => {
    await ok(setDoc(doc(como("prof-a"), "turmas/turma-a/avisos/novo"), aviso("prof-a")));
  });
  test("papel diferente, aviso em branco, aluno, representante ou professor pendente: recusado", async () => {
    await nega(setDoc(doc(como("prof-a"), "turmas/turma-a/avisos/novo"), aviso("prof-a", { autorPapel: "admin" })));
    await nega(setDoc(doc(como("prof-a"), "turmas/turma-a/avisos/novo"), aviso("prof-a", { texto: "   " })));
    await nega(setDoc(doc(como("aluno-1"), "turmas/turma-a/avisos/novo"), aviso("aluno-1")));
    await nega(setDoc(doc(como("rep-1"), "turmas/turma-a/avisos/novo"), aviso("rep-1", { autorPapel: "representante" })));
    await nega(setDoc(doc(como("prof-p"), "turmas/turma-a/avisos/novo"), aviso("prof-p")));
  });
  const editar = (uid, comRegistro = true) => {
    const db = como(uid), b = lote(db), alvo = "turmas/turma-a/avisos/v1";
    b.update(doc(db, alvo), { texto: "Aviso corrigido", editadoEm: agora(), auditoriaId: "reg-ed-" + uid });
    if (comRegistro) registrar(b, db, "reg-ed-" + uid, uid, "aviso_editado", alvo, { turmaId: "turma-a" });
    return b.commit();
  };
  test("autor edita com registro; sem registro é recusado; admin edita", async () => {
    await nega(editar("prof-a", false));
    await ok(editar("prof-a"));
    await ok(editar("admin-1"));
  });
  test("autor não muda o papel nem o nome do aviso", async () => {
    await nega(updateDoc(doc(como("prof-a"), "turmas/turma-a/avisos/v1"), { autorNome: "Outro" }));
  });
  test("aluno não edita aviso", async () => { await nega(editar("aluno-1")); });
  const apagarAviso = (uid, comRegistro = true) => {
    const db = como(uid), b = lote(db), alvo = "turmas/turma-a/avisos/v1";
    b.delete(doc(db, alvo));
    if (comRegistro) registrar(b, db, "aviso_apagado_turma_turma-a_v1", uid, "aviso_apagado", alvo, { turmaId: "turma-a" });
    return b.commit();
  };
  test("autor apaga com registro; sem registro é recusado; admin apaga", async () => {
    await nega(apagarAviso("prof-a", false));
    await ok(apagarAviso("prof-a"));
  });
  test("admin apaga aviso de turma", async () => { await ok(apagarAviso("admin-1")); });
  test("aluno lê avisos da própria turma, não de outra", async () => {
    await ok(getDocs(collection(como("aluno-1"), "turmas/turma-a/avisos")));
    await nega(getDocs(collection(como("aluno-1"), "turmas/turma-b/avisos")));
  });
});

describe("conversas privadas professor <-> aluno", () => {
  const conversa = (prof, aluno, turmaId, extra = {}) => ({
    professorUid: prof, alunoUid: aluno, participantes: [prof, aluno], professorNome: NOMES[prof], alunoNome: NOMES[aluno],
    turmaId, criadoEm: agora(), atualizadoEm: agora(), ...extra
  });
  test("aluno inicia conversa com professor de uma turma sua", async () => {
    await ok(setDoc(doc(como("aluno-2"), "conversas/prof-a_aluno-2"), conversa("prof-a", "aluno-2", "turma-a")));
  });
  test("professor inicia conversa com aluno da sua turma", async () => {
    await ok(setDoc(doc(como("prof-a"), "conversas/prof-a_rep-1"), conversa("prof-a", "rep-1", "turma-a")));
  });
  test("aluno não inicia conversa com professor de outra turma", async () => {
    await nega(setDoc(doc(como("aluno-3"), "conversas/prof-a_aluno-3"), conversa("prof-a", "aluno-3", "turma-a")));
    await nega(setDoc(doc(como("aluno-3"), "conversas/prof-a_aluno-3"), conversa("prof-a", "aluno-3", "turma-b")));
  });
  test("não existe conversa aluno <-> aluno", async () => {
    await nega(setDoc(doc(como("aluno-1"), "conversas/aluno-2_aluno-1"), conversa("aluno-2", "aluno-1", "turma-a")));
  });
  test("ninguém cria conversa entre outras duas pessoas; nome falso é recusado", async () => {
    await nega(setDoc(doc(como("aluno-1"), "conversas/prof-a_aluno-2"), conversa("prof-a", "aluno-2", "turma-a")));
    await nega(setDoc(doc(como("aluno-2"), "conversas/prof-a_aluno-2"), conversa("prof-a", "aluno-2", "turma-a", { professorNome: "Outro" })));
  });
  test("id precisa ser professor_aluno (impede conversas duplicadas)", async () => {
    await nega(setDoc(doc(como("aluno-2"), "conversas/qualquer"), conversa("prof-a", "aluno-2", "turma-a")));
  });
  test("turma arquivada não serve de vínculo para iniciar conversa", async () => {
    await semRegras(async db => {
      await setDoc(doc(db, "turmas/turma-arq/membros/aluno-2"), { uid: "aluno-2", nome: NOMES["aluno-2"], papel: "aluno", entrouEm: agora() });
    });
    await nega(setDoc(doc(como("aluno-2"), "conversas/prof-a_aluno-2"), conversa("prof-a", "aluno-2", "turma-arq")));
    await ok(setDoc(doc(como("aluno-2"), "conversas/prof-a_aluno-2"), conversa("prof-a", "aluno-2", "turma-a")));
  });
  test("professor pendente não conversa (mesmo se estivesse numa turma)", async () => {
    await semRegras(async db => {
      await setDoc(doc(db, "turmas/turma-a/membros/prof-p"), { uid: "prof-p", nome: NOMES["prof-p"], papel: "professor", entrouEm: agora() });
    });
    await nega(setDoc(doc(como("aluno-1"), "conversas/prof-p_aluno-1"), conversa("prof-p", "aluno-1", "turma-a")));
    await nega(setDoc(doc(como("prof-p"), "conversas/prof-p_aluno-1"), conversa("prof-p", "aluno-1", "turma-a")));
  });
  test("participantes leem e escrevem; outro aluno não lê; admin lê", async () => {
    const m = uid => ({ texto: "Mensagem privada", autorUid: uid, autorNome: NOMES[uid], criadoEm: agora() });
    await ok(setDoc(doc(como("aluno-1"), "conversas/prof-a_aluno-1/mensagens/n1"), m("aluno-1")));
    await ok(setDoc(doc(como("prof-a"), "conversas/prof-a_aluno-1/mensagens/n2"), m("prof-a")));
    await ok(getDocs(collection(como("prof-a"), "conversas/prof-a_aluno-1/mensagens")));
    await nega(getDocs(collection(como("aluno-2"), "conversas/prof-a_aluno-1/mensagens")));
    await nega(setDoc(doc(como("aluno-2"), "conversas/prof-a_aluno-1/mensagens/n3"), m("aluno-2")));
    await nega(getDoc(doc(como("aluno-2"), "conversas/prof-a_aluno-1")));
    await ok(getDocs(collection(como("admin-1"), "conversas/prof-a_aluno-1/mensagens")));
  });
  test("lista de conversas: só as próprias", async () => {
    await ok(getDocs(query(collection(como("aluno-1"), "conversas"), where("participantes", "array-contains", "aluno-1"))));
    await nega(getDocs(collection(como("aluno-1"), "conversas")));
    await nega(getDocs(query(collection(como("aluno-2"), "conversas"), where("participantes", "array-contains", "aluno-1"))));
  });
  test("participante atualiza só a hora da última mensagem", async () => {
    await ok(updateDoc(doc(como("aluno-1"), "conversas/prof-a_aluno-1"), { atualizadoEm: agora() }));
    await nega(updateDoc(doc(como("aluno-1"), "conversas/prof-a_aluno-1"), { turmaId: "turma-b" }));
  });
  test("só o admin apaga mensagem privada, com registro; professor não apaga", async () => {
    const alvo = "conversas/prof-a_aluno-1/mensagens/pm1";
    await nega(deleteDoc(doc(como("prof-a"), alvo)));
    await nega(deleteDoc(doc(como("admin-1"), alvo)));
    const db = como("admin-1"), b = lote(db);
    b.delete(doc(db, alvo));
    registrar(b, db, "mensagem_conversa_prof-a_aluno-1_pm1", "admin-1", "mensagem_removida", alvo);
    await ok(b.commit());
  });
});
