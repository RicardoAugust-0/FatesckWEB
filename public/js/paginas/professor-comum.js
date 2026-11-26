// Dados usados pelas telas do professor (Início e Minhas turmas).
import { minhasTurmas, atividadesDaTurma, contarParaCorrigir, contarAlunos, minhasLeituras, naoLidasDaTurma, naoLidasPrivadas, pedidosDaTurma } from "../servicos/dados.js";

// Para cada turma em que a pessoa é professor: atividades (só as dela) com o número de entregas para corrigir,
// número de alunos, pedidos de entrada pendentes e mensagens não lidas. As arquivadas vêm separadas.
export async function carregarProfessor(uid, { comAlunos = false, comArquivadas = false } = {}) {
  const [todas, leituras] = await Promise.all([minhasTurmas(uid), minhasLeituras(uid)]);
  const minhas = todas.filter(t => t.meuPapel === "professor");

  const detalhar = async t => {
    const [atividades, msgs, alunos, pedidos] = await Promise.all([
      atividadesDaTurma(t.id), t.arquivada ? 0 : naoLidasDaTurma(t.id, uid, leituras[`turma_${t.id}_chat`]),
      comAlunos ? contarAlunos(t.id) : null, t.arquivada ? [] : pedidosDaTurma(t.id)
    ]);
    const minhasAtv = atividades.filter(a => a.autorUid === uid);
    const contagens = await Promise.all(minhasAtv.map(a => contarParaCorrigir(t.id, a.id)));
    const paraCorrigir = minhasAtv.map((a, i) => ({ ...a, turmaNome: t.nome, turmaCor: t.cor, pendentes: contagens[i] })).filter(a => a.pendentes > 0);
    return { t, paraCorrigir, msgs, alunos, pedidos: pedidos.filter(p => p.status === "pendente") };
  };
  const ativas = minhas.filter(t => !t.arquivada), arquivadas = minhas.filter(t => t.arquivada);
  const [turmas, turmasArquivadas, msgsPrivadas] = await Promise.all([
    Promise.all(ativas.map(detalhar)),
    comArquivadas ? Promise.all(arquivadas.map(detalhar)) : arquivadas.map(t => ({ t })),
    naoLidasPrivadas(uid, leituras)
  ]);
  return {
    turmas, arquivadas: turmasArquivadas,
    atividadesParaCorrigir: turmas.flatMap(x => x.paraCorrigir),
    msgsNaoLidas: turmas.reduce((s, x) => s + x.msgs, 0) + msgsPrivadas
  };
}
