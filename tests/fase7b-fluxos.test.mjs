// Fase 7b: chat da turma + conversas particulares, com as escritas/consultas montadas EXATAMENTE como em
// js/chat.js (escutas em tempo real usam estas mesmas consultas), js/avisos.js (marcarVisto) e admin/chat-admin.js.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, orderBy, limitToLast, Timestamp
} from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, semRegras, NOMES } from "./apoio.mjs";
import { rotuloPapel } from "../public/js/ui/componentes.js";

prepararTestes();

const T = "turma-a", C = "prof-a_aluno-1";
// ---- consultas das escutas (js/chat.js) ----
const mensagens = (quem, caminho) => getDocs(query(collection(como(quem), caminho), orderBy("criadoEm", "asc"), limitToLast(300)));
const novas = (quem, caminho, desdeMs = 0) => getDocs(query(collection(como(quem), caminho), where("criadoEm", ">", Timestamp.fromMillis(desdeMs))));
const minhasConversas = quem => getDocs(query(collection(como(quem), "conversas"), where("participantes", "array-contains", quem)));
// ---- escritas (js/chat.js) ----
const enviarTurma = (quem, papel, turma = T, texto = "Bom dia, turma!") =>
  setDoc(doc(collection(como(quem), `turmas/${turma}/mensagens`)), { texto, autorUid: quem, autorNome: NOMES[quem], criadoEm: agora(), autorPapel: papel });
const enviarPrivada = (quem, conversa = C, texto = "Professora, posso tirar uma dúvida?") => {
  const db = como(quem), b = lote(db);
  b.set(doc(collection(db, `conversas/${conversa}/mensagens`)), { texto, autorUid: quem, autorNome: NOMES[quem], criadoEm: agora() });
  b.update(doc(db, "conversas", conversa), { atualizadoEm: agora() });
  return b.commit();
};
const abrirConversa = async (quem, prof, aluno, turmaId) => {
  const ref = doc(como(quem), "conversas", `${prof}_${aluno}`);
  const atual = await getDoc(ref);
  if (atual.exists()) return "existia";
  await setDoc(ref, { professorUid: prof, alunoUid: aluno, participantes: [prof, aluno], professorNome: NOMES[prof], alunoNome: NOMES[aluno],
    turmaId, criadoEm: agora(), atualizadoEm: agora() });
  return "criada";
};
const apagarDaTurma = (quem, turma = T, id = "m1", regId = `mensagem_${turma}_${id}`) => {
  const db = como(quem), b = lote(db), alvo = `turmas/${turma}/mensagens/${id}`;
  b.delete(doc(db, alvo));
  registrar(b, db, regId, quem, "mensagem_removida", alvo, { turmaId: turma });
  return b.commit();
};
const apagarPrivada = (quem, conversa = C, id = "pm1") => {
  const db = como(quem), b = lote(db), alvo = `conversas/${conversa}/mensagens/${id}`;
  b.delete(doc(db, alvo));
  registrar(b, db, `mensagem_conversa_${conversa}_${id}`, quem, "mensagem_removida", alvo);
  return b.commit();
};
const marcarVisto = (quem, chaves, dono = quem) => {
  const db = como(quem), b = lote(db);
  for (const c of chaves) b.set(doc(db, "usuarios", dono, "leituras", c), { vistoEm: agora() });
  return b.commit();
};

describe("chat da turma em tempo real (consultas das escutas)", () => {
  test("membros (aluno e professor) e admin leem as mensagens em ordem; quem é de fora não", async () => {
    for (const quem of ["aluno-1", "rep-1", "prof-a", "admin-1"]) await ok(mensagens(quem, `turmas/${T}/mensagens`));
    await nega(mensagens("aluno-3", `turmas/${T}/mensagens`));
    await nega(mensagens("prof-b", `turmas/${T}/mensagens`));
    await nega(mensagens("aluno-sem", `turmas/${T}/mensagens`));
  });
  test("a mensagem enviada aparece na consulta de quem está na turma", async () => {
    await ok(enviarTurma("aluno-1", "aluno", T, "Alguém fez o exercício 3?"));
    const snap = await mensagens("prof-a", `turmas/${T}/mensagens`);
    assert.ok(snap.docs.some(d => d.data().texto === "Alguém fez o exercício 3?" && d.data().autorPapel === "aluno"));
  });
  test("consulta de não lidas (depois da última visita) funciona para membros e é recusada a quem é de fora", async () => {
    await ok(novas("aluno-2", `turmas/${T}/mensagens`, Date.now() - 1000));
    await nega(novas("aluno-3", `turmas/${T}/mensagens`));
  });
});

