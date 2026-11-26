// Fase 6: as escritas de notas montadas EXATAMENTE como em js/notas.js, conferidas contra as regras.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { doc, getDoc, setDoc, updateDoc, deleteField, collection } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote } from "./apoio.mjs";

prepararTestes();

const T = "turma-a", N = `turmas/${T}/notas`;
const folhaAtv = (atividadeId, extra = {}) => ({ titulo: "Atividade " + atividadeId, notaMax: 10, atividadeId, publicada: false, autorUid: "prof-a", criadoEm: agora(), ...extra });

describe("folha avulsa (Nova folha de notas)", () => {
  test("cria com id automático; id 'atv_...' sem atividade é recusado", async () => {
    const db = como("prof-a");
    await ok(setDoc(doc(collection(db, N)), { titulo: "Prova 2", notaMax: 7.5, publicada: false, autorUid: "prof-a", criadoEm: agora() }));
    await nega(setDoc(doc(db, `${N}/atv_qualquer`), { titulo: "X", notaMax: 10, publicada: false, autorUid: "prof-a", criadoEm: agora() }));
  });
});

describe("folha da atividade: criada antes das notas", () => {
  test("folha atv_{id} sozinha, depois as notas: aceito", async () => {
    const db = como("prof-a");
    await ok(setDoc(doc(db, `${N}/atv_atv-atrasada`), folhaAtv("atv-atrasada")));
    const b = lote(db);
    b.set(doc(db, `${N}/atv_atv-atrasada/itens/aluno-1`), { valor: 8.5, comentario: "Bom", atualizadoEm: agora() });
    b.set(doc(db, `${N}/atv_atv-atrasada/itens/aluno-2`), { valor: 6, atualizadoEm: agora() });
    await ok(b.commit());
  });
  test("folha e notas no MESMO lote: recusado (por isso o site grava a folha primeiro)", async () => {
    const db = como("prof-a"), b = lote(db);
    b.set(doc(db, `${N}/atv_atv-atrasada`), folhaAtv("atv-atrasada"));
    b.set(doc(db, `${N}/atv_atv-atrasada/itens/aluno-1`), { valor: 8, atualizadoEm: agora() });
    await nega(b.commit());
  });
  test("título longo cortado em 80 caracteres é aceito; 81 não", async () => {
    const db = como("prof-a");
    await nega(setDoc(doc(db, `${N}/atv_atv-atrasada`), folhaAtv("atv-atrasada", { titulo: "x".repeat(81) })));
    await ok(setDoc(doc(db, `${N}/atv_atv-atrasada`), folhaAtv("atv-atrasada", { titulo: "x".repeat(79) + "…" })));
  });
});

describe("Salvar (um lote com criar, mudar e apagar notas)", () => {
  test("mistura de set com/sem comentário e delete num lote só", async () => {
    const db = como("prof-a"), b = lote(db);
    b.set(doc(db, `${N}/rascunho/itens/aluno-1`), { valor: 9, atualizadoEm: agora() });          // mudou (tirou o comentário)
    b.set(doc(db, `${N}/rascunho/itens/aluno-2`), { valor: 7.25, comentario: "Rever junções.", atualizadoEm: agora() });
    b.delete(doc(db, `${N}/prova1/itens/aluno-2`));                                              // campo apagado = nota apagada
    await ok(b.commit());
  });
  test("nota acima da nota máxima é recusada; subir a nota máxima ANTES deixa gravar", async () => {
    const db = como("prof-a");
    await nega(setDoc(doc(db, `${N}/rascunho/itens/aluno-1`), { valor: 12, atualizadoEm: agora() }));
    await ok(updateDoc(doc(db, `${N}/rascunho`), { titulo: "Notas rascunho", notaMax: 12 }));
    await ok(setDoc(doc(db, `${N}/rascunho/itens/aluno-1`), { valor: 12, atualizadoEm: agora() }));
  });
  test("outro professor e aluno não salvam notas", async () => {
    await nega(setDoc(doc(como("prof-b"), `${N}/rascunho/itens/aluno-1`), { valor: 5, atualizadoEm: agora() }));
    await nega(setDoc(doc(como("aluno-1"), `${N}/rascunho/itens/aluno-1`), { valor: 10, atualizadoEm: agora() }));
  });
  test("35 notas num lote (turma cheia) cabem no limite", async () => {
    const db = como("prof-a"), b = lote(db);
    for (let i = 0; i < 35; i++) b.set(doc(db, `${N}/rascunho/itens/aluno-extra-${i}`), { valor: i % 11, atualizadoEm: agora() });
    await ok(b.commit());
  });
});

describe("Publicar / Despublicar", () => {
  test("publicar: publicada + publicadaEm do servidor", async () => {
    await ok(updateDoc(doc(como("prof-a"), `${N}/rascunho`), { publicada: true, publicadaEm: agora() }));
    await ok(getDoc(doc(como("aluno-1"), `${N}/rascunho/itens/aluno-1`)));
  });
  test("despublicar: apaga publicadaEm + registro no mesmo lote; sem registro é recusado", async () => {
    const db = como("prof-a");
    await nega(updateDoc(doc(db, `${N}/prova1`), { publicada: false, publicadaEm: deleteField() }));
    const b = lote(db);
    b.update(doc(db, `${N}/prova1`), { publicada: false, publicadaEm: deleteField(), auditoriaId: "reg-desp" });
    registrar(b, db, "reg-desp", "prof-a", "notas_despublicadas", `${N}/prova1`, { turmaId: T });
    await ok(b.commit());
    await nega(getDoc(doc(como("aluno-1"), `${N}/prova1/itens/aluno-1`)));
  });
});

