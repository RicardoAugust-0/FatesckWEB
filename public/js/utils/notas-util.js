// Notas (Fase 6): contas e validações que não dependem do Firebase (testadas em tests/utilitarios.test.mjs).

// "8,5" / "8.5" / "10" -> { valor } ; vazio -> { valor: null } ; inválido -> { erro }
export function lerNota(texto, notaMax = 10) {
  const t = String(texto ?? "").trim();
  if (!t) return { valor: null };
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(t)) return { erro: "Digite um número, como 8 ou 7,5." };
  const valor = Number(t.replace(",", "."));
  if (valor < 0 || valor > notaMax) return { erro: `A nota vai de 0 a ${formatarNota(notaMax)}.` };
  return { valor };
}

// 8.5 -> "8,5" ; 7 -> "7" ; 7.25 -> "7,25"
export function formatarNota(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "";
  return String(Math.round(Number(v) * 100) / 100).replace(".", ",");
}

// Média das notas lançadas (só quem tem nota). Sem notas -> null. Arredonda para 1 casa: 7,45 -> "7,5".
export function media(valores) {
  const v = valores.filter(n => typeof n === "number");
  if (!v.length) return null;
  return Math.round(v.reduce((s, n) => s + n, 0) / v.length * 10) / 10;
}

// Título da folha de uma atividade (as regras aceitam até 80 caracteres).
export const tituloDaFolha = titulo => (titulo.length > 80 ? titulo.slice(0, 79).trimEnd() + "…" : titulo);

// Folha ligada a uma atividade: id fixo "atv_{atividadeId}" (uma por atividade).
export const idFolhaDaAtividade = atividadeId => "atv_" + atividadeId;

// Peso aplicado à avaliação no cálculo da média ponderada.
export function lerPeso(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { valor: 1 };
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(t)) return { erro: "Digite um peso entre 0,01 e 10." };
  const valor = Number(t.replace(",", "."));
  if (!(valor > 0) || valor > 10) return { erro: "O peso deve ser maior que zero e no máximo 10." };
  return { valor };
}

export function normalizarParaDez(valor, notaMax = 10) {
  if (typeof valor !== "number" || !(notaMax > 0)) return null;
  return (valor / notaMax) * 10;
}

export function calcularMediaAluno(avaliacoes = []) {
  const validas = (Array.isArray(avaliacoes) ? avaliacoes : []).filter(a => typeof a?.valor === "number");
  if (!validas.length) return null;
  let somaPonderada = 0, somaPesos = 0;
  for (const a of validas) {
    const n10 = normalizarParaDez(a.valor, a.notaMax || 10);
    if (n10 === null) continue;
    const p = typeof a.peso === "number" && a.peso > 0 ? a.peso : 1;
    somaPonderada += n10 * p;
    somaPesos += p;
  }
  return somaPesos ? Math.round((somaPonderada / somaPesos) * 10) / 10 : null;
}

export function calcularMediaTurma(mediasDosAlunos = []) {
  const validas = (Array.isArray(mediasDosAlunos) ? mediasDosAlunos : []).filter(m => m !== null && typeof m === "number" && Number.isFinite(m));
  if (!validas.length) return null;
  return Math.round((validas.reduce((s, m) => s + m, 0) / validas.length) * 10) / 10;
}

export function classificarDesempenhoNota(mediaAluno, CORTE = 6.0) {
  if (mediaAluno === null || typeof mediaAluno !== "number" || !Number.isFinite(mediaAluno))
    return { codigo: "sem_dados", rotulo: "Sem média", classe: "badge-neutro" };
  if (mediaAluno < 5.0) return { codigo: "critico", rotulo: "Risco de reprovação", classe: "badge-critico" };
  if (mediaAluno < CORTE) return { codigo: "atencao", rotulo: "Média em atenção", classe: "badge-atencao" };
  return { codigo: "regular", rotulo: mediaAluno >= 8.5 ? "Ótimo desempenho" : "Aprovado parcial", classe: "badge-regular" };
}

// linhasBoletim: [{ alunoUid, notas: { [folhaId]: valor|null }, media, situacao }]
export function gerarCsvBoletim(turmaNome, alunos = [], folhas = [], linhasBoletim = []) {
  const porUid = new Map((Array.isArray(linhasBoletim) ? linhasBoletim : []).map(l => [l.alunoUid || l.uid, l]));
  const campo = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const numero = v => typeof v === "number" ? String(Math.round(v * 10) / 10).replace(".", ",") : "";
  const linhas = [["Aluno", "RA", ...folhas.map(f => f.titulo), "Média (0–10)", "Situação"]];
  for (const a of alunos) {
    const l = porUid.get(a.uid) || {};
    const notas = folhas.map(f => {
      const n = l.notas?.[f.id] ?? l.valores?.[f.id] ?? l[f.id];
      return numero(typeof n === "object" && n !== null ? n.valor : n);
    });
    const mediaAluno = typeof l.media === "number" ? l.media : null;
    const situacao = typeof l.situacao === "string" ? l.situacao : classificarDesempenhoNota(mediaAluno).rotulo;
    linhas.push([a.nome, a.ra || a.matricula || a.numeroMatricula || "", ...notas, numero(mediaAluno), situacao]);
  }
  return "\uFEFF" + linhas.map(l => l.map(campo).join(";")).join("\r\n");
}