describe("etiqueta Representante / Ex-Representante", () => {
  test("as regras gravam o papel real: representante não esconde, aluno comum não finge", async () => {
    await ok(enviarTurma("rep-1", "representante"));
    await nega(enviarTurma("rep-1", "aluno"));
    await nega(enviarTurma("aluno-1", "representante"));
    await ok(enviarTurma("prof-a", "professor"));
    await nega(enviarTurma("aluno-1", "professor"));
  });
  test("depois de sair da lista de representantes: passa a postar como 'aluno' e as antigas viram Ex-Representante", async () => {
    await ok(enviarTurma("rep-1", "representante"));
    await semRegras(db => deleteDoc(doc(db, "representantes/rep-1")));
    await nega(enviarTurma("rep-1", "representante"));
    await ok(enviarTurma("rep-1", "aluno"));
    const reps = new Set((await getDocs(collection(como("aluno-1"), "representantes"))).docs.map(d => d.id));
    assert.equal(rotuloPapel("representante", "rep-1", reps), "Ex-Representante");
  });
  test("rótulos da tela", () => {
    assert.equal(rotuloPapel("representante", "rep-1", new Set(["rep-1"])), "Representante");
    assert.equal(rotuloPapel("professor", "prof-a", new Set()), "Professor");
    assert.equal(rotuloPapel("aluno", "aluno-1", new Set()), "");
  });
});

describe("mensagem: limites", () => {
  test("vazia, só espaços, com espaço nas pontas ou acima de 2000 caracteres: recusada; 2000 passa", async () => {
    await nega(enviarTurma("aluno-1", "aluno", T, ""));
    await nega(enviarTurma("aluno-1", "aluno", T, "   "));
    await nega(enviarTurma("aluno-1", "aluno", T, " oi "));
    await nega(enviarTurma("aluno-1", "aluno", T, "a".repeat(2001)));
    await ok(enviarTurma("aluno-1", "aluno", T, "a".repeat(2000)));
    await nega(enviarPrivada("aluno-1", C, "a".repeat(2001)));
  });
});

describe("turma arquivada: chat só para leitura", () => {
  test("membros leem, ninguém envia e ninguém apaga", async () => {
    await semRegras(db => setDoc(doc(db, "turmas/turma-arq/mensagens/antiga"),
      { texto: "Mensagem antiga", autorUid: "aluno-1", autorNome: NOMES["aluno-1"], autorPapel: "aluno", criadoEm: Timestamp.now() }));
    await ok(mensagens("aluno-1", "turmas/turma-arq/mensagens"));
    await ok(mensagens("prof-a", "turmas/turma-arq/mensagens"));
    await nega(enviarTurma("aluno-1", "aluno", "turma-arq"));
    await nega(enviarTurma("prof-a", "professor", "turma-arq"));
    await nega(apagarDaTurma("prof-a", "turma-arq", "antiga"));
    await nega(apagarDaTurma("admin-1", "turma-arq", "antiga"));
  });
});

