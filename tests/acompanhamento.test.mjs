// Acompanhamento acadêmico: média do aluno, diagnóstico (risco / atenção / regular) e saúde da turma.
// Só funções puras (sem Firebase), com um "agora" fixo.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calcularMediaPonderada, diagnosticarAluno, resumirSaudeDaTurma, resumirAluno, formatarMedia
} from "../public/js/servicos/acompanhamento.js";

const H = 3600e3, D = 24 * H;
const AGORA = Date.UTC(2026, 10, 26, 15, 0); // 26/11/2026 12:00 em São Paulo

// Atividades de exemplo (prazo relativo ao AGORA)
const encerrada = (id, diasAtras = 5) => ({ id, titulo: `Atv ${id}`, prazo: AGORA - diasAtras * D });  // limite = prazo + 24h, já passou
const tolerancia = id => ({ id, titulo: `Atv ${id}`, prazo: AGORA - 2 * H });                         // passou do prazo, dentro das 24h
const vence = id => ({ id, titulo: `Atv ${id}`, prazo: AGORA + 5 * H });                              // fecha em menos de 24h
const longe = id => ({ id, titulo: `Atv ${id}`, prazo: AGORA + 5 * D });                              // fecha bem depois
const entregue = (at, atrasada = false) => ({ ...at, entrega: { alunoUid: "a1", entregueEm: AGORA - D, atrasada, corrigida: false } });
const semEntrega = at => ({ ...at, entrega: null });

const diag = (extra = {}) => diagnosticarAluno({ mediaAluno: null, atividades: [], entrouEmMs: 0, agora: AGORA, ...extra });

describe("calcularMediaPonderada", () => {
  const f = (id, extra = {}) => ({ id, publicada: true, notaMax: 10, ...extra });
  test("normaliza pela nota máxima: 7,5 de 10 e 15 de 20 dão 7,5", () => {
    assert.equal(calcularMediaPonderada([f("p1"), f("p2", { notaMax: 20 })], { p1: { valor: 7.5 }, p2: { valor: 15 } }), 7.5);
  });
  test("sem notaMax vale 10", () => {
    assert.equal(calcularMediaPonderada([{ id: "p1", publicada: true }], { p1: { valor: 8 } }), 8);
  });
  test("sem peso vale 1 (média simples)", () => {
    assert.equal(calcularMediaPonderada([f("p1"), f("p2")], { p1: { valor: 4 }, p2: { valor: 8 } }), 6);
  });
  test("peso inválido (0, negativo, texto) também vale 1", () => {
    const folhas = [f("p1", { peso: 0 }), f("p2", { peso: -2 }), f("p3", { peso: "3" })];
    assert.equal(calcularMediaPonderada(folhas, { p1: { valor: 3 }, p2: { valor: 6 }, p3: { valor: 9 } }), 6);
  });
  test("peso válido é usado", () => {
    assert.equal(calcularMediaPonderada([f("p1", { peso: 3 }), f("p2")], { p1: { valor: 8 }, p2: { valor: 4 } }), 7);
  });
  test("folha não publicada é ignorada", () => {
    assert.equal(calcularMediaPonderada([f("p1"), f("p2", { publicada: false })], { p1: { valor: 9 }, p2: { valor: 1 } }), 9);
  });
  test("nota que falta é ignorada (não vira zero)", () => {
    assert.equal(calcularMediaPonderada([f("p1"), f("p2"), f("p3")], { p1: { valor: 8 }, p2: null, p3: { comentario: "sem nota" } }), 8);
  });
  test("sem nenhuma nota -> null", () => {
    assert.equal(calcularMediaPonderada([f("p1")], {}), null);
    assert.equal(calcularMediaPonderada([], {}), null);
  });
  test("arredonda para 1 casa", () => {
    // (7 + 8 + 8) / 3 = 7,666… -> 7,7
    assert.equal(calcularMediaPonderada([f("a"), f("b"), f("c")], { a: { valor: 7 }, b: { valor: 8 }, c: { valor: 8 } }), 7.7);
  });
});

