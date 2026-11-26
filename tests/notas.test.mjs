// Notas: rascunho x publicada, despublicar com registro, quem lê o quê,
// e a regra de visibilidade das notas ligadas a uma atividade (4h da entrega + marca "entrega desfeita").
import { describe, test } from "node:test";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, Timestamp, deleteField } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, registrar, lote, NOMES, semRegras, ha, HORA } from "./apoio.mjs";

prepararTestes();

const N = "turmas/turma-a/notas";
const item = (valor, extra = {}) => ({ valor, atualizadoEm: agora(), ...extra });
const folhaNova = (extra = {}) => ({ titulo: "Prova 2", notaMax: 10, publicada: false, autorUid: "prof-a", criadoEm: agora(), ...extra });

// O aluno desfaz a entrega (apaga + marca "desfeita"), como o site fará.
function alunoDesfaz(aluno, atv) {
  const db = como(aluno), b = lote(db);
  b.delete(doc(db, `turmas/turma-a/atividades/${atv}/entregas/${aluno}`));
  b.set(doc(db, `turmas/turma-a/atividades/${atv}/desfeitas/${aluno}`), { desfeitaEm: agora(), desfeitaPorUid: aluno, desfeitaPorPapel: "aluno" });
  return b.commit();
}

describe("aluno: só as próprias notas publicadas", () => {
  test("lê a folha publicada e a própria nota", async () => {
    const db = como("aluno-1");
    await ok(getDoc(doc(db, `${N}/prova1`)));
    await ok(getDoc(doc(db, `${N}/prova1/itens/aluno-1`)));
  });
  test("não lê a nota de um colega nem lista as notas da folha", async () => {
    const db = como("aluno-1");
    await nega(getDoc(doc(db, `${N}/prova1/itens/aluno-2`)));
    await nega(getDocs(collection(db, `${N}/prova1/itens`)));
  });
  test("não lê rascunho (nem a folha, nem a própria nota)", async () => {
    const db = como("aluno-1");
    await nega(getDoc(doc(db, `${N}/rascunho`)));
    await nega(getDoc(doc(db, `${N}/rascunho/itens/aluno-1`)));
  });
  test("consulta precisa filtrar publicadas; sem filtro é recusada", async () => {
    const db = como("aluno-1");
    await ok(getDocs(query(collection(db, N), where("publicada", "==", true))));
    await nega(getDocs(collection(db, N)));
  });
  test("aluno nunca escreve nem apaga nota (nem a própria)", async () => {
    const db = como("aluno-1");
    await nega(setDoc(doc(db, `${N}/prova1/itens/aluno-1`), item(10)));
    await nega(updateDoc(doc(db, `${N}/prova1/itens/aluno-1`), { valor: 10, atualizadoEm: agora() }));
    await nega(deleteDoc(doc(db, `${N}/prova1/itens/aluno-1`)));
    await nega(setDoc(doc(db, `${N}/nova`), folhaNova({ autorUid: "aluno-1" })));
  });
  test("aluno de outra turma não lê", async () => {
    await nega(getDoc(doc(como("aluno-3"), `${N}/prova1`)));
    await nega(getDoc(doc(como("aluno-3"), `${N}/prova1/itens/aluno-3`)));
  });
});