describe("conversa particular: quem pode iniciar", () => {
  test("aluno abre com professor de uma turma sua (cria uma vez; depois só reabre)", async () => {
    assert.equal(await ok(abrirConversa("aluno-2", "prof-a", "aluno-2", T)), "criada");
    assert.equal(await ok(abrirConversa("aluno-2", "prof-a", "aluno-2", T)), "existia");
    assert.equal(await ok(abrirConversa("prof-a", "prof-a", "aluno-2", T)), "existia"); // o professor encontra a mesma conversa
  });
  test("professor abre com aluno da turma dele", async () => {
    assert.equal(await ok(abrirConversa("prof-a", "prof-a", "rep-1", T)), "criada");
  });
  test("aluno não abre com professor de outra turma; professor não abre com aluno de outra turma", async () => {
    await nega(abrirConversa("aluno-1", "prof-b", "aluno-1", "turma-b"));
    await nega(abrirConversa("aluno-1", "prof-b", "aluno-1", T));
    await nega(abrirConversa("prof-a", "prof-a", "aluno-3", T));
  });
  test("não existe conversa aluno <-> aluno nem professor <-> professor", async () => {
    await nega(abrirConversa("aluno-1", "aluno-2", "aluno-1", T));
    await nega(abrirConversa("aluno-1", "aluno-1", "aluno-2", T));
    await nega(abrirConversa("prof-a", "prof-a", "prof-b", T));
  });
  test("admin não inicia conversa particular", async () => {
    await nega(setDoc(doc(como("admin-1"), "conversas/prof-a_aluno-2"), { professorUid: "prof-a", alunoUid: "aluno-2", participantes: ["prof-a", "aluno-2"],
      professorNome: NOMES["prof-a"], alunoNome: NOMES["aluno-2"], turmaId: T, criadoEm: agora(), atualizadoEm: agora() }));
  });
});

describe("conversa particular: mensagens em tempo real", () => {
  test("os dois participantes enviam (mensagem + hora da conversa no mesmo lote) e leem", async () => {
    await ok(enviarPrivada("aluno-1"));
    await ok(enviarPrivada("prof-a", C, "Pode sim."));
    const snap = await mensagens("aluno-1", `conversas/${C}/mensagens`);
    assert.ok(snap.docs.some(d => d.data().texto === "Pode sim."));
    await ok(novas("prof-a", `conversas/${C}/mensagens`, Date.now() - 1000));
  });
  test("quem não participa não lê, não envia e não vê na lista", async () => {
    await nega(mensagens("aluno-2", `conversas/${C}/mensagens`));
    await nega(mensagens("prof-b", `conversas/${C}/mensagens`));
    await nega(enviarPrivada("aluno-2"));
    const lista = await ok(minhasConversas("aluno-2"));
    assert.equal(lista.docs.filter(d => d.id === C).length, 0);
    await nega(getDocs(collection(como("aluno-2"), "conversas")));
  });
  test("lista de conversas: cada um vê as suas", async () => {
    assert.ok((await ok(minhasConversas("aluno-1"))).docs.some(d => d.id === C));
    assert.ok((await ok(minhasConversas("prof-a"))).docs.some(d => d.id === C));
  });
  test("ninguém se passa por outra pessoa na conversa", async () => {
    const db = como("aluno-1"), b = lote(db);
    b.set(doc(collection(db, `conversas/${C}/mensagens`)), { texto: "Nota 10 para todos", autorUid: "prof-a", autorNome: NOMES["prof-a"], criadoEm: agora() });
    b.update(doc(db, "conversas", C), { atualizadoEm: agora() });
    await nega(b.commit());
  });
});

