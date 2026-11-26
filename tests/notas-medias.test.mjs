import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  lerPeso, normalizarParaDez, calcularMediaAluno, calcularMediaTurma,
  classificarDesempenhoNota, gerarCsvBoletim
} from "../public/js/utils/notas-util.js";

describe("lerPeso", () => {
  test("vazio assume peso 1 e aceita vírgula ou ponto", () => {
    assert.deepEqual(lerPeso(""), { valor: 1 });
    assert.deepEqual(lerPeso("  "), { valor: 1 });
    assert.deepEqual(lerPeso("2"), { valor: 2 });
    assert.deepEqual(lerPeso("1,5"), { valor: 1.5 });
    assert.deepEqual(lerPeso("0.5"), { valor: 0.5 });
  });
  test("recusa zero, negativos, acima de 10 e texto inválido", () => {
    for (const v of ["0", "-1", "10,1", "onze", "1,2,3"]) assert.ok(lerPeso(v).erro);
  });
});

describe("normalizarParaDez", () => {
  test("converte para escala 0–10 e valida os argumentos", () => {
    assert.equal(normalizarParaDez(7.5, 15), 5);
    assert.equal(normalizarParaDez(8), 8);
    assert.equal(normalizarParaDez("8", 10), null);
    assert.equal(normalizarParaDez(8, 0), null);
  });
});

describe("calcularMediaAluno", () => {
  test("calcula média ponderada com pesos mistos e notas máximas diferentes", () => {
    // Prova: 8/10 com peso 2; trabalho: 15/20 = 7,5/10 com peso 1.
    assert.equal(calcularMediaAluno([
      { valor: 8, notaMax: 10, peso: 2 },
      { valor: 15, notaMax: 20, peso: 1 }
    ]), 7.8);
  });
  test("ignora folhas sem nota e usa peso 1 quando inválido", () => {
    assert.equal(calcularMediaAluno([{ valor: 10, notaMax: 10, peso: 0 }, { valor: null, notaMax: 10, peso: 5 }]), 10);
    assert.equal(calcularMediaAluno([{ valor: null }, { valor: undefined }]), null);
  });
});

describe("calcularMediaTurma", () => {
  test("filtra valores ausentes e arredonda uma casa", () => {
    assert.equal(calcularMediaTurma([6, 7.5, null, undefined, 8]), 7.2);
    assert.equal(calcularMediaTurma([null, undefined]), null);
  });
});

describe("classificarDesempenhoNota", () => {
  test("classifica os limites exigidos", () => {
    assert.deepEqual(classificarDesempenhoNota(null), { codigo: "sem_dados", rotulo: "Sem média", classe: "badge-neutro" });
    assert.equal(classificarDesempenhoNota(4.9).codigo, "critico");
    assert.equal(classificarDesempenhoNota(5.0).codigo, "atencao");
    assert.equal(classificarDesempenhoNota(5.9).codigo, "atencao");
    assert.equal(classificarDesempenhoNota(6.0).rotulo, "Aprovado parcial");
    assert.equal(classificarDesempenhoNota(8.5).rotulo, "Ótimo desempenho");
  });
});

describe("gerarCsvBoletim", () => {
  test("gera CSV com BOM, separador ;, colunas de avaliações e situação", () => {
    const csv = gerarCsvBoletim("Turma A", [{ uid: "u1", nome: 'Ana "A"', ra: "001" }],
      [{ id: "p1", titulo: "Prova 1" }, { id: "t1", titulo: "Trabalho" }],
      [{ alunoUid: "u1", notas: { p1: 8, t1: null }, media: 8, situacao: "Aprovado parcial" }]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /"Aluno";"RA";"Prova 1";"Trabalho";"Média \(0–10\)";"Situação"/);
    assert.match(csv, /"Ana ""A""";"001";"8";"";"8";"Aprovado parcial"/);
  });
});
