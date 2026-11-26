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
