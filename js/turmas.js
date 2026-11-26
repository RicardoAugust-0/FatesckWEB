// Ações sobre turmas. Cada escrita segue exatamente o que o firestore.rules exige (lotes com registro de auditoria).
import { db } from "./firebase.js";
import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const CORES = [
  ["#A61C24", "Vermelho"], ["#3B4048", "Grafite"], ["#2455C6", "Azul"], ["#1F7A66", "Verde"],
  ["#C2570C", "Laranja"], ["#5B4BD5", "Violeta"], ["#7A1118", "Vinho"], ["#15171A", "Preto"]
];

// Código de 8 caracteres sem letras/números que confundem (sem I, L, O, 0, 1). Sorteio criptográfico.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function gerarCodigo() {
  const n = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(n, v => ALFABETO[v % ALFABETO.length]).join("");
}
// Normaliza o que a pessoa digitou: maiúsculas, sem espaços nem traços.
export const normalizarCodigo = t => String(t || "").toUpperCase().replace(/[\s-]/g, "");
export const codigoValido = c => /^[A-HJKMNP-Z2-9]{8}$/.test(c);

export const novoId = col => doc(collection(db, col)).id;
// Registro de auditoria dentro de um lote (as regras exigem o registro no mesmo lote da ação auditada).
export function registro(lote, id, sessao, acao, alvo, detalhes, turmaId) {
  lote.set(doc(db, "auditoria", id), {
    acao, autorUid: sessao.uid, autorNome: sessao.nome, alvo, detalhes: detalhes.slice(0, 500), criadoEm: serverTimestamp(),
    ...(turmaId ? { turmaId } : {})
  });
}

// Cria a turma (+ código único). Professor entra como professor no mesmo lote; admin cria sem entrar.
export async function criarTurma(sessao, { nome, cor }) {
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = gerarCodigo();
    if ((await getDoc(doc(db, "codigos", codigo))).exists()) continue; // já usado: sorteia outro
    const turmaId = novoId("turmas");
    const lote = writeBatch(db);
    lote.set(doc(db, "turmas", turmaId), { nome, cor, codigo, arquivada: false, criadoPor: sessao.uid, criadoEm: serverTimestamp() });
    lote.set(doc(db, "codigos", codigo), { turmaId, arquivada: false, nome, cor });
    if (!sessao.admin) lote.set(doc(db, "turmas", turmaId, "membros", sessao.uid), { uid: sessao.uid, nome: sessao.nome, papel: "professor", entrouEm: serverTimestamp() });
    try { await lote.commit(); return { id: turmaId, codigo }; }
    catch (e) { if (tentativa === 5 || e.code !== "permission-denied") throw e; } // outra pessoa pegou o mesmo código no mesmo instante
  }
  throw Object.assign(new Error("Não foi possível gerar um código livre."), { code: "unavailable" });
}

// Nome e cor: turma e código juntos (as regras exigem os dois iguais).
export function alterarTurma(turma, { nome, cor }) {
  const lote = writeBatch(db);
  lote.update(doc(db, "turmas", turma.id), { nome, cor });
  lote.update(doc(db, "codigos", turma.codigo), { nome, cor });
  return lote.commit();
}

// Arquivar / desarquivar: turma + código juntos, com registro.
export async function definirArquivada(sessao, turma, arquivada) {
  const lote = writeBatch(db), regId = novoId("auditoria");
  lote.update(doc(db, "turmas", turma.id), { arquivada, auditoriaId: regId });
  lote.update(doc(db, "codigos", turma.codigo), { arquivada });
  registro(lote, regId, sessao, arquivada ? "turma_arquivada" : "turma_desarquivada", "turmas/" + turma.id,
    `Turma "${turma.nome}" ${arquivada ? "arquivada" : "desarquivada"}.`, turma.id);
  await lote.commit();
}

