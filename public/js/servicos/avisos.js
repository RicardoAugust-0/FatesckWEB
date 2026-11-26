// Avisos (Fase 7a): da turma (professor da turma) e do curso (representante ativo ou admin).
// Editar e apagar ficam no registro de alterações (as regras exigem). Também grava o "visto por último" (leituras).
import { db } from "../core/firebase.js";
import {
  doc, collection, setDoc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { novoId, registro } from "./turmas.js";

// caminho do aviso: turmas/{t}/avisos/{id} ou avisosCurso/{id}
export const caminhoAviso = a => a.curso ? `avisosCurso/${a.id}` : `turmas/${a.turmaId}/avisos/${a.id}`;
const resumo = t => (t.length > 120 ? t.slice(0, 117) + "…" : t);

export function publicarAvisoTurma(sessao, turmaId, texto) {
  return setDoc(doc(collection(db, "turmas", turmaId, "avisos")),
    { texto, autorUid: sessao.uid, autorNome: sessao.nome, autorPapel: "professor", criadoEm: serverTimestamp() });
}
// papel: "representante" (aluno representante ativo) ou "admin"
export function publicarAvisoCurso(sessao, texto, papel) {
  return setDoc(doc(collection(db, "avisosCurso")),
    { texto, autorUid: sessao.uid, autorNome: sessao.nome, autorPapel: papel, criadoEm: serverTimestamp() });
}

export async function editarAviso(sessao, aviso, texto, onde) {
  const lote = writeBatch(db), regId = novoId("auditoria"), alvo = caminhoAviso(aviso);
  lote.update(doc(db, alvo), { texto, editadoEm: serverTimestamp(), auditoriaId: regId });
  registro(lote, regId, sessao, "aviso_editado", alvo, `Aviso de ${aviso.autorNome} (${onde}) editado. Antes: "${resumo(aviso.texto)}"`, aviso.turmaId);
  await lote.commit();
}
// id fixo do registro (o aviso deixa de existir): aviso_apagado_turma_{t}_{id} ou aviso_apagado_curso_{id}
export async function apagarAviso(sessao, aviso, onde) {
  const lote = writeBatch(db), alvo = caminhoAviso(aviso);
  lote.delete(doc(db, alvo));
  registro(lote, aviso.curso ? `aviso_apagado_curso_${aviso.id}` : `aviso_apagado_turma_${aviso.turmaId}_${aviso.id}`,
    sessao, "aviso_apagado", alvo, `Aviso de ${aviso.autorNome} (${onde}) apagado: "${resumo(aviso.texto)}"`, aviso.turmaId);
  await lote.commit();
}

// "Visto por último": chaves turma_{t}_avisos | turma_{t}_atividades | curso_avisos (as regras conferem o formato).
// Erros aqui não atrapalham a página (é só o contador do menu).
export async function marcarVisto(uid, chaves) {
  if (!uid || !chaves.length) return;
  const lote = writeBatch(db);
  for (const c of chaves) lote.set(doc(db, "usuarios", uid, "leituras", c), { vistoEm: serverTimestamp() });
  try { await lote.commit(); } catch (e) { console.warn("Não foi possível marcar como visto.", e); }
}
