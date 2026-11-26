// Ações sobre notas (Fase 6). Cada escrita segue exatamente o que o firestore.rules exige.
// Folha = turmas/{t}/notas/{id} (rascunho -> publicada); uma nota por aluno em .../itens/{alunoUid}.
import { db } from "./firebase.js";
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, writeBatch, serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { novoId, registro } from "./turmas.js";
import { idFolhaDaAtividade, tituloDaFolha } from "./notas-util.js";

const refFolha = (turmaId, folhaId) => doc(db, "turmas", turmaId, "notas", folhaId);

// Folha avulsa ("Prova 1"): começa como rascunho.
export async function criarFolha(sessao, turmaId, { titulo, notaMax }) {
  const ref = doc(collection(db, "turmas", turmaId, "notas"));
  await setDoc(ref, { titulo, notaMax, publicada: false, autorUid: sessao.uid, criadoEm: serverTimestamp() });
  return { id: ref.id, turmaId, titulo, notaMax, publicada: false, autorUid: sessao.uid };
}

// Folha de uma atividade (id fixo atv_{atividadeId}). Criada na primeira vez que o professor salva notas da atividade.
// Precisa existir ANTES das notas: as regras das notas leem a folha já gravada.
export async function garantirFolhaDaAtividade(sessao, at) {
  const id = idFolhaDaAtividade(at.id), ref = refFolha(at.turmaId, id);
  const s = await getDoc(ref);
  if (s.exists()) return { id, turmaId: at.turmaId, ...s.data() };
  const dados = { titulo: tituloDaFolha(at.titulo), notaMax: at.notaMax || 10, atividadeId: at.id, publicada: false, autorUid: sessao.uid, criadoEm: serverTimestamp() };
  await setDoc(ref, dados);
  return { id, turmaId: at.turmaId, ...dados };
}

// Grava as notas alteradas num lote só. mudancas: [{ alunoUid, valor (null = apagar a nota), comentario }]
export async function salvarNotas(folha, mudancas) {
  if (!mudancas.length) return;
  const lote = writeBatch(db);
  for (const m of mudancas) {
    const ref = doc(db, "turmas", folha.turmaId, "notas", folha.id, "itens", m.alunoUid);
    if (m.valor === null) lote.delete(ref);
    else lote.set(ref, { valor: m.valor, ...(m.comentario ? { comentario: m.comentario } : {}), atualizadoEm: serverTimestamp() });
  }
  await lote.commit();
}

export const alterarFolha = (folha, { titulo, notaMax }) => updateDoc(refFolha(folha.turmaId, folha.id), { titulo, notaMax });
export const publicarFolha = folha => updateDoc(refFolha(folha.turmaId, folha.id), { publicada: true, publicadaEm: serverTimestamp() });

// Apagar folha: só RASCUNHO (as regras recusam publicada), pelo autor ou admin. Apaga as notas dela no mesmo lote
// e grava o registro "notas_apagadas" com id fixo (a folha deixa de existir, então o id vem da folha + criadoEm).
export async function apagarFolha(sessao, folha, turmaNome) {
  // lê de novo a folha: o criadoEm gravado pelo servidor entra no id do registro
  const [atual, itens] = await Promise.all([getDoc(refFolha(folha.turmaId, folha.id)),
    getDocs(collection(db, "turmas", folha.turmaId, "notas", folha.id, "itens"))]);
  if (!atual.exists()) return;
  folha = { ...folha, ...atual.data() };
  const lote = writeBatch(db), alvo = `turmas/${folha.turmaId}/notas/${folha.id}`;
  for (const i of itens.docs) lote.delete(i.ref);
  lote.delete(refFolha(folha.turmaId, folha.id));
  registro(lote, `folha_apagada_${folha.turmaId}_${folha.id}_${folha.criadoEm.toMillis()}`, sessao, "notas_apagadas", alvo,
    `Folha de notas "${folha.titulo}" (${turmaNome || "turma"}) apagada, com ${itens.size} ${itens.size === 1 ? "nota" : "notas"} em rascunho.`, folha.turmaId);
  await lote.commit();
}

// Despublicar fica no registro de alterações (as regras exigem o registro no mesmo lote).
export async function despublicarFolha(sessao, folha, turmaNome) {
  const lote = writeBatch(db), regId = novoId("auditoria"), alvo = `turmas/${folha.turmaId}/notas/${folha.id}`;
  lote.update(refFolha(folha.turmaId, folha.id), { publicada: false, publicadaEm: deleteField(), auditoriaId: regId });
  registro(lote, regId, sessao, "notas_despublicadas", alvo, `Notas de "${folha.titulo}" (${turmaNome || "turma"}) foram despublicadas.`, folha.turmaId);
  await lote.commit();
}
