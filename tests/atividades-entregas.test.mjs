// Atividades, entregas (uma por aluno), prazos de 24h, reabrir/estender, desfazer em 4h e correção.
import { describe, test } from "node:test";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, Timestamp, deleteField
} from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, NOMES, semRegras, em, ha, HORA, DIA } from "./apoio.mjs";

prepararTestes();

const A = "turmas/turma-a/atividades";
const limpo = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)); // o SDK não aceita undefined
const novaAtividade = (extra = {}) => limpo({ titulo: "Lista 4", prazo: em(2 * DIA), notaMax: 10, autorUid: "prof-a", criadoEm: agora(), ...extra });
const entrega = (uid, extra = {}) => limpo({
  texto: "Resposta", entregueEm: agora(), atrasada: false, alunoUid: uid, alunoNome: NOMES[uid], corrigida: false, ...extra
});
const entregar = (uid, atv, extra, turma = "turma-a") =>
  setDoc(doc(como(uid), `turmas/${turma}/atividades/${atv}/entregas/${uid}`), entrega(uid, extra));

// Desfazer como o site fará: apaga a entrega e grava a marca "desfeita" (e o registro, se for professor/admin).
async function desfazer(uid, atv, aluno, { papel, comMarca = true, comRegistro = true } = {}) {
  const db = como(uid), b = lote(db);
  const alvo = `${A}/${atv}/entregas/${aluno}`;
  let entregueEm = null;
  if (papel !== "aluno") entregueEm = (await getDoc(doc(db, alvo))).data().entregueEm.toMillis();
  b.delete(doc(db, alvo));
  if (comMarca) b.set(doc(db, `${A}/${atv}/desfeitas/${aluno}`), { desfeitaEm: agora(), desfeitaPorUid: uid, desfeitaPorPapel: papel });
  if (papel !== "aluno" && comRegistro)
    registrar(b, db, `entrega_turma-a_${atv}_${aluno}_${entregueEm}`, uid, "entrega_desfeita", alvo, { turmaId: "turma-a" });
  return b.commit();
}

