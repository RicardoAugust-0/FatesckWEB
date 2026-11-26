// Fase 5: os lotes/escritas montados EXATAMENTE como em js/atividades.js, conferidos contra as regras.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { doc, getDoc, setDoc, updateDoc, deleteField, Timestamp, collection } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, semRegras, em, ha, HORA, DIA, NOMES } from "./apoio.mjs";

prepararTestes();

const T = "turma-a", A = `turmas/${T}/atividades`;
const novaAtividade = (extra = {}) => ({ titulo: "Lista 4", prazo: em(2 * DIA), autorUid: "prof-a", criadoEm: agora(), ...extra });

describe("professor: criar e editar (janela Nova atividade / Editar)", () => {
  test("cria só com título e prazo; descrição e nota máxima são opcionais (decimal aceito)", async () => {
    const db = como("prof-a");
    await ok(setDoc(doc(collection(db, A)), novaAtividade()));
    await ok(setDoc(doc(collection(db, A)), novaAtividade({ descricao: "Capítulo 3", notaMax: 8.5 })));
  });
  test("aluno, professor de outra turma e turma arquivada: não criam", async () => {
    await nega(setDoc(doc(collection(como("aluno-1"), A)), novaAtividade({ autorUid: "aluno-1" })));
    await nega(setDoc(doc(collection(como("prof-b"), A)), novaAtividade({ autorUid: "prof-b" })));
    await nega(setDoc(doc(collection(como("prof-a"), "turmas/turma-arq/atividades")), novaAtividade()));
  });
  test("editar título/descrição/nota e APAGAR descrição e nota (campo vazio no formulário)", async () => {
    const db = como("prof-a"), ref = doc(db, `${A}/atv-aberta`);
    await ok(updateDoc(ref, { titulo: "Novo título", descricao: "Texto", notaMax: 7.5, atualizadoEm: agora() }));
    await ok(updateDoc(ref, { titulo: "Novo título", descricao: deleteField(), notaMax: deleteField(), atualizadoEm: agora() }));
  });
  test("editar não pode mudar o prazo sem registro", async () => {
    await nega(updateDoc(doc(como("prof-a"), `${A}/atv-aberta`), { prazo: em(5 * DIA), atualizadoEm: agora() }));
  });
});

describe("professor: estender prazo e reabrir entrega (com registro)", () => {
  const alvo = `${A}/atv-aberta`;
  test("estender prazo: prazo novo + registro prazo_alterado no mesmo lote", async () => {
    const db = como("prof-a"), b = lote(db);
    b.update(doc(db, alvo), { prazo: Timestamp.fromMillis(Date.now() + 9 * DIA), atualizadoEm: agora(), auditoriaId: "reg-prazo" });
    registrar(b, db, "reg-prazo", "prof-a", "prazo_alterado", alvo, { turmaId: T });
    await ok(b.commit());
  });
  test("reabrir: reabertaAte + registro entrega_reaberta; com a ação errada no registro é recusado", async () => {
    const db = como("prof-a"), alvoF = `${A}/atv-fechada`;
    let b = lote(db);
    b.update(doc(db, alvoF), { reabertaAte: em(DIA), atualizadoEm: agora(), auditoriaId: "reg-x" });
    registrar(b, db, "reg-x", "prof-a", "prazo_alterado", alvoF, { turmaId: T });
    await nega(b.commit());
    b = lote(db);
    b.update(doc(db, alvoF), { reabertaAte: em(DIA), atualizadoEm: agora(), auditoriaId: "reg-reabre" });
    registrar(b, db, "reg-reabre", "prof-a", "entrega_reaberta", alvoF, { turmaId: T });
    await ok(b.commit());
    // depois de reaberta, o aluno entrega (marcada como atrasada)
    const atrasadaDe = uid => ({ texto: "Atrasado", entregueEm: agora(), atrasada: true, alunoUid: uid, alunoNome: NOMES[uid], corrigida: false });
    await nega(setDoc(doc(como("aluno-1"), `${alvoF}/entregas/aluno-2`), atrasadaDe("aluno-2"))); // ninguém entrega por outro
    await ok(setDoc(doc(como("aluno-2"), `${alvoF}/entregas/aluno-2`),
      { texto: "Atrasado", entregueEm: agora(), atrasada: true, alunoUid: "aluno-2", alunoNome: NOMES["aluno-2"], corrigida: false }));
  });
});