// ---------- pedidos de entrada ----------
// Resultado: { ok: true, turmaNome } ou { erro: "mensagem em português" }
export async function pedirEntrada(sessao, codigoDigitado) {
  const codigo = normalizarCodigo(codigoDigitado);
  if (!codigoValido(codigo)) return { erro: "O código tem 8 letras e números (sem I, L, O, 0 e 1). Confira e tente de novo." };
  const c = await getDoc(doc(db, "codigos", codigo));
  if (!c.exists()) return { erro: "Não encontramos nenhuma turma com esse código. Confira com o professor." };
  if (c.data().arquivada) return { erro: "Essa turma está arquivada e não aceita novos alunos." };
  const turmaId = c.data().turmaId;
  if ((await getDoc(doc(db, "turmas", turmaId, "membros", sessao.uid)).catch(() => null))?.exists()) return { erro: "Você já está nessa turma." };
  const atual = await getDoc(doc(db, "turmas", turmaId, "pedidos", sessao.uid));
  if (atual.exists() && atual.data().status === "pendente") return { erro: `Você já pediu para entrar em "${atual.data().turmaNome}". Aguarde a aprovação.` };
  // O aluno ainda não pode ler a turma: nome e cor vêm do documento do código (as regras conferem com a turma).
  const info = c.data();
  await setDoc(doc(db, "turmas", turmaId, "pedidos", sessao.uid), {
    uid: sessao.uid, nome: sessao.nome, turmaNome: info.nome, turmaCor: info.cor, codigo, status: "pendente", pedidoEm: serverTimestamp()
  });
  return { ok: true, turmaNome: info.nome };
}


export const cancelarPedido = (sessao, turmaId) => deleteDoc(doc(db, "turmas", turmaId, "pedidos", sessao.uid));

// Uma aprovação = criar o membro + apagar o pedido + 1 registro "aluno_aprovado" (as regras exigem os três juntos).
function incluirAprovacao(lote, sessao, turmaId, p) {
  const regId = novoId("auditoria"), alvo = `turmas/${turmaId}/membros/${p.uid}`;
  lote.set(doc(db, alvo), { uid: p.uid, nome: p.nome, papel: "aluno", entrouEm: serverTimestamp(), aprovadoPor: sessao.uid, auditoriaId: regId });
  lote.delete(doc(db, "turmas", turmaId, "pedidos", p.uid));
  registro(lote, regId, sessao, "aluno_aprovado", alvo, `${p.nome} aprovado(a) na turma "${p.turmaNome}".`, turmaId);
}
export async function aprovarPedido(sessao, turmaId, p) {
  const lote = writeBatch(db);
  incluirAprovacao(lote, sessao, turmaId, p);
  await lote.commit();
}

// "Aprovar todos": as regras leem alguns documentos por aluno aprovado e o Firestore aceita no máximo 20 leituras
// por lote. Medido no emulador: cabem 7 aprovações (professor) ou 8 (admin) por lote; usamos 5 para ter folga.
export const APROVACOES_POR_LOTE = 5;
// Cada lote é "tudo ou nada". Se um lote falhar (ex.: um aluno cancelou o pedido nesse meio-tempo),
// os alunos desse lote são tentados um por um, para que só quem deu problema fique de fora.
// Os lotes já gravados continuam valendo. Resultado: { aprovados: [pedidos], falhas: [{ pedido, erro }] }.
export async function aprovarTodos(sessao, turma, pedidos, aoAvancar) {
  const aprovados = [], falhas = [];
  for (let i = 0; i < pedidos.length; i += APROVACOES_POR_LOTE) {
    const grupo = pedidos.slice(i, i + APROVACOES_POR_LOTE).map(p => ({ ...p, turmaNome: turma.nome }));
    try {
      const lote = writeBatch(db);
      for (const p of grupo) incluirAprovacao(lote, sessao, turma.id, p);
      await lote.commit();
      aprovados.push(...grupo);
    } catch (e) {
      console.warn("Lote de aprovações recusado; tentando um por um.", e);
      for (const p of grupo) {
        try { await aprovarPedido(sessao, turma.id, p); aprovados.push(p); }
        catch (erro) { console.error(erro); falhas.push({ pedido: p, erro }); }
      }
    }
    aoAvancar?.(aprovados.length + falhas.length, pedidos.length);
  }
  return { aprovados, falhas };
}
export async function recusarPedido(sessao, turmaId, p) {
  const lote = writeBatch(db), regId = novoId("auditoria"), alvo = `turmas/${turmaId}/pedidos/${p.uid}`;
  lote.update(doc(db, alvo), { status: "recusado", recusadoEm: serverTimestamp(), auditoriaId: regId });
  registro(lote, regId, sessao, "aluno_recusado", alvo, `Pedido de ${p.nome} recusado na turma "${p.turmaNome}".`, turmaId);
  await lote.commit();
}