describe("atividades", () => {
  test("professor da turma cria atividade", async () => {
    await ok(setDoc(doc(como("prof-a"), `${A}/nova`), novaAtividade()));
    await ok(setDoc(doc(como("prof-a"), `${A}/sem-nota`), novaAtividade({ notaMax: undefined, descricao: "Leia o capítulo 3." })));
  });
  test("título só com espaços, prazo em texto, notaMax inválida ou campo extra: recusado", async () => {
    const db = como("prof-a");
    await nega(setDoc(doc(db, `${A}/x`), novaAtividade({ titulo: "    " })));
    await nega(setDoc(doc(db, `${A}/x`), novaAtividade({ prazo: "2026-11-20" })));
    await nega(setDoc(doc(db, `${A}/x`), novaAtividade({ notaMax: 0 })));
    await nega(setDoc(doc(db, `${A}/x`), novaAtividade({ status: "aberta" })));
    await nega(setDoc(doc(db, `${A}/x`), novaAtividade({ reabertaAte: em(DIA) })));
  });
  test("professor pendente, aluno, professor de outra turma e autor falso: recusado", async () => {
    await nega(setDoc(doc(como("prof-p"), `${A}/x`), novaAtividade({ autorUid: "prof-p" })));
    await nega(setDoc(doc(como("aluno-1"), `${A}/x`), novaAtividade({ autorUid: "aluno-1" })));
    await nega(setDoc(doc(como("prof-b"), `${A}/x`), novaAtividade({ autorUid: "prof-b" })));
    await nega(setDoc(doc(como("prof-a"), `${A}/x`), novaAtividade({ autorUid: "prof-b" })));
  });
  test("turma arquivada não recebe atividade", async () => {
    await nega(setDoc(doc(como("prof-a"), "turmas/turma-arq/atividades/x"), novaAtividade()));
  });
  test("autor edita título; outro professor da turma (não autor) não edita", async () => {
    await ok(updateDoc(doc(como("prof-a"), `${A}/atv-aberta`), { titulo: "Lista 3 (revisada)", atualizadoEm: agora() }));
    await semRegras(async db => {
      await setDoc(doc(db, "turmas/turma-a/membros/prof-b"), { uid: "prof-b", nome: NOMES["prof-b"], papel: "professor", entrouEm: ha(DIA) });
    });
    await nega(updateDoc(doc(como("prof-b"), `${A}/atv-aberta`), { titulo: "Mudança", atualizadoEm: agora() }));
    await ok(updateDoc(doc(como("admin-1"), `${A}/atv-aberta`), { titulo: "Pelo admin", atualizadoEm: agora() }));
  });

  const estender = (uid, atv, campo, valor, { acao, regId = "reg-prazo", comRegistro = true } = {}) => {
    const db = como(uid), b = lote(db), alvo = `${A}/${atv}`;
    b.update(doc(db, alvo), { [campo]: valor, atualizadoEm: agora(), auditoriaId: regId });
    if (comRegistro) registrar(b, db, regId, uid, acao ?? (campo === "prazo" ? "prazo_alterado" : "entrega_reaberta"), alvo, { turmaId: "turma-a" });
    return b.commit();
  };
  test("estender prazo exige registro; com registro é aceito", async () => {
    await nega(estender("prof-a", "atv-fechada", "prazo", em(DIA), { comRegistro: false }));
    await nega(estender("prof-a", "atv-fechada", "prazo", em(DIA), { acao: "entrega_reaberta" }));
    await nega(estender("prof-a", "atv-fechada", "prazo", em(DIA), { comRegistro: false, regId: "reg-1" })); // registro antigo
    await ok(estender("prof-a", "atv-fechada", "prazo", em(DIA)));
  });
  test("reabrir entrega exige registro 'entrega_reaberta'", async () => {
    await nega(estender("prof-a", "atv-fechada", "reabertaAte", em(5 * HORA), { comRegistro: false }));
    await ok(estender("prof-a", "atv-fechada", "reabertaAte", em(5 * HORA)));
  });
  test("apagar atividade apaga as entregas no mesmo lote (autor)", async () => {
    const db = como("prof-a"), b = lote(db);
    b.delete(doc(db, `${A}/atv-aberta/entregas/aluno-2`));
    b.delete(doc(db, `${A}/atv-aberta`));
    await ok(b.commit());
  });
  test("aluno não apaga atividade; professor não apaga entrega 'em cascata' sem apagar a atividade", async () => {
    await nega(deleteDoc(doc(como("aluno-1"), `${A}/atv-aberta`)));
    await nega(deleteDoc(doc(como("prof-a"), `${A}/atv-aberta/entregas/aluno-2`)));
  });
});

