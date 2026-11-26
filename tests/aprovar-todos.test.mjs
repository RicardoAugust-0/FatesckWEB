// "Aprovar todos": os lotes montados exatamente como em js/turmas.js (aprovarTodos), com 35 pedidos pendentes.
// Cada aprovação = membro + apagar pedido + 1 registro "aluno_aprovado"; 5 aprovações por lote (APROVACOES_POR_LOTE).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { doc, getDoc, getDocs, collection, query, where, writeBatch, deleteDoc } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, semRegras, ha, DIA, setDoc } from "./apoio.mjs";

prepararTestes();

const POR_LOTE = 5, TOTAL = 35, T = "turma-a";
const uidDe = i => `pedinte-${String(i).padStart(2, "0")}`;
const nomeDe = i => `Aluno Pedinte ${i}`;

async function criarPedidos(n = TOTAL, turma = T, codigo = "ABCD2345") {
  await semRegras(async db => {
    const b = writeBatch(db);
    for (let i = 0; i < n; i++) {
      b.set(doc(db, `usuarios/${uidDe(i)}`), { nome: nomeDe(i), email: `${uidDe(i)}@aluno.cps.sp.gov.br`, perfil: "aluno", status: "ativo", criadoEm: ha(DIA) });
      b.set(doc(db, `turmas/${turma}/pedidos/${uidDe(i)}`), { uid: uidDe(i), nome: nomeDe(i), turmaNome: "Turma " + turma,
        turmaCor: "#A61C24", codigo, status: "pendente", pedidoEm: ha(DIA) });
    }
    await b.commit();
  });
}

// Um lote de aprovações (mesma composição do cliente).
function loteDeAprovacoes(quem, indices, turma = T, sufixo = "") {
  const db = como(quem), b = lote(db);
  for (const i of indices) {
    const alvo = `turmas/${turma}/membros/${uidDe(i)}`, regId = `reg-todos-${quem}-${i}${sufixo}`;
    b.set(doc(db, alvo), { uid: uidDe(i), nome: nomeDe(i), papel: "aluno", entrouEm: agora(), aprovadoPor: quem, auditoriaId: regId });
    b.delete(doc(db, `turmas/${turma}/pedidos/${uidDe(i)}`));
    registrar(b, db, regId, quem, "aluno_aprovado", alvo, { turmaId: turma });
  }
  return b.commit();
}
const faixa = (de, ate) => Array.from({ length: ate - de }, (_, k) => de + k);

async function conferirTudoAprovado(quem) {
  await semRegras(async db => {
    const membros = await getDocs(query(collection(db, `turmas/${T}/membros`), where("papel", "==", "aluno")));
    const novos = membros.docs.filter(d => d.id.startsWith("pedinte-"));
    assert.equal(novos.length, TOTAL, "todos os 35 viraram alunos da turma");
    assert.ok(novos.every(d => d.data().aprovadoPor === quem));
    const pedidos = await getDocs(collection(db, `turmas/${T}/pedidos`));
    assert.equal(pedidos.size, 0, "nenhum pedido sobrou");
    const regs = await getDocs(query(collection(db, "auditoria"), where("acao", "==", "aluno_aprovado")));
    assert.equal(regs.size, TOTAL, "um registro por aluno aprovado");
    assert.equal(new Set(regs.docs.map(d => d.data().alvo)).size, TOTAL, "cada registro aponta para um aluno diferente");
  });
}

describe("Aprovar todos (35 pedidos, lotes de 5)", () => {
  test("professor da turma aprova os 35 em 7 lotes; 35 registros na auditoria", async () => {
    await criarPedidos();
    for (let i = 0; i < TOTAL; i += POR_LOTE) await ok(loteDeAprovacoes("prof-a", faixa(i, Math.min(i + POR_LOTE, TOTAL))));
    await conferirTudoAprovado("prof-a");
  });

  test("admin aprova os 35 em 7 lotes", async () => {
    await criarPedidos();
    for (let i = 0; i < TOTAL; i += POR_LOTE) await ok(loteDeAprovacoes("admin-1", faixa(i, Math.min(i + POR_LOTE, TOTAL))));
    await conferirTudoAprovado("admin-1");
  });

  test("um lote de 5 cabe no limite de leituras com folga (professor e admin)", async () => {
    await criarPedidos(10);
    await ok(loteDeAprovacoes("prof-a", faixa(0, 5)));
    await ok(loteDeAprovacoes("admin-1", faixa(5, 10)));
  });

  test("professor de outra turma, professor pendente e aluno não aprovam em lote", async () => {
    await criarPedidos(5);
    await nega(loteDeAprovacoes("prof-b", faixa(0, 5)));
    await nega(loteDeAprovacoes("prof-p", faixa(0, 5)));
    await nega(loteDeAprovacoes("aluno-1", faixa(0, 5)));
  });

  test("turma arquivada: nenhum lote passa", async () => {
    await criarPedidos(5, "turma-arq", "CDEF4567");
    await nega(loteDeAprovacoes("prof-a", faixa(0, 5), "turma-arq"));
  });

  test("falha no meio: lote com um pedido cancelado é recusado inteiro; lotes anteriores ficam; o resto aprova um por um", async () => {
    await criarPedidos(15);
    await ok(loteDeAprovacoes("prof-a", faixa(0, 5)));                       // 1º lote: ok
    await ok(deleteDoc(doc(como(uidDe(7)), `turmas/${T}/pedidos/${uidDe(7)}`))); // aluno 7 cancela no meio-tempo
    await nega(loteDeAprovacoes("prof-a", faixa(5, 10)));                    // 2º lote recusado (tudo ou nada)
    await semRegras(async db => {
      // nada do 2º lote foi gravado; o 1º continua valendo
      for (const i of faixa(5, 10)) assert.equal((await getDoc(doc(db, `turmas/${T}/membros/${uidDe(i)}`))).exists(), false);
      for (const i of faixa(0, 5)) assert.equal((await getDoc(doc(db, `turmas/${T}/membros/${uidDe(i)}`))).exists(), true);
    });
    // o cliente tenta um por um: só o aluno 7 fica de fora
    for (const i of faixa(5, 10)) {
      if (i === 7) await nega(loteDeAprovacoes("prof-a", [i]));
      else await ok(loteDeAprovacoes("prof-a", [i]));
    }
    await ok(loteDeAprovacoes("prof-a", faixa(10, 15)));                     // 3º lote: ok
    await semRegras(async db => {
      const regs = await getDocs(query(collection(db, "auditoria"), where("acao", "==", "aluno_aprovado")));
      assert.equal(regs.size, 14, "14 aprovados, 14 registros (sem registro do que falhou)");
      const pedidos = await getDocs(collection(db, `turmas/${T}/pedidos`));
      assert.equal(pedidos.size, 0);
    });
  });

  test("clicar de novo depois de uma falha não duplica: pedido já aprovado não é aprovado outra vez", async () => {
    await criarPedidos(5);
    await ok(loteDeAprovacoes("prof-a", faixa(0, 5)));
    await nega(loteDeAprovacoes("prof-a", [0], T, "-de-novo")); // registro novo, mas o pedido já não existe
  });
});
