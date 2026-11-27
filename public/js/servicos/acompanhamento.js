// Acompanhamento acadêmico: média de cada aluno, diagnóstico (risco / atenção / regular) e saúde da turma.
// As funções de cálculo são PURAS (recebem "agora" como parâmetro) e são testadas em tests/acompanhamento.test.mjs.
// Por isso este arquivo NÃO importa nada do Firebase no topo: o Node não consegue carregar os módulos do CDN.
// As funções que leem o Firestore (carregarDiagnostico...) carregam dados.js / firebase.js com import() na hora.
import { situacao } from "../utils/prazos.js";
import { ms } from "../utils/datas.js";

const HORA = 3600e3;

export const NIVEIS = {
  critico: { rotulo: "Risco de reprovação", prioridade: 1 },
  atencao: { rotulo: "Exige atenção", prioridade: 2 },
  regular: { rotulo: "Situação regular", prioridade: 3 },
  sem_dados: { rotulo: "Aguardando avaliações", prioridade: 4 }
};

// Arredonda para 1 casa (7,45 -> 7,5). null continua null.
const umaCasa = v => (typeof v === "number" && Number.isFinite(v)) ? Math.round(v * 10) / 10 : null;

// 7.8 -> "7,8" ; 5 -> "5,0" (média sempre com 1 casa, com vírgula)
export const formatarMedia = v => umaCasa(v) === null ? "" : umaCasa(v).toFixed(1).replace(".", ",");

// "1 atividade" / "2 atividades"
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// ---------- média do aluno ----------
// folhas: folhas da turma; notasPorFolha: { [folhaId]: item do aluno ({ valor, ... }) }.
// Só folhas publicadas e só notas numéricas (nota que falta NÃO vira zero). Cada nota vai para a escala 0–10.
// Peso: não existe no sistema hoje; se um dia existir (número > 0) é usado, senão vale 1.
export function calcularMediaPonderada(folhas = [], notasPorFolha = {}) {
  let soma = 0, pesos = 0;
  for (const folha of folhas || []) {
    if (folha?.publicada !== true) continue;
    const item = notasPorFolha?.[folha.id];
    if (typeof item?.valor !== "number") continue;
    const n10 = (item.valor / (folha.notaMax || 10)) * 10;
    const p = (typeof folha.peso === "number" && folha.peso > 0) ? folha.peso : 1;
    soma += n10 * p;
    pesos += p;
  }
  return pesos ? Math.round((soma / pesos) * 10) / 10 : null;
}