describe("entregar", () => {
  test("aluno entrega antes do prazo (atrasada = false)", async () => {
    await ok(entregar("aluno-1", "atv-aberta"));
  });
  test("só link, ou texto + link, também valem", async () => {
    await ok(entregar("aluno-1", "atv-aberta", { texto: undefined, link: "https://exemplo.com/trabalho" }));
  });
  test("uma por aluno: segunda entrega (clique duplo / outra aba) é recusada", async () => {
    await nega(entregar("aluno-2", "atv-aberta"));
  });
  test("entregueEm com a hora do aparelho é recusado", async () => {
    await nega(entregar("aluno-1", "atv-aberta", { entregueEm: Timestamp.now() }));
  });
  test("aluno não entrega por outro; nome diferente do perfil é recusado", async () => {
    await nega(setDoc(doc(como("aluno-1"), `${A}/atv-aberta/entregas/rep-1`), entrega("rep-1")));
    await nega(entregar("aluno-1", "atv-aberta", { alunoNome: "Outro Nome" }));
    await nega(entregar("aluno-1", "atv-aberta", { alunoUid: "aluno-2" }));
  });
  test("aluno de outra turma, professor e aluno sem turma não entregam", async () => {
    await nega(entregar("aluno-3", "atv-aberta"));
    await nega(entregar("aluno-sem", "atv-aberta"));
    await nega(setDoc(doc(como("prof-a"), `${A}/atv-aberta/entregas/prof-a`), entrega("prof-a")));
  });
  test("entrega não pode vir já 'corrigida'", async () => {
    await nega(entregar("aluno-1", "atv-aberta", { corrigida: true }));
  });
  test("link precisa ser http(s); vazio ou texto grande demais é recusado", async () => {
    await nega(entregar("aluno-1", "atv-aberta", { texto: undefined, link: "javascript:alert(1)" }));
    await nega(entregar("aluno-1", "atv-aberta", { texto: "   " }));
    await nega(entregar("aluno-1", "atv-aberta", { texto: "x".repeat(5001) }));
    await nega(setDoc(doc(como("aluno-1"), `${A}/atv-aberta/entregas/aluno-1`),
      { entregueEm: agora(), atrasada: false, alunoUid: "aluno-1", alunoNome: NOMES["aluno-1"], corrigida: false }));
  });
  test("depois do prazo: aceita até +24h e marca atrasada (a regra confere a marca)", async () => {
    await nega(entregar("aluno-1", "atv-atrasada", { atrasada: false }));
    await ok(entregar("aluno-1", "atv-atrasada", { atrasada: true }));
  });
  test("passou de 24h do prazo: recusada", async () => {
    await nega(entregar("aluno-2", "atv-fechada", { atrasada: true }));
  });
  test("reaberta pelo professor: aceita (ainda atrasada)", async () => {
    await nega(entregar("aluno-1", "atv-reaberta", { atrasada: false }));
    await ok(entregar("aluno-1", "atv-reaberta", { atrasada: true }));
  });
  test("depois que o professor estende o prazo, volta a aceitar sem atraso", async () => {
    const db = como("prof-a"), b = lote(db), alvo = `${A}/atv-fechada`;
    b.update(doc(db, alvo), { prazo: em(DIA), atualizadoEm: agora(), auditoriaId: "reg-ext" });
    registrar(b, db, "reg-ext", "prof-a", "prazo_alterado", alvo, { turmaId: "turma-a" });
    await ok(b.commit());
    await ok(entregar("aluno-2", "atv-fechada", { atrasada: false }));
  });
  test("turma arquivada não recebe entrega", async () => {
    await nega(entregar("aluno-1", "atv-arq", {}, "turma-arq"));
  });
});

describe("ler entregas", () => {
  test("aluno lê só a própria entrega; não lista as da turma", async () => {
    await ok(getDoc(doc(como("aluno-2"), `${A}/atv-aberta/entregas/aluno-2`)));
    await nega(getDoc(doc(como("aluno-1"), `${A}/atv-aberta/entregas/aluno-2`)));
    await nega(getDocs(collection(como("aluno-1"), `${A}/atv-aberta/entregas`)));
  });
  test("professor da turma e admin listam as entregas", async () => {
    await ok(getDocs(collection(como("prof-a"), `${A}/atv-aberta/entregas`)));
    await ok(getDocs(collection(como("admin-1"), `${A}/atv-aberta/entregas`)));
  });
});

