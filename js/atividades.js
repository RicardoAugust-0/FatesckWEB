// Ações sobre atividades e entregas (Fase 5). Cada escrita segue exatamente o que o firestore.rules exige.
import { db } from "./firebase.js";
import {
  doc, collection, getDocs, writeBatch, setDoc, updateDoc, serverTimestamp, deleteField, Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { novoId, registro } from "./turmas.js";
import { ms, diaMesHora, dataHora } from "./datas.js";

const caminhoAtv = (turmaId, atividadeId) => `turmas/${turmaId}/atividades/${atividadeId}`;
const opcional = (v, criando) => (v === null || v === undefined || v === "") ? (criando ? undefined : deleteField()) : v;

// ---------- professor: criar / editar / prazo / reabrir / apagar ----------
// dados: { titulo, descricao, prazoMs, notaMax }
export async function criarAtividade(sessao, turmaId, dados) {
  const d = { titulo: dados.titulo, prazo: Timestamp.fromMillis(dados.prazoMs), autorUid: sessao.uid, criadoEm: serverTimestamp() };
  if (dados.descricao) d.descricao = dados.descricao;
  if (dados.notaMax) d.notaMax = dados.notaMax;
  const ref = doc(collection(db, "turmas", turmaId, "atividades"));
  await setDoc(ref, d);
  return ref.id;
}
// Editar: título, descrição e nota máxima (o prazo muda pelo "Estender prazo", que é registrado).
export function editarAtividade(at, dados) {
  return updateDoc(doc(db, caminhoAtv(at.turmaId, at.id)), {
    titulo: dados.titulo, descricao: opcional(dados.descricao, false), notaMax: opcional(dados.notaMax, false), atualizadoEm: serverTimestamp()
  });
}
export async function estenderPrazo(sessao, at, novoPrazoMs) {
  const lote = writeBatch(db), regId = novoId("auditoria"), alvo = caminhoAtv(at.turmaId, at.id);
  lote.update(doc(db, alvo), { prazo: Timestamp.fromMillis(novoPrazoMs), atualizadoEm: serverTimestamp(), auditoriaId: regId });
  registro(lote, regId, sessao, "prazo_alterado", alvo,
    `Prazo de "${at.titulo}" (${at.turmaNome || "turma"}) mudou de ${dataHora(at.prazo)} para ${dataHora(novoPrazoMs)}.`, at.turmaId);
  await lote.commit();
}
export async function reabrirEntrega(sessao, at, ateMs) {
  const lote = writeBatch(db), regId = novoId("auditoria"), alvo = caminhoAtv(at.turmaId, at.id);
  lote.update(doc(db, alvo), { reabertaAte: Timestamp.fromMillis(ateMs), atualizadoEm: serverTimestamp(), auditoriaId: regId });
  registro(lote, regId, sessao, "entrega_reaberta", alvo,
    `Entrega de "${at.titulo}" (${at.turmaNome || "turma"}) reaberta até ${dataHora(ateMs)}.`, at.turmaId);
  await lote.commit();
}
// Apaga a atividade e as entregas dela num lote só (as regras deixam apagar as entregas junto com a atividade).
export async function apagarAtividade(at) {
  const entregas = await getDocs(collection(db, "turmas", at.turmaId, "atividades", at.id, "entregas"));
  const lote = writeBatch(db);
  for (const e of entregas.docs) lote.delete(e.ref);
  lote.delete(doc(db, caminhoAtv(at.turmaId, at.id)));
  await lote.commit();
}

// ---------- aluno: entregar / desfazer ----------
// "atrasada" precisa ser igual à conta das regras (hora do servidor > prazo). Perto do prazo, o relógio do aparelho
// pode estar alguns segundos diferente do servidor: se a regra recusar, tentamos de novo com o valor oposto.
export async function entregar(sessao, at, { texto, link }) {
  const ref = doc(db, caminhoAtv(at.turmaId, at.id), "entregas", sessao.uid);
  const dados = atrasada => ({
    ...(texto ? { texto } : {}), ...(link ? { link } : {}),
    entregueEm: serverTimestamp(), atrasada, alunoUid: sessao.uid, alunoNome: sessao.nome, corrigida: false
  });
  const palpite = Date.now() > ms(at.prazo);
  try { await setDoc(ref, dados(palpite)); }
  catch (e) {
    if (e.code !== "permission-denied" || Math.abs(Date.now() - ms(at.prazo)) > 5 * 60e3) throw e;
    await setDoc(ref, dados(!palpite));
  }
}
// O próprio aluno, até 4h depois de entregar. Grava a marca "desfeita" no mesmo lote (o professor vê).
export async function desfazerMinhaEntrega(sessao, at) {
  const lote = writeBatch(db), base = caminhoAtv(at.turmaId, at.id);
  lote.delete(doc(db, base, "entregas", sessao.uid));
  lote.set(doc(db, base, "desfeitas", sessao.uid), { desfeitaEm: serverTimestamp(), desfeitaPorUid: sessao.uid, desfeitaPorPapel: "aluno" });
  await lote.commit();
}

// ---------- professor: corrigir / desfazer entrega ----------
export function marcarCorrigida(at, alunoUid, corrigida) {
  return updateDoc(doc(db, caminhoAtv(at.turmaId, at.id), "entregas", alunoUid),
    corrigida ? { corrigida: true, corrigidaEm: serverTimestamp() } : { corrigida: false, corrigidaEm: deleteField() });
}
// Autor da atividade (ou admin), a qualquer hora, com registro (id fixo: entrega_{turma}_{atividade}_{aluno}_{entregueEm}).
export async function desfazerEntregaDoAluno(sessao, at, entrega) {
  const lote = writeBatch(db), base = caminhoAtv(at.turmaId, at.id), alvo = `${base}/entregas/${entrega.alunoUid}`;
  lote.delete(doc(db, alvo));
  lote.set(doc(db, base, "desfeitas", entrega.alunoUid),
    { desfeitaEm: serverTimestamp(), desfeitaPorUid: sessao.uid, desfeitaPorPapel: sessao.admin ? "admin" : "professor" });
  registro(lote, `entrega_${at.turmaId}_${at.id}_${entrega.alunoUid}_${ms(entrega.entregueEm)}`, sessao, "entrega_desfeita", alvo,
    `Entrega de ${entrega.alunoNome} em "${at.titulo}" (feita em ${diaMesHora(entrega.entregueEm)}) foi desfeita.`, at.turmaId);
  await lote.commit();
}