// ---------- diagnóstico de um aluno numa turma ----------
// atividades: cada uma com a própria entrega do aluno em "entrega" (ou null).
// entrouEmMs: quando o aluno entrou na turma. Atividade que já tinha fechado antes disso não conta como "sem entrega".
export function diagnosticarAluno({ mediaAluno = null, atividades = [], entrouEmMs = 0, agora }) {
  const media = umaCasa(mediaAluno);
  const naoEntregues = [], vencendo = [], emTolerancia = [], atrasadas = [];
  for (const at of atividades || []) {
    const s = situacao(at, agora);
    const entrega = at.entrega || null;
    if (entrega) {
      if (entrega.atrasada === true) atrasadas.push(at);
      continue;
    }
    if (s.estado === "encerrada") {
      if (entrouEmMs && s.ate < entrouEmMs) continue; // ainda não estava na turma
      naoEntregues.push(at);
    } else if (s.estado === "atrasada") emTolerancia.push(at);
    else if (s.restante < 24 * HORA) vencendo.push(at);
  }
  const porPrazo = (a, b) => situacao(a, agora).ate - situacao(b, agora).ate;
  vencendo.sort(porPrazo); emTolerancia.sort(porPrazo);

  const indicadores = {
    naoEntreguesEncerradas: naoEntregues.length,
    pendentesUrgentes: vencendo.length + emTolerancia.length,
    vencendo24h: vencendo.length,
    emTolerancia: emTolerancia.length,
    entregasAtrasadas: atrasadas.length
  };

  let nivel;
  if ((media !== null && media < 5.0) || indicadores.naoEntreguesEncerradas >= 2) nivel = "critico";
  else if ((media !== null && media < 6.0) || indicadores.naoEntreguesEncerradas === 1
    || indicadores.entregasAtrasadas >= 2 || indicadores.pendentesUrgentes >= 1) nivel = "atencao";
  else if (media !== null && media >= 6.0) nivel = "regular";
  else nivel = "sem_dados";

  // Motivos em português, do mais grave para o mais leve.
  const motivos = [];
  if (media !== null && media < 5.0) motivos.push(`Média ${formatarMedia(media)} (abaixo de 5,0)`);
  else if (media !== null && media < 6.0) motivos.push(`Média ${formatarMedia(media)} (meta 6,0)`);
  if (naoEntregues.length) motivos.push(`${plural(naoEntregues.length, "atividade encerrada", "atividades encerradas")} sem entrega`);
  if (vencendo.length) motivos.push(`${plural(vencendo.length, "entrega vence", "entregas vencem")} em menos de 24h`);
  if (emTolerancia.length) motivos.push(`${plural(emTolerancia.length, "atividade", "atividades")} em prazo de tolerância`);
  if (atrasadas.length >= 2) motivos.push(`${plural(atrasadas.length, "entrega feita", "entregas feitas")} com atraso`);

  return {
    nivel, rotulo: NIVEIS[nivel].rotulo, prioridade: NIVEIS[nivel].prioridade, mediaAluno: media,
    indicadores, motivos,
    // listas usadas pelas telas (ex.: "Entregar atividade" abre a mais urgente)
    atividades: { naoEntregues, vencendo, emTolerancia, atrasadas }
  };
}

// Ordem de gravidade: risco -> atenção -> menor média (sem média por último) -> nome.
const grupo = n => n === "critico" ? 0 : n === "atencao" ? 1 : 2;
export function compararGravidade(a, b) {
  const g = grupo(a.nivel) - grupo(b.nivel);
  if (g) return g;
  const ma = a.mediaAluno, mb = b.mediaAluno;
  if (ma !== mb) {
    if (ma === null || ma === undefined) return 1;
    if (mb === null || mb === undefined) return -1;
    return ma - mb;
  }
  return String(a.aluno?.nome ?? a.nome ?? "").localeCompare(String(b.aluno?.nome ?? b.nome ?? ""), "pt-BR");
}

// ---------- saúde da turma ----------
// diagnosticos: um por aluno (com "aluno: { uid, nome }").
export function resumirSaudeDaTurma(diagnosticos = []) {
  const lista = diagnosticos || [];
  const contagem = { critico: 0, atencao: 0, regular: 0, sem_dados: 0 };
  for (const d of lista) if (d.nivel in contagem) contagem[d.nivel]++;
  const medias = lista.map(d => d.mediaAluno).filter(m => typeof m === "number" && Number.isFinite(m));
  const mediaTurma = medias.length ? Math.round((medias.reduce((s, m) => s + m, 0) / medias.length) * 10) / 10 : null;
  return { mediaTurma, contagem, total: lista.length, alunos: [...lista].sort(compararGravidade) };
}

// ---------- resumo do aluno (todas as turmas) ----------
// base: [{ turma, atividades (com entrega), folhas, notasPorFolha, entrouEmMs }]
export function resumirAluno(base = [], agora) {
  const turmas = base.map(b => {
    const mediaAluno = calcularMediaPonderada(b.folhas, b.notasPorFolha);
    const diagnostico = diagnosticarAluno({ mediaAluno, atividades: b.atividades, entrouEmMs: b.entrouEmMs, agora });
    return { turma: b.turma, diagnostico, temNota: mediaAluno !== null };
  });
  const medias = turmas.map(x => x.diagnostico.mediaAluno).filter(m => m !== null);
  const mediaGeral = medias.length ? Math.round((medias.reduce((s, m) => s + m, 0) / medias.length) * 10) / 10 : null;
  const pior = turmas.reduce((p, x) => (!p || x.diagnostico.prioridade < p.diagnostico.prioridade) ? x : p, null);
  return { turmas, mediaGeral, nivel: pior ? pior.diagnostico.nivel : "sem_dados" };
}

