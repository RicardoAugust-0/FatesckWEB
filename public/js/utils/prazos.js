// Situação de uma atividade para MOSTRAR na tela (contagem regressiva, "atrasada" etc.).
// Quem decide de verdade se aceita ou não é o firestore.rules, com a hora do servidor.
import { ms, duracao } from "./datas.js";

const HORA = 3600e3;
export const JANELA_DESFAZER = 4 * HORA; // o aluno desfaz a própria entrega até 4h depois (decisão A3)

// Até quando a entrega é aceita: "reabertaAte" ou prazo + 24h, o que for mais tarde (igual às regras).
export function limiteDeEntrega(at) {
  const padrao = ms(at.prazo) + 24 * HORA;
  const reaberta = ms(at.reabertaAte);
  return reaberta > padrao ? reaberta : padrao;
}

// { estado: "aberta" | "atrasada" | "encerrada", ate (ms), restante (ms) }
export function situacao(at, agora = Date.now()) {
  const prazo = ms(at.prazo), limite = limiteDeEntrega(at);
  if (agora <= prazo) return { estado: "aberta", ate: prazo, restante: prazo - agora };
  if (agora <= limite) return { estado: "atrasada", ate: limite, restante: limite - agora };
  return { estado: "encerrada", ate: limite, restante: 0 };
}

// Chip de prazo: { texto, classe } — "Fecha em 6h 19min" (forte se < 24h), "Atrasada · aberta por mais 14h 20min".
export function chipDePrazo(at, agora = Date.now()) {
  const s = situacao(at, agora);
  if (s.estado === "aberta") return { texto: `Fecha em ${duracao(s.restante)}`, classe: s.restante < 24 * HORA ? "chip forte" : "chip", s };
  if (s.estado === "atrasada") return { texto: `Atrasada · aberta por mais ${duracao(s.restante)}`, curto: `Atrasada · ${duracao(s.restante)}`, classe: "chip contorno", s };
  return { texto: "Encerrada", classe: "chip", s };
}

// Ordem das listas: primeiro as que ainda aceitam entrega (a que fecha antes no topo),
// depois as encerradas (a de prazo mais recente no topo).
export function ordenarAtividades(lista, agora = Date.now()) {
  const sit = new Map(lista.map(a => [a, situacao(a, agora)]));
  const aceita = a => sit.get(a).estado !== "encerrada";
  return [...lista].sort((a, b) => (aceita(b) - aceita(a)) || (aceita(a) ? sit.get(a).ate - sit.get(b).ate : ms(b.prazo) - ms(a.prazo)));
}

// Tempo que o aluno ainda tem para desfazer a entrega (0 = não pode mais).
export function restanteParaDesfazer(entrega, agora = Date.now()) {
  if (!entrega?.entregueEm) return 0;
  return Math.max(0, ms(entrega.entregueEm) + JANELA_DESFAZER - agora);
}

// ---------- validação dos formulários (as regras validam de novo no servidor) ----------
export const LIMITES = { titulo: 120, descricao: 5000, texto: 5000, link: 500 };
export const linkValido = l => l.length <= LIMITES.link && /^https?:\/\/[^\s<>"]+$/.test(l);

// Nota máxima: aceita vírgula ("7,5"). Vazio = sem nota máxima. Devolve { valor } ou { erro }.
export function lerNotaMaxima(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { valor: null };
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(t)) return { erro: "A nota máxima deve ser um número, como 10 ou 7,5." };
  const valor = Number(t.replace(",", "."));
  if (!(valor > 0 && valor <= 100)) return { erro: "A nota máxima deve ser maior que 0 e no máximo 100." };
  return { valor };
}

// Rascunho da entrega guardado neste aparelho (por pessoa + atividade).
export const chaveRascunho = (uid, turmaId, atividadeId) => `fatesck-rascunho:${uid}:${turmaId}:${atividadeId}`;