describe("professor e admin", () => {
  test("professor lê todas as notas da turma (inclusive rascunho); admin lê tudo", async () => {
    await ok(getDocs(collection(como("prof-a"), N)));
    await ok(getDocs(collection(como("prof-a"), `${N}/rascunho/itens`)));
    await ok(getDocs(collection(como("admin-1"), `${N}/prova1/itens`)));
    await ok(getDocs(collection(como("admin-1"), "turmas/turma-b/notas/prova-b/itens")));
  });
  test("professor de outra turma não lê nem escreve", async () => {
    await nega(getDocs(collection(como("prof-b"), `${N}/prova1/itens`)));
    await nega(setDoc(doc(como("prof-b"), `${N}/prova1/itens/aluno-1`), item(1)));
  });
  test("professor cria folha (rascunho) e lança notas com decimal e comentário", async () => {
    const db = como("prof-a");
    await ok(setDoc(doc(db, `${N}/prova2`), folhaNova()));
    await ok(setDoc(doc(db, `${N}/prova2/itens/aluno-1`), item(8.5, { comentario: "Bom trabalho." })));
    await ok(setDoc(doc(db, `${N}/prova2/itens/aluno-2`), item(0)));
  });
  test("folha não nasce publicada; professor pendente não cria folha", async () => {
    await nega(setDoc(doc(como("prof-a"), `${N}/prova2`), folhaNova({ publicada: true })));
    await nega(setDoc(doc(como("prof-p"), `${N}/prova2`), folhaNova({ autorUid: "prof-p" })));
  });
  test("nota acima da nota máxima, negativa, em texto, ou com hora do aparelho: recusada", async () => {
    const db = como("prof-a");
    await nega(setDoc(doc(db, `${N}/prova1/itens/aluno-1`), item(10.5)));
    await nega(setDoc(doc(db, `${N}/prova1/itens/aluno-1`), item(-1)));
    await nega(setDoc(doc(db, `${N}/prova1/itens/aluno-1`), item("8,5")));
    await nega(setDoc(doc(db, `${N}/prova1/itens/aluno-1`), { valor: 8, atualizadoEm: Timestamp.now() }));
    await nega(setDoc(doc(db, `${N}/prova1/itens/aluno-1`), item(8, { comentario: "   " })));
  });
  test("professor lança nota a qualquer hora, sem espera (entrega feita há 1h)", async () => {
    await ok(setDoc(doc(como("prof-a"), `${N}/atv_atv-aberta/itens/aluno-2`), item(10)));
  });
  test("folha de atividade: id precisa ser 'atv_{atividade}' e a atividade precisa existir", async () => {
    const db = como("prof-a");
    await ok(setDoc(doc(db, `${N}/atv_atv-atrasada`), folhaNova({ atividadeId: "atv-atrasada" })));
    await nega(setDoc(doc(db, `${N}/outra-id`), folhaNova({ atividadeId: "atv-reaberta" })));
    await nega(setDoc(doc(db, `${N}/atv_atv-reaberta`), folhaNova()));
    await nega(setDoc(doc(db, `${N}/atv_nao-existe`), folhaNova({ atividadeId: "nao-existe" })));
  });
  test("turma arquivada: notas não mudam", async () => {
    await semRegras(async db => {
      await setDoc(doc(db, "turmas/turma-arq/notas/p1"), { titulo: "P1", notaMax: 10, publicada: false, autorUid: "prof-a", criadoEm: ha(HORA) });
    });
    await nega(setDoc(doc(como("prof-a"), "turmas/turma-arq/notas/p1/itens/aluno-1"), item(5)));
    await nega(setDoc(doc(como("prof-a"), "turmas/turma-arq/notas/p2"), folhaNova()));
  });
});

describe("publicar e despublicar", () => {
  test("professor publica (hora do servidor) e o aluno passa a ver", async () => {
    await ok(updateDoc(doc(como("prof-a"), `${N}/rascunho`), { publicada: true, publicadaEm: agora() }));
    await ok(getDoc(doc(como("aluno-1"), `${N}/rascunho/itens/aluno-1`)));
  });
  test("despublicar sem registro é recusado", async () => {
    await nega(updateDoc(doc(como("prof-a"), `${N}/prova1`), { publicada: false, publicadaEm: deleteField() }));
  });
  test("despublicar com registro: o aluno para de ver na hora", async () => {
    const db = como("prof-a"), b = lote(db);
    b.update(doc(db, `${N}/prova1`), { publicada: false, publicadaEm: deleteField(), auditoriaId: "reg-desp" });
    registrar(b, db, "reg-desp", "prof-a", "notas_despublicadas", `${N}/prova1`, { turmaId: "turma-a" });
    await ok(b.commit());
    await nega(getDoc(doc(como("aluno-1"), `${N}/prova1/itens/aluno-1`)));
    await nega(getDoc(doc(como("aluno-1"), `${N}/prova1`)));
  });
  test("aluno e professor de outra turma não publicam", async () => {
    await nega(updateDoc(doc(como("aluno-1"), `${N}/rascunho`), { publicada: true, publicadaEm: agora() }));
    await nega(updateDoc(doc(como("prof-b"), `${N}/rascunho`), { publicada: true, publicadaEm: agora() }));
  });
});

