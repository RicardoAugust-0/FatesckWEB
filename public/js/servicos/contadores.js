// Números vermelhos do menu (Fase 7a), calculados em todas as páginas internas.
// Base: usuarios/{uid}/leituras (o "visto por último" de cada turma/área). Sem visita registrada, tudo conta como novo.
//  - atividades (aluno): atividades criadas depois da última visita à página/aba Atividades daquela turma;
//  - avisos: avisos de OUTRAS pessoas (turma e curso) depois da última visita à página/aba Avisos;
//  - chat: mensagens não lidas (turma + privadas) — marcar como lido chega na Fase 7b.
import { db } from "../core/firebase.js";
import { collection, query, where, getDocs, getCountFromServer, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { minhasTurmas, minhasLeituras, naoLidasDaTurma, naoLidasPrivadas } from "./dados.js";

const depois = vistoMs => Timestamp.fromMillis(vistoMs || 0);
const deOutros = async (ref, uid, vistoMs) =>
  (await getDocs(query(ref, where("criadoEm", ">", depois(vistoMs))))).docs.filter(d => d.data().autorUid !== uid).length;

export async function calcularContadores(sessao, perfil) {
  const uid = sessao.uid;
  const [todas, leituras] = await Promise.all([minhasTurmas(uid), minhasLeituras(uid)]);
  const papel = perfil === "professor" ? "professor" : "aluno";
  const turmas = todas.filter(t => t.meuPapel === papel && !t.arquivada);
  const [porTurma, curso, privadas] = await Promise.all([
    Promise.all(turmas.map(async t => {
      const [atividades, avisos, chat] = await Promise.all([
        papel === "aluno"
          ? getCountFromServer(query(collection(db, "turmas", t.id, "atividades"), where("criadoEm", ">", depois(leituras[`turma_${t.id}_atividades`])))).then(s => s.data().count)
          : 0,
        deOutros(collection(db, "turmas", t.id, "avisos"), uid, leituras[`turma_${t.id}_avisos`]),
        naoLidasDaTurma(t.id, uid, leituras[`turma_${t.id}_chat`])
      ]);
      return { atividades, avisos, chat };
    })),
    deOutros(collection(db, "avisosCurso"), uid, leituras.curso_avisos),
    naoLidasPrivadas(uid, leituras)
  ]);
  const soma = k => porTurma.reduce((s, x) => s + x[k], 0);
  return { atividades: soma("atividades"), avisos: soma("avisos") + curso, chat: soma("chat") + privadas };
}