describe("apagar mensagem (some de verdade + registro de alterações)", () => {
  test("professor da turma apaga do chat da turma; o documento some e o registro fica", async () => {
    await ok(apagarDaTurma("prof-a"));
    assert.equal((await getDoc(doc(como("prof-a"), `turmas/${T}/mensagens/m1`))).exists(), false);
    const reg = await getDoc(doc(como("admin-1"), `auditoria/mensagem_${T}_m1`));
    assert.equal(reg.data().acao, "mensagem_removida");
    assert.equal(reg.data().turmaId, T);
  });
  test("admin apaga do chat da turma", async () => { await ok(apagarDaTurma("admin-1")); });
  test("aluno, representante e professor de outra turma não apagam; id de registro errado é recusado", async () => {
    await nega(apagarDaTurma("aluno-1"));
    await nega(apagarDaTurma("rep-1"));
    await nega(apagarDaTurma("prof-b"));
    await nega(apagarDaTurma("prof-a", T, "m1", "qualquer-id"));
    await nega(deleteDoc(doc(como("prof-a"), `turmas/${T}/mensagens/m1`)));
  });
  test("conversa particular: só o admin apaga; participantes não", async () => {
    await nega(apagarPrivada("prof-a"));
    await nega(apagarPrivada("aluno-1"));
    await ok(apagarPrivada("admin-1"));
    assert.equal((await getDoc(doc(como("admin-1"), `conversas/${C}/mensagens/pm1`))).exists(), false);
  });
  test("ninguém edita mensagem (nem o autor, nem o admin)", async () => {
    await nega(setDoc(doc(como("aluno-1"), `turmas/${T}/mensagens/m1`), { texto: "outra coisa" }, { merge: true }));
    await nega(setDoc(doc(como("admin-1"), `conversas/${C}/mensagens/pm1`), { texto: "outra coisa" }, { merge: true }));
  });
});

describe("administração lê os chats", () => {
  test("admin lê o chat de qualquer turma (até arquivada) e qualquer conversa particular", async () => {
    await ok(mensagens("admin-1", "turmas/turma-b/mensagens"));
    await ok(mensagens("admin-1", "turmas/turma-arq/mensagens"));
    await ok(mensagens("admin-1", `conversas/${C}/mensagens`));
  });
  test("admin lista todas as conversas (admin/chat-admin.js); admin não escreve mensagem", async () => {
    const todas = await ok(getDocs(collection(como("admin-1"), "conversas")));
    assert.ok(todas.docs.some(d => d.id === C));
    await nega(setDoc(doc(collection(como("admin-1"), `turmas/${T}/mensagens`)),
      { texto: "Aviso", autorUid: "admin-1", autorNome: NOMES["admin-1"], autorPapel: "professor", criadoEm: agora() }));
    await nega(enviarPrivada("admin-1"));
  });
});

describe("não lidas: marcar como lida por conversa (usuarios/{uid}/leituras)", () => {
  test("cada pessoa marca as próprias conversas (turma e particular)", async () => {
    await ok(marcarVisto("aluno-1", [`turma_${T}_chat`]));
    await ok(marcarVisto("aluno-1", [`conversa_${C}`]));
    await ok(marcarVisto("prof-a", [`conversa_${C}`, `turma_${T}_chat`]));
    const lidas = await getDocs(collection(como("aluno-1"), "usuarios/aluno-1/leituras"));
    assert.deepEqual(lidas.docs.map(d => d.id).sort(), [`conversa_${C}`, `turma_${T}_chat`]);
  });
  test("ninguém marca nem lê as leituras de outra pessoa; chave fora do formato é recusada", async () => {
    await nega(marcarVisto("aluno-2", [`turma_${T}_chat`], "aluno-1"));
    await nega(getDocs(collection(como("prof-a"), "usuarios/aluno-1/leituras")));
    await nega(marcarVisto("aluno-1", ["qualquer_coisa"]));
    await nega(setDoc(doc(como("aluno-1"), `usuarios/aluno-1/leituras/turma_${T}_chat`), { vistoEm: Timestamp.fromMillis(Date.now() + 9e9) }));
  });
  test("depois de marcar como lida, a consulta de novas volta vazia; mensagem nova volta a contar", async () => {
    await ok(marcarVisto("aluno-2", [`turma_${T}_chat`]));
    const visto = (await getDoc(doc(como("aluno-2"), `usuarios/aluno-2/leituras/turma_${T}_chat`))).data().vistoEm.toMillis();
    const deOutros = async () => (await novas("aluno-2", `turmas/${T}/mensagens`, visto)).docs.filter(d => d.data().autorUid !== "aluno-2").length;
    assert.equal(await deOutros(), 0);
    await ok(enviarTurma("aluno-2", "aluno", T, "minha própria mensagem não conta"));
    assert.equal(await deOutros(), 0);
    await ok(enviarTurma("prof-a", "professor", T, "Aula amanhã às 19h."));
    assert.equal(await deOutros(), 1);
  });
});