describe("aluno: a página Notas", () => {
  test("folha publicada sem nota do aluno: a leitura volta vazia (o site trata como 'sem nota' e não mostra)", async () => {
    const vazio = await ok(getDoc(doc(como("rep-1"), `${N}/prova1/itens/rep-1`)));
    assert.equal(vazio.exists(), false);
    const s = await ok(getDoc(doc(como("aluno-1"), `${N}/prova1/itens/aluno-1`)));
    assert.equal(s.data().valor, 8);
  });
});

// ---------- correções aprovadas depois da Fase 6 ----------
import { getDocs, Timestamp } from "firebase/firestore";
import { semRegras, ha, DIA } from "./apoio.mjs";

// Lote igual a apagarFolha() de js/notas.js: apaga as notas + a folha + registro "notas_apagadas" de id fixo.
async function apagarFolhaComo(quem, folhaId, { turma = T, comRegistro = true, itens } = {}) {
  const base = `turmas/${turma}/notas/${folhaId}`;
  let criadoEm, ids = itens;
  await semRegras(async db => {
    criadoEm = (await getDoc(doc(db, base))).data().criadoEm.toMillis();
    if (!ids) ids = (await getDocs(collection(db, `${base}/itens`))).docs.map(d => d.id);
  });
  const db = como(quem), b = lote(db);
  for (const id of ids) b.delete(doc(db, `${base}/itens/${id}`));
  b.delete(doc(db, base));
  if (comRegistro) registrar(b, db, `folha_apagada_${turma}_${folhaId}_${criadoEm}`, quem, "notas_apagadas", base, { turmaId: turma });
  return b.commit();
}

describe("apagar folha: só RASCUNHO, autor ou admin, com registro", () => {
  test("autor apaga o rascunho com as notas; a folha e as notas somem", async () => {
    await ok(apagarFolhaComo("prof-a", "rascunho"));
    await semRegras(async db => {
      assert.equal((await getDoc(doc(db, `${N}/rascunho`))).exists(), false);
      assert.equal((await getDocs(collection(db, `${N}/rascunho/itens`))).size, 0);
    });
  });
  test("admin também apaga um rascunho", async () => {
    await ok(apagarFolhaComo("admin-1", "rascunho"));
  });
  test("sem registro: recusado", async () => {
    await nega(apagarFolhaComo("prof-a", "rascunho", { comRegistro: false }));
  });
  test("folha PUBLICADA nunca é apagada (nem pelo autor, nem pelo admin)", async () => {
    await nega(apagarFolhaComo("prof-a", "prova1"));
    await nega(apagarFolhaComo("admin-1", "prova1"));
  });
  test("outro professor e aluno não apagam", async () => {
    await nega(apagarFolhaComo("prof-b", "rascunho"));
    await nega(apagarFolhaComo("aluno-1", "rascunho"));
  });
  test("turma arquivada: não apaga", async () => {
    await semRegras(async db => {
      await setDoc(doc(db, "turmas/turma-arq/notas/rasc-arq"), { titulo: "R", notaMax: 10, publicada: false, autorUid: "prof-a", criadoEm: ha(DIA) });
    });
    await nega(apagarFolhaComo("prof-a", "rasc-arq", { turma: "turma-arq" }));
  });
  test("rascunho com 35 notas apagado num lote só cabe no limite", async () => {
    await semRegras(async db => {
      for (let i = 0; i < 35; i++) await setDoc(doc(db, `${N}/rascunho/itens/aluno-extra-${i}`), { valor: 5, atualizadoEm: Timestamp.now() });
    });
    await ok(apagarFolhaComo("prof-a", "rascunho"));
  });
  test("depois de apagado, a folha de atividade pode ser criada de novo (mesmo id)", async () => {
    const db = como("prof-a");
    await ok(setDoc(doc(db, `${N}/atv_atv-atrasada`), folhaAtv("atv-atrasada")));
    await ok(apagarFolhaComo("prof-a", "atv_atv-atrasada"));
    await ok(setDoc(doc(db, `${N}/atv_atv-atrasada`), folhaAtv("atv-atrasada")));
  });
});

describe("admin despublica (botão na administração)", () => {
  test("com registro: aceito; o aluno deixa de ver", async () => {
    const db = como("admin-1"), b = lote(db);
    b.update(doc(db, `${N}/prova1`), { publicada: false, publicadaEm: deleteField(), auditoriaId: "reg-adm-desp" });
    registrar(b, db, "reg-adm-desp", "admin-1", "notas_despublicadas", `${N}/prova1`, { turmaId: T });
    await ok(b.commit());
    await nega(getDoc(doc(como("aluno-1"), `${N}/prova1/itens/aluno-1`)));
  });
  test("sem registro: recusado", async () => {
    await nega(updateDoc(doc(como("admin-1"), `${N}/prova1`), { publicada: false, publicadaEm: deleteField() }));
  });
});
