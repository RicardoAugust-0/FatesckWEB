// Chat (Fase 7b): leitura em tempo real (onSnapshot) e escritas, do jeito que o firestore.rules exige.
//  - chat da turma:      turmas/{t}/mensagens/{m}      (etiqueta do autor conferida pelas regras)
//  - conversa privada:   conversas/{professorUid}_{alunoUid}/mensagens/{m}   (só professor <-> aluno da mesma turma)
// Um "alvo" é { tipo: "turma" | "privada", id }.
import { db } from "../core/firebase.js";
import {
  collection, doc, getDoc, setDoc, writeBatch, query, orderBy, where, limitToLast, onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { ms } from "../utils/datas.js";
import { registro } from "./turmas.js";

export const MAX_MENSAGEM = 2000;
const ULTIMAS = 300; // a tela mostra as últimas 300 mensagens da conversa

const colecao = alvo => alvo.tipo === "turma"
  ? collection(db, "turmas", alvo.id, "mensagens")
  : collection(db, "conversas", alvo.id, "mensagens");
export const caminhoMensagem = (alvo, id) => `${alvo.tipo === "turma" ? "turmas" : "conversas"}/${alvo.id}/mensagens/${id}`;
// chave do "visto por último" (usuarios/{uid}/leituras/{chave})
export const chaveLeitura = alvo => alvo.tipo === "turma" ? `turma_${alvo.id}_chat` : `conversa_${alvo.id}`;

// A mensagem que acabei de enviar ainda não tem a hora do servidor: "estimate" usa a hora local até ela chegar.
const dados = d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });

// Mensagens da conversa aberta, em ordem. Devolve a função que desliga a escuta.
export function ouvirMensagens(alvo, aoMudar, aoErro) {
  return onSnapshot(query(colecao(alvo), orderBy("criadoEm", "asc"), limitToLast(ULTIMAS)),
    snap => aoMudar(snap.docs.map(dados)), e => { console.warn("Chat: escuta interrompida.", e); aoErro?.(e); });
}

// Só o que chegou depois da última visita (para os números de "não lidas"). Devolve [{ autorUid, quando (ms) }].
export function ouvirNovas(alvo, vistoMs, aoMudar) {
  return onSnapshot(query(colecao(alvo), where("criadoEm", ">", Timestamp.fromMillis(vistoMs || 0))),
    snap => aoMudar(snap.docs.map(d => { const m = dados(d); return { autorUid: m.autorUid, quando: ms(m.criadoEm) }; })),
    e => console.warn("Chat: contagem de não lidas indisponível.", e));
}

// Minhas conversas privadas (a mais recente primeiro). O filtro "participantes contém eu" é exigido pelas regras.
export function ouvirMinhasConversas(uid, aoMudar, aoErro) {
  return onSnapshot(query(collection(db, "conversas"), where("participantes", "array-contains", uid)),
    snap => aoMudar(snap.docs.map(dados).sort((a, b) => ms(b.atualizadoEm) - ms(a.atualizadoEm))),
    e => { console.warn("Chat: lista de conversas indisponível.", e); aoErro?.(e); });
}

// papel (só no chat da turma): "professor" | "representante" | "aluno" — as regras conferem com os dados reais.
export async function enviarMensagem(alvo, texto, sessao, papel) {
  const base = { texto: texto.trim(), autorUid: sessao.uid, autorNome: sessao.nome, criadoEm: serverTimestamp() };
  if (alvo.tipo === "turma") return setDoc(doc(colecao(alvo)), { ...base, autorPapel: papel });
  const lote = writeBatch(db); // privada: mensagem + hora da última atividade da conversa
  lote.set(doc(colecao(alvo)), base);
  lote.update(doc(db, "conversas", alvo.id), { atualizadoEm: serverTimestamp() });
  await lote.commit();
}

// Abre (ou cria) a conversa professor <-> aluno. professor/aluno: { uid, nome }. Devolve a conversa.
export async function abrirConversa(professor, aluno, turmaId) {
  const ref = doc(db, "conversas", `${professor.uid}_${aluno.uid}`);
  const atual = await getDoc(ref);
  if (atual.exists()) return { id: atual.id, ...atual.data() };
  const nova = {
    professorUid: professor.uid, alunoUid: aluno.uid, participantes: [professor.uid, aluno.uid],
    professorNome: professor.nome, alunoNome: aluno.nome, turmaId
  };
  await setDoc(ref, { ...nova, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
  return { id: ref.id, ...nova };
}

// Apaga de verdade (o documento some) + registro de alterações no mesmo lote (id fixo, exigido pelas regras).
// Turma: professor da turma ou admin. Privada: só o admin. O texto apagado NÃO vai para o registro.
export async function apagarMensagem(alvo, mensagem, sessao, onde) {
  const lote = writeBatch(db), caminho = caminhoMensagem(alvo, mensagem.id);
  lote.delete(doc(db, caminho));
  registro(lote, alvo.tipo === "turma" ? `mensagem_${alvo.id}_${mensagem.id}` : `mensagem_conversa_${alvo.id}_${mensagem.id}`,
    sessao, "mensagem_removida", caminho, `Mensagem de ${mensagem.autorNome} apagada (${onde}).`, alvo.tipo === "turma" ? alvo.id : undefined);
  await lote.commit();
}