// ---------- leitura do Firestore ----------
// Professor: diagnóstico de todos os alunos das turmas ativas recebidas (objetos de turma "t").
export async function carregarDiagnosticoProfessor(turmasAtivas = []) {
  const { alunosDaTurma, atividadesComEntregas, folhasDaTurma, itensDaFolha } = await import("./dados.js");
  const agora = Date.now();
  const resultados = await Promise.allSettled(turmasAtivas.map(async t => {
    const [alunos, atividades, folhas] = await Promise.all([
      alunosDaTurma(t.id), atividadesComEntregas(t.id), folhasDaTurma(t.id, { soPublicadas: true })
    ]);
    const itens = await Promise.all(folhas.map(f => itensDaFolha(t.id, f.id)));
    const diagnosticos = alunos.map(aluno => {
      const notasPorFolha = Object.fromEntries(folhas.map((f, i) => [f.id, itens[i][aluno.uid]]));
      const atividadesDoAluno = atividades.map(a => ({
        ...a, entrega: (a.entregas || []).find(e => (e.alunoUid || e.id) === aluno.uid) || null
      }));
      return {
        ...diagnosticarAluno({
          mediaAluno: calcularMediaPonderada(folhas, notasPorFolha), atividades: atividadesDoAluno,
          entrouEmMs: ms(aluno.entrouEm), agora
        }),
        aluno: { uid: aluno.uid, nome: aluno.nome }, turma: t
      };
    });
    return { turma: t, resumo: resumirSaudeDaTurma(diagnosticos) };
  }));
  const turmas = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") turmas.push(r.value);
    else console.error(`Acompanhamento: não foi possível diagnosticar a turma ${turmasAtivas[i]?.id}.`, r.reason);
  });
  if (turmasAtivas.length && !turmas.length) throw new Error("Nenhuma turma pôde ser diagnosticada.");
  const alunosEmAlerta = turmas.flatMap(x => x.resumo.alunos)
    .filter(d => d.nivel === "critico" || d.nivel === "atencao").sort(compararGravidade);
  return { turmas, alunosEmAlerta };
}

// Aluno: recebe o que o Início já carregou ([{ turma, atividades com a própria entrega }]) e busca só as notas
// publicadas + a data de entrada na turma (o próprio documento de membro).
// Observação: a média que o aluno vê pode ficar, por pouco tempo, diferente da que o professor vê, porque uma nota
// ainda escondida pela regra A3 (entrega com menos de 4h, entrega desfeita) chega como null para o aluno.
export async function carregarDiagnosticoAluno(uid, turmasComAtividades = []) {
  const [{ folhasDaTurma, minhaNota }, { db }, { doc, getDoc }] = await Promise.all([
    import("./dados.js"), import("../core/firebase.js"),
    import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")
  ]);
  const base = await Promise.all(turmasComAtividades.map(async ({ turma, atividades }) => {
    const [folhas, membro] = await Promise.all([
      folhasDaTurma(turma.id, { soPublicadas: true }),
      getDoc(doc(db, "turmas", turma.id, "membros", uid))
    ]);
    const notas = await Promise.all(folhas.map(f => minhaNota(turma.id, f.id, uid)));
    return {
      turma, atividades, folhas,
      notasPorFolha: Object.fromEntries(folhas.map((f, i) => [f.id, notas[i]])),
      entrouEmMs: membro.exists() ? ms(membro.data().entrouEm) : 0
    };
  }));
  return { base, ...resumirAluno(base, Date.now()) };
}
