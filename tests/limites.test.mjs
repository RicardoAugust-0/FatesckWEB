// Limites de leituras que as regras podem fazer: 10 por operação simples, 20 por lote.
// Se uma regra passasse do limite, o Firestore recusaria a escrita, e estes testes falhariam.
import { describe, test } from "node:test";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { prepararTestes, como, ok, agora, registrar, lote, semRegras, ha, HORA, DIA, NOMES } from "./apoio.mjs";

prepararTestes();

const A = "turmas/turma-a/atividades";

describe("limites de leituras das regras", () => {
  test("professor desfazendo uma entrega (com registro e marca) cabe no limite", async () => {
    const db = como("prof-a"), alvo = `${A}/atv-fechada/entregas/aluno-1`;
    const entregueEm = (await getDoc(doc(db, alvo))).data().entregueEm.toMillis();
    const b = lote(db);
    b.delete(doc(db, alvo));
    b.set(doc(db, `${A}/atv-fechada/desfeitas/aluno-1`), { desfeitaEm: agora(), desfeitaPorUid: "prof-a", desfeitaPorPapel: "professor" });
    registrar(b, db, `entrega_turma-a_atv-fechada_aluno-1_${entregueEm}`, "prof-a", "entrega_desfeita", alvo, { turmaId: "turma-a" });
    await ok(b.commit());
  });

  test("aluno desfazendo dentro de 4h cabe no limite", async () => {
    const db = como("aluno-2"), b = lote(db);
    b.delete(doc(db, `${A}/atv-aberta/entregas/aluno-2`));
    b.set(doc(db, `${A}/atv-aberta/desfeitas/aluno-2`), { desfeitaEm: agora(), desfeitaPorUid: "aluno-2", desfeitaPorPapel: "aluno" });
    await ok(b.commit());
  });

  test("aluno lendo nota de atividade (pior caso: entrega + marca 'desfeita' existentes) cabe no limite de 10", async () => {
    await semRegras(async db => {
      const b = writeBatch(db);
      b.update(doc(db, `${A}/atv-aberta/entregas/aluno-2`), { entregueEm: ha(6 * HORA) });
      b.set(doc(db, `${A}/atv-aberta/desfeitas/aluno-2`), { desfeitaEm: ha(DIA), desfeitaPorUid: "aluno-2", desfeitaPorPapel: "aluno" });
      await b.commit();
    });
    await ok(getDoc(doc(como("aluno-2"), "turmas/turma-a/notas/atv_atv-aberta/itens/aluno-2")));
  });

  test("apagar uma atividade com 35 entregas num único lote cabe no limite de 20", async () => {
    await semRegras(async db => {
      const b = writeBatch(db);
      for (let i = 0; i < 35; i++) {
        const uid = `aluno-extra-${i}`;
        b.set(doc(db, `${A}/atv-aberta/entregas/${uid}`), { texto: "x", entregueEm: ha(2 * DIA), atrasada: false, alunoUid: uid, alunoNome: "Aluno " + i, corrigida: false });
      }
      await b.commit();
    });
    const db = como("prof-a"), b = lote(db);
    for (let i = 0; i < 35; i++) b.delete(doc(db, `${A}/atv-aberta/entregas/aluno-extra-${i}`));
    b.delete(doc(db, `${A}/atv-aberta/entregas/aluno-2`));
    b.delete(doc(db, `${A}/atv-aberta`));
    await ok(b.commit());
  });

  test("professor lançando 35 notas num único lote cabe no limite", async () => {
    const db = como("prof-a"), b = lote(db);
    for (let i = 0; i < 35; i++) b.set(doc(db, `turmas/turma-a/notas/prova1/itens/aluno-extra-${i}`), { valor: 7.5, atualizadoEm: agora() });
    await ok(b.commit());
  });

  test("aprovar um pedido de entrada (membro + apagar pedido + registro) cabe no limite", async () => {
    await semRegras(async db => {
      await setDoc(doc(db, "turmas/turma-a/pedidos/aluno-sem"), { uid: "aluno-sem", nome: NOMES["aluno-sem"], turmaNome: "Turma turma-a",
        turmaCor: "#A61C24", codigo: "ABCD2345", status: "pendente", pedidoEm: ha(DIA) });
    });
    const db = como("prof-a"), b = lote(db), alvo = "turmas/turma-a/membros/aluno-sem";
    b.set(doc(db, alvo), { uid: "aluno-sem", nome: NOMES["aluno-sem"], papel: "aluno", entrouEm: agora(), aprovadoPor: "prof-a", auditoriaId: "reg-ap" });
    b.delete(doc(db, "turmas/turma-a/pedidos/aluno-sem"));
    registrar(b, db, "reg-ap", "prof-a", "aluno_aprovado", alvo, { turmaId: "turma-a" });
    await ok(b.commit());
  });

  test("criar turma (turma + código + membro) cabe no limite", async () => {
    const db = como("prof-b"), b = lote(db);
    b.set(doc(db, "turmas/turma-nova"), { nome: "Redes", cor: "#1F7A66", codigo: "QRST2345", arquivada: false, criadoPor: "prof-b", criadoEm: agora() });
    b.set(doc(db, "codigos/QRST2345"), { turmaId: "turma-nova", arquivada: false, nome: "Redes", cor: "#1F7A66" });
    b.set(doc(db, "turmas/turma-nova/membros/prof-b"), { uid: "prof-b", nome: NOMES["prof-b"], papel: "professor", entrouEm: agora() });
    await ok(b.commit());
  });
});
