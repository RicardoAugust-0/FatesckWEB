// Leitura de dados no esquema da Fase 1 (o que pode ser lido é decidido pelo firestore.rules).
import { db } from "./firebase.js";
import {
  collection, collectionGroup, doc, getDoc, getDocs, query, where, orderBy, limit, getCountFromServer, Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { ms } from "./datas.js";

const lista = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// Turmas da pessoa (aluno ou professor), pela consulta "membros where uid == eu".
export async function minhasTurmas(uid) {
  const membros = await getDocs(query(collectionGroup(db, "membros"), where("uid", "==", uid)));
  const turmas = await Promise.all(membros.docs.map(async m => {
    const t = await getDoc(m.ref.parent.parent);
    return t.exists() ? { id: t.id, ...t.data(), meuPapel: m.data().papel } : null;
  }));
  return turmas.filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function turmaPorId(turmaId) {
  const s = await getDoc(doc(db, "turmas", turmaId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export async function alunosDaTurma(turmaId) {
  return lista(await getDocs(query(collection(db, "turmas", turmaId, "membros"), where("papel", "==", "aluno"))))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
// Pedidos de entrada: da turma (professor/admin) e os do próprio aluno (em qualquer turma).
export async function pedidosDaTurma(turmaId) {
  return lista(await getDocs(collection(db, "turmas", turmaId, "pedidos"))).map(p => ({ ...p, turmaId }))
    .sort((a, b) => ms(a.pedidoEm) - ms(b.pedidoEm));
}
export async function meusPedidos(uid) {
  const s = await getDocs(query(collectionGroup(db, "pedidos"), where("uid", "==", uid)));
  return s.docs.map(d => ({ id: d.id, turmaId: d.ref.parent.parent.id, ...d.data() }));
}

export async function professoresDaTurma(turmaId) {
  return lista(await getDocs(query(collection(db, "turmas", turmaId, "membros"), where("papel", "==", "professor"))));
}
export async function contarAlunos(turmaId) {
  return (await getCountFromServer(query(collection(db, "turmas", turmaId, "membros"), where("papel", "==", "aluno")))).data().count;
}

export async function atividadesDaTurma(turmaId) {
  return lista(await getDocs(collection(db, "turmas", turmaId, "atividades"))).map(a => ({ ...a, turmaId }));
}
export async function minhaEntrega(turmaId, atividadeId, uid) {
  const s = await getDoc(doc(db, "turmas", turmaId, "atividades", atividadeId, "entregas", uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export async function atividadePorId(turmaId, atividadeId) {
  const s = await getDoc(doc(db, "turmas", turmaId, "atividades", atividadeId));
  return s.exists() ? { id: s.id, turmaId, ...s.data() } : null;
}
// Professor da turma / admin: todas as entregas da atividade e as marcas de "entrega desfeita".
export async function entregasDaAtividade(turmaId, atividadeId) {
  return lista(await getDocs(collection(db, "turmas", turmaId, "atividades", atividadeId, "entregas")))
    .sort((a, b) => ms(a.entregueEm) - ms(b.entregueEm));
}
// Professor: atividades da turma, cada uma com a lista de entregas.
export async function atividadesComEntregas(turmaId) {
  const atividades = await atividadesDaTurma(turmaId);
  const entregas = await Promise.all(atividades.map(a => entregasDaAtividade(turmaId, a.id)));
  return atividades.map((a, i) => ({ ...a, entregas: entregas[i] }));
}
export async function desfeitasDaAtividade(turmaId, atividadeId) {
  return Object.fromEntries((await getDocs(collection(db, "turmas", turmaId, "atividades", atividadeId, "desfeitas")))
    .docs.map(d => [d.id, d.data()]));
}
export async function contarParaCorrigir(turmaId, atividadeId) {
  const q = query(collection(db, "turmas", turmaId, "atividades", atividadeId, "entregas"), where("corrigida", "==", false));
  return (await getCountFromServer(q)).data().count;
}

// ---------- notas (Fase 6) ----------
// Professor/admin: todas as folhas da turma. Aluno: só as publicadas (as regras exigem o filtro).
export async function folhasDaTurma(turmaId, { soPublicadas = false } = {}) {
  const ref = collection(db, "turmas", turmaId, "notas");
  const snap = await getDocs(soPublicadas ? query(ref, where("publicada", "==", true)) : ref);
  return lista(snap).map(f => ({ ...f, turmaId })).sort((a, b) => ms(a.criadoEm) - ms(b.criadoEm));
}
// Professor/admin: { alunoUid: item }
export async function itensDaFolha(turmaId, folhaId) {
  const snap = await getDocs(collection(db, "turmas", turmaId, "notas", folhaId, "itens"));
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}
export async function folhaPorId(turmaId, folhaId) {
  const s = await getDoc(doc(db, "turmas", turmaId, "notas", folhaId));
  return s.exists() ? { id: s.id, turmaId, ...s.data() } : null;
}
// Aluno: a própria nota. Sem nota, ou ainda escondida pelas regras (entrega com menos de 4h etc.) -> null.
export async function minhaNota(turmaId, folhaId, uid) {
  try {
    const s = await getDoc(doc(db, "turmas", turmaId, "notas", folhaId, "itens", uid));
    return s.exists() ? s.data() : null;
  } catch (e) {
    if (e.code === "permission-denied") return null;
    throw e;
  }
}

// Últimas visualizações da pessoa: { chave: ms }
export async function minhasLeituras(uid) {
  const snap = await getDocs(collection(db, "usuarios", uid, "leituras"));
  return Object.fromEntries(snap.docs.map(d => [d.id, ms(d.data().vistoEm)]));
}
const depoisDe = vistoMs => Timestamp.fromMillis(vistoMs || 0);

// Avisos (turma e curso), do mais novo para o mais antigo.
export async function avisosDaTurma(turmaId, n = 10) {
  const snap = await getDocs(query(collection(db, "turmas", turmaId, "avisos"), orderBy("criadoEm", "desc"), limit(n)));
  return lista(snap).map(a => ({ ...a, turmaId }));
}
export async function avisosDoCurso(n = 10) {
  return lista(await getDocs(query(collection(db, "avisosCurso"), orderBy("criadoEm", "desc"), limit(n)))).map(a => ({ ...a, curso: true }));
}
export async function idsRepresentantes() {
  return new Set((await getDocs(collection(db, "representantes"))).docs.map(d => d.id));
}

// Mensagens não lidas (de outras pessoas, depois da última visita). Sem visita registrada: todas contam.
export async function naoLidasDaTurma(turmaId, uid, vistoMs) {
  const snap = await getDocs(query(collection(db, "turmas", turmaId, "mensagens"), where("criadoEm", ">", depoisDe(vistoMs))));
  return snap.docs.filter(d => d.data().autorUid !== uid).length;
}
export async function naoLidasPrivadas(uid, leituras) {
  const conversas = await getDocs(query(collection(db, "conversas"), where("participantes", "array-contains", uid)));
  const contagens = await Promise.all(conversas.docs.map(async c => {
    const visto = leituras["conversa_" + c.id];
    if (visto && ms(c.data().atualizadoEm) <= visto) return 0;
    const snap = await getDocs(query(collection(db, "conversas", c.id, "mensagens"), where("criadoEm", ">", depoisDe(visto))));
    return snap.docs.filter(d => d.data().autorUid !== uid).length;
  }));
  return contagens.reduce((s, n) => s + n, 0);
}