describe("aluno: entregar (texto e/ou link), 'atrasada' igual ao servidor, desfazer em 4h", () => {
  const entrega = (uid, extra = {}) => ({ entregueEm: agora(), atrasada: false, alunoUid: uid, alunoNome: NOMES[uid], corrigida: false, ...extra });
  test("só texto, só link, ou os dois", async () => {
    await ok(setDoc(doc(como("aluno-1"), `${A}/atv-aberta/entregas/aluno-1`), entrega("aluno-1", { link: "https://exemplo.com/x" })));
    await ok(setDoc(doc(como("rep-1"), `${A}/atv-aberta/entregas/rep-1`), entrega("rep-1", { texto: "Resposta", link: "http://a.b/c" })));
  });
  test("sem texto e sem link, ou link sem http(s): recusado", async () => {
    await nega(setDoc(doc(como("aluno-1"), `${A}/atv-aberta/entregas/aluno-1`), entrega("aluno-1")));
    await nega(setDoc(doc(como("aluno-1"), `${A}/atv-aberta/entregas/aluno-1`), entrega("aluno-1", { link: "exemplo.com" })));
  });
  test("'atrasada' errada é recusada (o app tenta de novo com o valor certo perto do prazo)", async () => {
    await nega(setDoc(doc(como("aluno-1"), `${A}/atv-aberta/entregas/aluno-1`), entrega("aluno-1", { texto: "x", atrasada: true })));
    await nega(setDoc(doc(como("aluno-1"), `${A}/atv-atrasada/entregas/aluno-1`), entrega("aluno-1", { texto: "x", atrasada: false })));
    await ok(setDoc(doc(como("aluno-1"), `${A}/atv-atrasada/entregas/aluno-1`), entrega("aluno-1", { texto: "x", atrasada: true })));
  });
  test("depois das 24h (sem reabrir): recusado", async () => {
    await nega(setDoc(doc(como("aluno-2"), `${A}/atv-fechada/entregas/aluno-2`), entrega("aluno-2", { texto: "x", atrasada: true })));
  });
  test("desfazer dentro de 4h (apaga + marca 'desfeita' pelo aluno) e entregar de novo", async () => {
    const db = como("aluno-2"), b = lote(db);
    b.delete(doc(db, `${A}/atv-aberta/entregas/aluno-2`));
    b.set(doc(db, `${A}/atv-aberta/desfeitas/aluno-2`), { desfeitaEm: agora(), desfeitaPorUid: "aluno-2", desfeitaPorPapel: "aluno" });
    await ok(b.commit());
    await ok(setDoc(doc(db, `${A}/atv-aberta/entregas/aluno-2`), entrega("aluno-2", { texto: "Versão 2" })));
  });
  test("depois de 4h o aluno não desfaz", async () => {
    await semRegras(async db => {
      await setDoc(doc(db, `${A}/atv-aberta/entregas/aluno-1`), { texto: "x", entregueEm: ha(5 * HORA), atrasada: false, alunoUid: "aluno-1", alunoNome: NOMES["aluno-1"], corrigida: false });
    });
    const db = como("aluno-1"), b = lote(db);
    b.delete(doc(db, `${A}/atv-aberta/entregas/aluno-1`));
    b.set(doc(db, `${A}/atv-aberta/desfeitas/aluno-1`), { desfeitaEm: agora(), desfeitaPorUid: "aluno-1", desfeitaPorPapel: "aluno" });
    await nega(b.commit());
  });
});

describe("professor: corrigir e desfazer entrega", () => {
  const alvo = `${A}/atv-aberta/entregas/aluno-2`;
  test("marcar como corrigida e desmarcar (apaga corrigidaEm)", async () => {
    const db = como("prof-a");
    await ok(updateDoc(doc(db, alvo), { corrigida: true, corrigidaEm: agora() }));
    await ok(updateDoc(doc(db, alvo), { corrigida: false, corrigidaEm: deleteField() }));
  });
  test("aluno e professor de outra turma não marcam correção", async () => {
    await nega(updateDoc(doc(como("aluno-2"), alvo), { corrigida: true, corrigidaEm: agora() }));
    await nega(updateDoc(doc(como("prof-b"), alvo), { corrigida: true, corrigidaEm: agora() }));
  });
  test("desfazer entrega de aluno: id fixo do registro com a hora da entrega", async () => {
    const db = como("prof-a");
    const entregueEm = (await getDoc(doc(db, alvo))).data().entregueEm.toMillis();
    const b = lote(db);
    b.delete(doc(db, alvo));
    b.set(doc(db, `${A}/atv-aberta/desfeitas/aluno-2`), { desfeitaEm: agora(), desfeitaPorUid: "prof-a", desfeitaPorPapel: "professor" });
    registrar(b, db, `entrega_${T}_atv-aberta_aluno-2_${entregueEm}`, "prof-a", "entrega_desfeita", alvo, { turmaId: T });
    await ok(b.commit());
    // o professor vê a marca de "desfeita"; o aluno não
    await ok(getDoc(doc(db, `${A}/atv-aberta/desfeitas/aluno-2`)));
    await nega(getDoc(doc(como("aluno-2"), `${A}/atv-aberta/desfeitas/aluno-2`)));
  });
});

describe("professor: apagar atividade com as entregas (mesmo lote)", () => {
  test("autor apaga; outro professor não", async () => {
    const lotePara = uid => {
      const db = como(uid), b = lote(db);
      b.delete(doc(db, `${A}/atv-aberta/entregas/aluno-2`));
      b.delete(doc(db, `${A}/atv-aberta`));
      return b.commit();
    };
    await nega(lotePara("prof-b"));
    await ok(lotePara("prof-a"));
    await semRegras(async db => { assert.equal((await getDoc(doc(db, `${A}/atv-aberta`))).exists(), false); });
  });
});