describe("nota de atividade: espera de 4h da entrega e marca 'entrega desfeita'", () => {
  test("entrega com menos de 4h: nota publicada ainda escondida do aluno", async () => {
    await nega(getDoc(doc(como("aluno-2"), `${N}/atv_atv-aberta/itens/aluno-2`)));
  });
  test("depois de 4h da entrega: visível", async () => {
    await semRegras(async db => { await updateDoc(doc(db, "turmas/turma-a/atividades/atv-aberta/entregas/aluno-2"), { entregueEm: ha(5 * HORA) }); });
    await ok(getDoc(doc(como("aluno-2"), `${N}/atv_atv-aberta/itens/aluno-2`)));
  });
  test("aluno que não entregou vê a nota assim que publicada; entrega antiga também", async () => {
    await ok(getDoc(doc(como("aluno-1"), `${N}/atv_atv-aberta/itens/aluno-1`)));
    await ok(getDoc(doc(como("aluno-1"), `${N}/atv_atv-fechada/itens/aluno-1`)));
  });
  test("ao desfazer, a nota FICA para o professor e continua escondida do aluno", async () => {
    await ok(alunoDesfaz("aluno-2", "atv-aberta"));
    await ok(getDoc(doc(como("prof-a"), `${N}/atv_atv-aberta/itens/aluno-2`)));
    await nega(getDoc(doc(como("aluno-2"), `${N}/atv_atv-aberta/itens/aluno-2`)));
  });
  test("a nota fica escondida mesmo muito depois do desfazer, até o professor editar", async () => {
    await ok(alunoDesfaz("aluno-2", "atv-aberta"));
    await semRegras(async db => { // simula que o desfazer foi há 2 dias (nota editada antes disso)
      await updateDoc(doc(db, "turmas/turma-a/atividades/atv-aberta/desfeitas/aluno-2"), { desfeitaEm: ha(2 * 24 * HORA) });
      await updateDoc(doc(db, `${N}/atv_atv-aberta/itens/aluno-2`), { atualizadoEm: ha(3 * 24 * HORA) });
    });
    await nega(getDoc(doc(como("aluno-2"), `${N}/atv_atv-aberta/itens/aluno-2`)));
  });
  test("depois que o professor edita a nota, o aluno volta a ver", async () => {
    await ok(alunoDesfaz("aluno-2", "atv-aberta"));
    await ok(updateDoc(doc(como("prof-a"), `${N}/atv_atv-aberta/itens/aluno-2`), { valor: 0, atualizadoEm: agora() }));
    await ok(getDoc(doc(como("aluno-2"), `${N}/atv_atv-aberta/itens/aluno-2`)));
  });
  test("professor pode apagar a nota da entrega desfeita", async () => {
    await ok(alunoDesfaz("aluno-2", "atv-aberta"));
    await ok(deleteDoc(doc(como("prof-a"), `${N}/atv_atv-aberta/itens/aluno-2`)));
  });
  test("se o aluno entregar de novo, a espera de 4h recomeça", async () => {
    await ok(alunoDesfaz("aluno-2", "atv-aberta"));
    await ok(updateDoc(doc(como("prof-a"), `${N}/atv_atv-aberta/itens/aluno-2`), { valor: 6, atualizadoEm: agora() }));
    await ok(setDoc(doc(como("aluno-2"), "turmas/turma-a/atividades/atv-aberta/entregas/aluno-2"),
      { texto: "Nova versão", entregueEm: agora(), atrasada: false, alunoUid: "aluno-2", alunoNome: NOMES["aluno-2"], corrigida: false }));
    await nega(getDoc(doc(como("aluno-2"), `${N}/atv_atv-aberta/itens/aluno-2`)));
  });
  test("o aluno não consegue apagar a própria nota junto com o desfazer", async () => {
    const db = como("aluno-2"), b = lote(db);
    b.delete(doc(db, "turmas/turma-a/atividades/atv-aberta/entregas/aluno-2"));
    b.set(doc(db, "turmas/turma-a/atividades/atv-aberta/desfeitas/aluno-2"), { desfeitaEm: agora(), desfeitaPorUid: "aluno-2", desfeitaPorPapel: "aluno" });
    b.delete(doc(db, `${N}/atv_atv-aberta/itens/aluno-2`));
    await nega(b.commit());
  });
});
