// Turmas, códigos de entrada, membros, isolamento entre turmas, arquivamento e a consulta "minhas turmas".
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, collectionGroup, query, where
} from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, NOMES, semRegras, ha, DIA } from "./apoio.mjs";

prepararTestes();

// Cria turma + código + (professor) membro no mesmo lote, como o site fará.
function criarTurma(db, uid, { id = "turma-nova", codigo = "HJKM2345", cor = "#2455C6", nome = "Redes", comMembro = true } = {}) {
  const b = lote(db);
  b.set(doc(db, "turmas", id), { nome, cor, codigo, arquivada: false, criadoPor: uid, criadoEm: agora() });
  b.set(doc(db, "codigos", codigo), { turmaId: id, arquivada: false, nome, cor });
  if (comMembro) b.set(doc(db, `turmas/${id}/membros/${uid}`), { uid, nome: NOMES[uid], papel: "professor", entrouEm: agora() });
  return b.commit();
}
// Pedido de entrada pelo código (o aluno não entra direto; o professor/admin aprova).
const pedir = (uid, turma, codigo, nome = NOMES[uid]) =>
  setDoc(doc(como(uid), `turmas/${turma}/pedidos/${uid}`),
    { uid, nome, turmaNome: "Turma " + turma, turmaCor: "#A61C24", codigo, status: "pendente", pedidoEm: agora() });

describe("criar turma", () => {
  test("professor ativo cria turma com código e entra como professor", async () => {
    await ok(criarTurma(como("prof-a"), "prof-a"));
  });
  test("admin cria turma (sem entrar como membro)", async () => {
    await ok(criarTurma(como("admin-1"), "admin-1", { comMembro: false }));
  });
  test("professor pendente e aluno não criam turma", async () => {
    await nega(criarTurma(como("prof-p"), "prof-p"));
    await nega(criarTurma(como("aluno-1"), "aluno-1"));
  });
  test("professor precisa entrar como professor no mesmo lote", async () => {
    await nega(criarTurma(como("prof-a"), "prof-a", { comMembro: false }));
  });
  test("código já usado por outra turma é recusado (código único)", async () => {
    await nega(criarTurma(como("prof-a"), "prof-a", { codigo: "ABCD2345" }));
  });
  test("código com caractere ambíguo, cor fora da lista e nome vazio são recusados", async () => {
    await nega(criarTurma(como("prof-a"), "prof-a", { codigo: "ABCDO123" }));
    await nega(criarTurma(como("prof-a"), "prof-a", { cor: "#FF00FF" }));
    await nega(criarTurma(como("prof-a"), "prof-a", { nome: "   " }));
  });
  test("professor não se coloca na turma de outro professor", async () => {
    await nega(setDoc(doc(como("prof-a"), "turmas/turma-b/membros/prof-a"),
      { uid: "prof-a", nome: NOMES["prof-a"], papel: "professor", entrouEm: agora() }));
  });
});

describe("código da turma", () => {
  test("o aluno não entra mais direto pelo código (precisa de pedido aprovado)", async () => {
    await nega(setDoc(doc(como("aluno-sem"), "turmas/turma-a/membros/aluno-sem"),
      { uid: "aluno-sem", nome: NOMES["aluno-sem"], papel: "aluno", entrouEm: agora(), codigo: "ABCD2345" }));
  });
  test("aluno não adiciona outro aluno nem entra como professor", async () => {
    await nega(setDoc(doc(como("aluno-1"), "turmas/turma-b/membros/aluno-sem"),
      { uid: "aluno-sem", nome: NOMES["aluno-sem"], papel: "aluno", entrouEm: agora(), codigo: "BCDE3456" }));
    await nega(setDoc(doc(como("aluno-sem"), "turmas/turma-a/membros/aluno-sem"),
      { uid: "aluno-sem", nome: NOMES["aluno-sem"], papel: "professor", entrouEm: agora() }));
  });
  test("código: busca exata liberada; listar todos os códigos é proibido", async () => {
    await ok(getDoc(doc(como("aluno-sem"), "codigos/ABCD2345")));
    await nega(getDocs(collection(como("aluno-sem"), "codigos")));
  });
  test("ninguém altera nem apaga um código diretamente", async () => {
    await nega(updateDoc(doc(como("aluno-1"), "codigos/ABCD2345"), { turmaId: "turma-b" }));
    await nega(deleteDoc(doc(como("prof-a"), "codigos/ABCD2345")));
  });
});