describe("desfazer entrega", () => {
  test("aluno desfaz dentro de 4h (com a marca 'desfeita')", async () => {
    await ok(desfazer("aluno-2", "atv-aberta", "aluno-2", { papel: "aluno" }));
  });
  test("aluno desfaz dentro de 4h mesmo se o professor já marcou como corrigida", async () => {
    await semRegras(async db => { await updateDoc(doc(db, `${A}/atv-aberta/entregas/aluno-2`), { corrigida: true, corrigidaEm: ha(10 * 60e3) }); });
    await ok(desfazer("aluno-2", "atv-aberta", "aluno-2", { papel: "aluno" }));
  });
  test("depois de desfazer, o aluno pode entregar de novo", async () => {
    await ok(desfazer("aluno-2", "atv-aberta", "aluno-2", { papel: "aluno" }));
    await ok(entregar("aluno-2", "atv-aberta"));
  });
  test("sem gravar a marca 'desfeita' é recusado", async () => {
    await nega(desfazer("aluno-2", "atv-aberta", "aluno-2", { papel: "aluno", comMarca: false }));
  });
  test("depois de 4h o aluno não desfaz mais", async () => {
    await nega(desfazer("aluno-1", "atv-fechada", "aluno-1", { papel: "aluno" }));
  });
  test("aluno não desfaz a entrega de outro", async () => {
    await nega(desfazer("aluno-1", "atv-aberta", "aluno-2", { papel: "aluno" }));
  });
  test("aluno não finge ser professor na marca", async () => {
    await nega(desfazer("aluno-2", "atv-aberta", "aluno-2", { papel: "professor", comRegistro: false }));
  });
  test("professor (autor) desfaz a qualquer hora, com registro", async () => {
    await ok(desfazer("prof-a", "atv-fechada", "aluno-1", { papel: "professor" }));
  });
  test("professor sem registro: recusado", async () => {
    await nega(desfazer("prof-a", "atv-fechada", "aluno-1", { papel: "professor", comRegistro: false }));
  });
  test("admin desfaz a qualquer hora, com registro", async () => {
    await ok(desfazer("admin-1", "atv-fechada", "aluno-1", { papel: "admin" }));
  });
  test("professor de outra turma não desfaz", async () => {
    await nega(desfazer("prof-b", "atv-fechada", "aluno-1", { papel: "professor" }));
  });
  test("a marca 'desfeita' só pode ser gravada junto com a exclusão da entrega", async () => {
    await nega(setDoc(doc(como("aluno-2"), `${A}/atv-aberta/desfeitas/aluno-2`), { desfeitaEm: agora(), desfeitaPorUid: "aluno-2", desfeitaPorPapel: "aluno" }));
    await nega(setDoc(doc(como("aluno-1"), `${A}/atv-aberta/desfeitas/aluno-1`), { desfeitaEm: agora(), desfeitaPorUid: "aluno-1", desfeitaPorPapel: "aluno" }));
  });
  test("professor lê as marcas 'desfeita'; aluno não", async () => {
    await ok(desfazer("aluno-2", "atv-aberta", "aluno-2", { papel: "aluno" }));
    await ok(getDoc(doc(como("prof-a"), `${A}/atv-aberta/desfeitas/aluno-2`)));
    await nega(getDoc(doc(como("aluno-2"), `${A}/atv-aberta/desfeitas/aluno-2`)));
  });
});

describe("correção", () => {
  test("professor marca 'corrigida' a qualquer hora (sem espera), inclusive entrega recém-feita", async () => {
    await ok(updateDoc(doc(como("prof-a"), `${A}/atv-aberta/entregas/aluno-2`), { corrigida: true, corrigidaEm: agora() }));
  });
  test("desmarcar corrigida remove a data", async () => {
    await ok(updateDoc(doc(como("prof-a"), `${A}/atv-aberta/entregas/aluno-2`), { corrigida: true, corrigidaEm: agora() }));
    await ok(updateDoc(doc(como("prof-a"), `${A}/atv-aberta/entregas/aluno-2`), { corrigida: false, corrigidaEm: deleteField() }));
  });
  test("professor não altera o conteúdo da entrega; aluno não se corrige", async () => {
    await nega(updateDoc(doc(como("prof-a"), `${A}/atv-aberta/entregas/aluno-2`), { texto: "alterado" }));
    await nega(updateDoc(doc(como("aluno-2"), `${A}/atv-aberta/entregas/aluno-2`), { corrigida: true, corrigidaEm: agora() }));
    await nega(updateDoc(doc(como("aluno-2"), `${A}/atv-aberta/entregas/aluno-2`), { texto: "editado" }));
  });
  test("data de correção com hora do aparelho é recusada", async () => {
    await nega(updateDoc(doc(como("prof-a"), `${A}/atv-aberta/entregas/aluno-2`), { corrigida: true, corrigidaEm: Timestamp.now() }));
  });
});