describe("diagnosticarAluno — limites da média", () => {
  test("4,9 -> risco de reprovação", () => {
    const d = diag({ mediaAluno: 4.9 });
    assert.equal(d.nivel, "critico"); assert.equal(d.rotulo, "Risco de reprovação"); assert.equal(d.prioridade, 1);
    assert.deepEqual(d.motivos, ["Média 4,9 (abaixo de 5,0)"]);
  });
  test("5,0 -> exige atenção", () => {
    const d = diag({ mediaAluno: 5.0 });
    assert.equal(d.nivel, "atencao"); assert.equal(d.rotulo, "Exige atenção"); assert.equal(d.prioridade, 2);
    assert.deepEqual(d.motivos, ["Média 5,0 (meta 6,0)"]);
  });
  test("5,9 -> exige atenção", () => {
    assert.equal(diag({ mediaAluno: 5.9 }).nivel, "atencao");
  });
  test("6,0 -> situação regular, sem motivos", () => {
    const d = diag({ mediaAluno: 6.0 });
    assert.equal(d.nivel, "regular"); assert.equal(d.rotulo, "Situação regular"); assert.equal(d.prioridade, 3);
    assert.deepEqual(d.motivos, []);
  });
  test("valor bruto que arredonda e cruza o limite: 4,95 -> 5,0 (atenção); 5,95 -> 6,0 (regular)", () => {
    const a = diag({ mediaAluno: 4.95 });
    assert.equal(a.mediaAluno, 5); assert.equal(a.nivel, "atencao");
    const b = diag({ mediaAluno: 5.95 });
    assert.equal(b.mediaAluno, 6); assert.equal(b.nivel, "regular");
  });
  test("3,8 aparece com vírgula", () => {
    assert.deepEqual(diag({ mediaAluno: 3.8 }).motivos, ["Média 3,8 (abaixo de 5,0)"]);
  });
});

describe("diagnosticarAluno — entregas", () => {
  test("1 atividade encerrada sem entrega -> atenção", () => {
    const d = diag({ mediaAluno: 8, atividades: [semEntrega(encerrada("x"))] });
    assert.equal(d.nivel, "atencao");
    assert.equal(d.indicadores.naoEntreguesEncerradas, 1);
    assert.deepEqual(d.motivos, ["1 atividade encerrada sem entrega"]);
  });
  test("2 atividades encerradas sem entrega -> risco (mesmo com média boa)", () => {
    const d = diag({ mediaAluno: 9, atividades: [semEntrega(encerrada("x")), semEntrega(encerrada("y", 10))] });
    assert.equal(d.nivel, "critico");
    assert.deepEqual(d.motivos, ["2 atividades encerradas sem entrega"]);
  });
  test("atividade que fechou ANTES de o aluno entrar não conta", () => {
    const entrou = AGORA - 2 * D; // a atividade de 5 dias atrás fechou há 4 dias
    const d = diag({ mediaAluno: 8, atividades: [semEntrega(encerrada("x"))], entrouEmMs: entrou });
    assert.equal(d.indicadores.naoEntreguesEncerradas, 0);
    assert.equal(d.nivel, "regular");
  });
  test("atividade que fechou DEPOIS de o aluno entrar conta", () => {
    const d = diag({ atividades: [semEntrega(encerrada("x"))], entrouEmMs: AGORA - 10 * D });
    assert.equal(d.indicadores.naoEntreguesEncerradas, 1);
  });
  test("sem data de entrada (0) não exclui nada", () => {
    assert.equal(diag({ atividades: [semEntrega(encerrada("x", 100))], entrouEmMs: 0 }).indicadores.naoEntreguesEncerradas, 1);
  });
  test("2 entregas feitas com atraso -> atenção", () => {
    const d = diag({ mediaAluno: 8, atividades: [entregue(encerrada("x"), true), entregue(encerrada("y"), true)] });
    assert.equal(d.nivel, "atencao");
    assert.equal(d.indicadores.entregasAtrasadas, 2);
    assert.deepEqual(d.motivos, ["2 entregas feitas com atraso"]);
  });
  test("1 entrega com atraso sozinha não muda o nível", () => {
    const d = diag({ mediaAluno: 8, atividades: [entregue(encerrada("x"), true)] });
    assert.equal(d.nivel, "regular"); assert.deepEqual(d.motivos, []);
  });
  test("atividade fechando em menos de 24h -> atenção", () => {
    const d = diag({ mediaAluno: 8, atividades: [semEntrega(vence("x"))] });
    assert.equal(d.nivel, "atencao");
    assert.equal(d.indicadores.pendentesUrgentes, 1);
    assert.deepEqual(d.motivos, ["1 entrega vence em menos de 24h"]);
  });
  test("2 fechando em menos de 24h usa plural", () => {
    assert.deepEqual(diag({ atividades: [semEntrega(vence("x")), semEntrega(vence("y"))] }).motivos, ["2 entregas vencem em menos de 24h"]);
  });
  test("atividade no prazo de tolerância -> atenção", () => {
    const d = diag({ mediaAluno: 8, atividades: [semEntrega(tolerancia("x"))] });
    assert.equal(d.nivel, "atencao");
    assert.deepEqual(d.motivos, ["1 atividade em prazo de tolerância"]);
    assert.deepEqual(diag({ atividades: [semEntrega(tolerancia("x")), semEntrega(tolerancia("y"))] }).motivos, ["2 atividades em prazo de tolerância"]);
  });
  test("atividade entregue ou com prazo longe não gera alerta", () => {
    const d = diag({ mediaAluno: 7, atividades: [entregue(vence("x")), semEntrega(longe("y"))] });
    assert.equal(d.nivel, "regular"); assert.equal(d.indicadores.pendentesUrgentes, 0);
  });
  test("sem notas e sem alertas -> aguardando avaliações", () => {
    const d = diag({ atividades: [semEntrega(longe("y"))] });
    assert.equal(d.nivel, "sem_dados"); assert.equal(d.rotulo, "Aguardando avaliações"); assert.equal(d.prioridade, 4);
    assert.equal(d.mediaAluno, null);
  });
  test("sem notas mas com alerta -> atenção (não fica 'aguardando')", () => {
    assert.equal(diag({ atividades: [semEntrega(vence("x"))] }).nivel, "atencao");
  });
  test("vários motivos juntos, do mais grave para o mais leve", () => {
    const d = diag({ mediaAluno: 3.8, atividades: [
      semEntrega(encerrada("a")), semEntrega(encerrada("b")), semEntrega(vence("c")), semEntrega(tolerancia("d")),
      entregue(encerrada("e"), true), entregue(encerrada("f"), true)
    ] });
    assert.equal(d.nivel, "critico");
    assert.deepEqual(d.motivos, [
      "Média 3,8 (abaixo de 5,0)", "2 atividades encerradas sem entrega", "1 entrega vence em menos de 24h",
      "1 atividade em prazo de tolerância", "2 entregas feitas com atraso"
    ]);
  });
});