describe("isolamento: aluno só vê as próprias turmas", () => {
  test("aluno da turma B não lê nada da turma A", async () => {
    const db = como("aluno-3");
    await nega(getDoc(doc(db, "turmas/turma-a")));
    await nega(getDocs(collection(db, "turmas/turma-a/atividades")));
    await nega(getDocs(collection(db, "turmas/turma-a/avisos")));
    await nega(getDocs(collection(db, "turmas/turma-a/mensagens")));
    await nega(getDocs(query(collection(db, "turmas/turma-a/membros"), where("papel", "==", "professor"))));
    await nega(getDoc(doc(db, "turmas/turma-a/membros/aluno-1")));
  });
  test("aluno lê a própria turma e os professores dela, mas não a lista de colegas", async () => {
    const db = como("aluno-1");
    await ok(getDoc(doc(db, "turmas/turma-a")));
    await ok(getDocs(query(collection(db, "turmas/turma-a/membros"), where("papel", "==", "professor"))));
    await nega(getDocs(collection(db, "turmas/turma-a/membros")));
    await nega(getDoc(doc(db, "turmas/turma-a/membros/aluno-2")));
  });
  test("ninguém além do admin lista todas as turmas", async () => {
    await nega(getDocs(collection(como("aluno-1"), "turmas")));
    await nega(getDocs(collection(como("prof-a"), "turmas")));
    await ok(getDocs(collection(como("admin-1"), "turmas")));
  });
});

describe("consulta 'minhas turmas' (collection group membros)", () => {
  test("devolve só as turmas do próprio aluno", async () => {
    const snap = await ok(getDocs(query(collectionGroup(como("aluno-1"), "membros"), where("uid", "==", "aluno-1"))));
    const turmas = snap.docs.map(d => d.ref.parent.parent.id).sort();
    assert.deepEqual(turmas, ["turma-a", "turma-arq"]);
  });
  test("professor recebe só as próprias turmas", async () => {
    const snap = await ok(getDocs(query(collectionGroup(como("prof-b"), "membros"), where("uid", "==", "prof-b"))));
    assert.deepEqual(snap.docs.map(d => d.ref.parent.parent.id), ["turma-b"]);
  });
  test("sem o filtro, ou com o uid de outra pessoa, é recusado", async () => {
    await nega(getDocs(collectionGroup(como("aluno-1"), "membros")));
    await nega(getDocs(query(collectionGroup(como("aluno-1"), "membros"), where("uid", "==", "aluno-3"))));
    await nega(getDocs(query(collectionGroup(como("prof-a"), "membros"), where("uid", "==", "aluno-3"))));
  });
});

describe("isolamento: professor só mexe nas próprias turmas", () => {
  test("professor B não lê turma, entregas, notas nem chat da turma A", async () => {
    const db = como("prof-b");
    await nega(getDoc(doc(db, "turmas/turma-a")));
    await nega(getDocs(collection(db, "turmas/turma-a/atividades/atv-aberta/entregas")));
    await nega(getDoc(doc(db, "turmas/turma-a/atividades/atv-aberta/entregas/aluno-2")));
    await nega(getDocs(collection(db, "turmas/turma-a/notas")));
    await nega(getDocs(collection(db, "turmas/turma-a/notas/prova1/itens")));
    await nega(getDocs(collection(db, "turmas/turma-a/mensagens")));
    await nega(getDocs(collection(db, "turmas/turma-a/membros")));
  });
  test("professor B não edita a turma A nem as atividades dela", async () => {
    const db = como("prof-b");
    await nega(updateDoc(doc(db, "turmas/turma-a"), { nome: "Invadida" }));
    await nega(updateDoc(doc(db, "turmas/turma-a/atividades/atv-aberta"), { titulo: "Invadida", atualizadoEm: agora() }));
  });
  test("professor da turma altera nome e cor (o código acompanha no mesmo lote)", async () => {
    const alterar = (nomeT, corT, nomeC = nomeT, corC = corT) => { const db = como("prof-a"), b = lote(db);
      b.update(doc(db, "turmas/turma-a"), { nome: nomeT, cor: corT }); b.update(doc(db, "codigos/ABCD2345"), { nome: nomeC, cor: corC }); return b.commit(); };
    await nega(updateDoc(doc(como("prof-a"), "turmas/turma-a"), { nome: "Sem o código", cor: "#1F7A66" }));
    await nega(alterar("Banco de Dados I", "#1F7A66", "Nome diferente"));
    await ok(alterar("Banco de Dados I", "#1F7A66"));
    await nega(updateDoc(doc(como("aluno-1"), "codigos/ABCD2345"), { nome: "Invadido" }));
    await nega(updateDoc(doc(como("prof-a"), "turmas/turma-a"), { cor: "#123456" }));
    await nega(updateDoc(doc(como("prof-a"), "turmas/turma-a"), { codigo: "HJKM2345" }));
  });
});