// ---------- admin ----------
export async function buscarUsuarioPorEmail(email) {
  const s = await getDocs(query(collection(db, "usuarios"), where("email", "==", String(email).trim().toLowerCase())));
  return s.empty ? null : { uid: s.docs[0].id, ...s.docs[0].data() };
}
export async function professoresAtivos() {
  const s = await getDocs(query(collection(db, "usuarios"), where("perfil", "==", "professor"), where("status", "==", "ativo")));
  return s.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
export async function adminAdicionarAluno(sessao, turma, aluno) {
  const lote = writeBatch(db), regId = novoId("auditoria"), alvo = `turmas/${turma.id}/membros/${aluno.uid}`;
  lote.set(doc(db, alvo), { uid: aluno.uid, nome: aluno.nome, papel: "aluno", entrouEm: serverTimestamp(), auditoriaId: regId });
  registro(lote, regId, sessao, "aluno_adicionado", alvo, `${aluno.nome} adicionado(a) à turma "${turma.nome}" pela administração.`, turma.id);
  // se havia pedido desse aluno, ele sai junto (as regras permitem porque o membro é criado no mesmo lote)
  const pedido = await getDoc(doc(db, "turmas", turma.id, "pedidos", aluno.uid));
  if (pedido.exists()) lote.delete(pedido.ref);
  await lote.commit();
}
export async function adminRemoverAluno(sessao, turma, membro) {
  const lote = writeBatch(db), alvo = `turmas/${turma.id}/membros/${membro.uid}`;
  lote.delete(doc(db, alvo));
  registro(lote, `remocao_${turma.id}_${membro.uid}_${membro.entrouEm.toMillis()}`, sessao, "aluno_removido", alvo,
    `${membro.nome} removido(a) da turma "${turma.nome}" pela administração.`, turma.id);
  await lote.commit();
}
export const adminAdicionarProfessor = (turma, prof) =>
  setDoc(doc(db, "turmas", turma.id, "membros", prof.uid), { uid: prof.uid, nome: prof.nome, papel: "professor", entrouEm: serverTimestamp() });

export async function adicionarRepresentante(sessao, aluno) {
  const lote = writeBatch(db), regId = novoId("auditoria"), alvo = "representantes/" + aluno.uid;
  lote.set(doc(db, alvo), { nome: aluno.nome, adicionadoEm: serverTimestamp(), auditoriaId: regId });
  registro(lote, regId, sessao, "representante_adicionado", alvo, `${aluno.nome} agora é representante do curso.`);
  await lote.commit();
}
export async function removerRepresentante(sessao, rep) {
  const lote = writeBatch(db), alvo = "representantes/" + rep.uid;
  lote.delete(doc(db, alvo));
  registro(lote, `rep_remocao_${rep.uid}_${rep.adicionadoEm.toMillis()}`, sessao, "representante_removido", alvo, `${rep.nome} deixou de ser representante do curso.`);
  await lote.commit();
}