describe("resumirSaudeDaTurma", () => {
  const al = (nome, nivel, mediaAluno) => ({ nivel, mediaAluno, aluno: { uid: nome, nome } });
  test("média da turma ignora quem não tem média", () => {
    const r = resumirSaudeDaTurma([al("A", "regular", 8), al("B", "atencao", 5.5), al("C", "sem_dados", null)]);
    assert.equal(r.mediaTurma, 6.8); // (8 + 5,5) / 2 = 6,75 -> 6,8
  });
  test("conta por nível e total", () => {
    const r = resumirSaudeDaTurma([al("A", "critico", 3), al("B", "atencao", 5.5), al("C", "atencao", null), al("D", "regular", 9), al("E", "sem_dados", null)]);
    assert.deepEqual(r.contagem, { critico: 1, atencao: 2, regular: 1, sem_dados: 1 });
    assert.equal(r.total, 5);
  });
  test("ordem: risco -> atenção -> menor média (sem média por último) -> nome", () => {
    const r = resumirSaudeDaTurma([
      al("Zeca", "regular", 9), al("Bia", "sem_dados", null), al("Ana", "regular", 7), al("Caio", "atencao", null),
      al("Davi", "atencao", 5.2), al("Eva", "critico", 4.5), al("Ícaro", "critico", 4.5), al("Ari", "regular", 7)
    ]);
    assert.deepEqual(r.alunos.map(a => a.aluno.nome), ["Eva", "Ícaro", "Davi", "Caio", "Ana", "Ari", "Zeca", "Bia"]);
  });
  test("turma vazia", () => {
    assert.deepEqual(resumirSaudeDaTurma([]), { mediaTurma: null, contagem: { critico: 0, atencao: 0, regular: 0, sem_dados: 0 }, total: 0, alunos: [] });
  });
});

describe("resumirAluno e formatarMedia", () => {
  test("média geral = média simples das médias por turma; pior nível vence", () => {
    const folha = { id: "p", publicada: true, notaMax: 10 };
    const r = resumirAluno([
      { turma: { id: "t1" }, atividades: [], folhas: [folha], notasPorFolha: { p: { valor: 9 } }, entrouEmMs: 0 },
      { turma: { id: "t2" }, atividades: [], folhas: [folha], notasPorFolha: { p: { valor: 5.5 } }, entrouEmMs: 0 },
      { turma: { id: "t3" }, atividades: [], folhas: [], notasPorFolha: {}, entrouEmMs: 0 }
    ], AGORA);
    assert.equal(r.mediaGeral, 7.3); // (9 + 5,5) / 2 = 7,25 -> 7,3
    assert.equal(r.nivel, "atencao");
    assert.deepEqual(r.turmas.map(x => x.temNota), [true, true, false]);
  });
  test("formatarMedia usa vírgula e sempre 1 casa", () => {
    assert.equal(formatarMedia(7.8), "7,8"); assert.equal(formatarMedia(5), "5,0"); assert.equal(formatarMedia(null), "");
  });
});