describe("admin: professores e alunos em qualquer turma", () => {
  test("admin adiciona professor ativo a uma turma; professor não adiciona outro professor", async () => {
    const membro = uid => ({ uid, nome: NOMES[uid], papel: "professor", entrouEm: agora() });
    await nega(setDoc(doc(como("prof-a"), "turmas/turma-a/membros/prof-b"), membro("prof-b")));
    await ok(setDoc(doc(como("admin-1"), "turmas/turma-a/membros/prof-b"), membro("prof-b")));
  });
  test("admin não coloca professor pendente nem aluno como professor", async () => {
    const db = como("admin-1");
    await nega(setDoc(doc(db, "turmas/turma-a/membros/prof-p"), { uid: "prof-p", nome: NOMES["prof-p"], papel: "professor", entrouEm: agora() }));
    await nega(setDoc(doc(db, "turmas/turma-b/membros/aluno-1"), { uid: "aluno-1", nome: NOMES["aluno-1"], papel: "professor", entrouEm: agora() }));
  });
  const adicionarAluno = (comRegistro = true) => {
    const db = como("admin-1"), b = lote(db), alvo = "turmas/turma-b/membros/aluno-1";
    b.set(doc(db, alvo), { uid: "aluno-1", nome: NOMES["aluno-1"], papel: "aluno", entrouEm: agora(), auditoriaId: "reg-add" });
    if (comRegistro) registrar(b, db, "reg-add", "admin-1", "aluno_adicionado", alvo, { turmaId: "turma-b" });
    return b.commit();
  };
  test("admin adiciona aluno com registro; sem registro é recusado", async () => {
    await nega(adicionarAluno(false));
    await ok(adicionarAluno(true));
  });
  test("admin remove aluno com registro; sem registro é recusado; professor não remove", async () => {
    const alvo = "turmas/turma-a/membros/aluno-2";
    const db = como("admin-1");
    await nega(deleteDoc(doc(db, alvo)));
    await nega(deleteDoc(doc(como("prof-a"), alvo)));
    const entrouEm = (await getDoc(doc(db, alvo))).data().entrouEm.toMillis();
    const b = lote(db);
    b.delete(doc(db, alvo));
    registrar(b, db, `remocao_turma-a_aluno-2_${entrouEm}`, "admin-1", "aluno_removido", alvo, { turmaId: "turma-a" });
    await ok(b.commit());
  });
  test("aluno não sai sozinho nem remove colega", async () => {
    await nega(deleteDoc(doc(como("aluno-1"), "turmas/turma-a/membros/aluno-1")));
    await nega(deleteDoc(doc(como("aluno-1"), "turmas/turma-a/membros/aluno-2")));
  });
});

describe("arquivar e desarquivar", () => {
  const arquivar = (uid, turma, codigo, valor, { comRegistro = true, comCodigo = true, regId = "reg-arq" } = {}) => {
    const db = como(uid), b = lote(db);
    b.update(doc(db, "turmas", turma), { arquivada: valor, auditoriaId: regId });
    if (comCodigo) b.update(doc(db, "codigos", codigo), { arquivada: valor });
    if (comRegistro) registrar(b, db, regId, uid, valor ? "turma_arquivada" : "turma_desarquivada", "turmas/" + turma, { turmaId: turma });
    return b.commit();
  };
  test("professor arquiva a própria turma com registro e código junto", async () => {
    await ok(arquivar("prof-a", "turma-a", "ABCD2345", true));
  });
  test("sem registro, sem atualizar o código ou reaproveitando registro antigo: recusado", async () => {
    await nega(arquivar("prof-a", "turma-a", "ABCD2345", true, { comRegistro: false }));
    await nega(arquivar("prof-a", "turma-a", "ABCD2345", true, { comCodigo: false }));
    await nega(arquivar("prof-a", "turma-a", "ABCD2345", true, { comRegistro: false, regId: "reg-1" }));
  });
  test("aluno e professor de outra turma não arquivam", async () => {
    await nega(arquivar("aluno-1", "turma-a", "ABCD2345", true));
    await nega(arquivar("prof-b", "turma-a", "ABCD2345", true));
  });
  test("desarquivar volta a aceitar o código (pedido de entrada)", async () => {
    await ok(arquivar("prof-a", "turma-arq", "CDEF4567", false));
    await ok(pedir("aluno-sem", "turma-arq", "CDEF4567"));
  });
  test("admin também arquiva qualquer turma", async () => {
    await ok(arquivar("admin-1", "turma-b", "BCDE3456", true));
  });
  test("turma arquivada: somente leitura (nome/cor não mudam), mas membros ainda leem", async () => {
    await nega(updateDoc(doc(como("prof-a"), "turmas/turma-arq"), { nome: "Novo nome" }));
    await ok(getDoc(doc(como("aluno-1"), "turmas/turma-arq")));
    await ok(getDocs(collection(como("aluno-1"), "turmas/turma-arq/atividades")));
  });
  test("aluno removido perde o acesso", async () => {
    await semRegras(async db => { await deleteDoc(doc(db, "turmas/turma-a/membros/aluno-2")); });
    await nega(getDoc(doc(como("aluno-2"), "turmas/turma-a")));
  });
});

// evita aviso de import não usado
void ha; void DIA;
