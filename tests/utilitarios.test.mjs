// Funções do site que não dependem do Firebase: esc(), datas em São Paulo, durações e situação de prazos.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { esc } from "../public/js/ui/ui.js";
import { quando, dataHora, duracao, hojeExtenso, diaMesHora, msDeCampos, camposDeMs } from "../public/js/utils/datas.js";
import {
  situacao, limiteDeEntrega, chipDePrazo, restanteParaDesfazer, lerNotaMaxima, linkValido, ordenarAtividades, chaveRascunho
} from "../public/js/utils/prazos.js";

const H = 3600e3;

describe("esc() — texto nunca vira HTML", () => {
  test("escapa os 5 caracteres perigosos", () => {
    assert.equal(esc(`<img src=x onerror="alert('x')">&`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
  });
  test("valores vazios viram texto vazio; números viram texto", () => {
    assert.equal(esc(null), ""); assert.equal(esc(undefined), ""); assert.equal(esc(42), "42");
  });
});

describe("datas no horário de Brasília (nunca UTC)", () => {
  // 12/11/2026 00:30 em UTC = 11/11/2026 21:30 em São Paulo (o antigo bug das 21h)
  const meiaNoiteUTC = Date.UTC(2026, 10, 12, 0, 30);
  test("21:30 de Brasília continua sendo 'hoje' (não vira o dia seguinte)", () => {
    assert.equal(quando(meiaNoiteUTC, new Date(Date.UTC(2026, 10, 11, 15, 0))), "hoje, 21:30");
  });
  test("data completa e 'ontem'/'amanhã'", () => {
    assert.equal(dataHora(meiaNoiteUTC), "11/11/2026 às 21:30");
    const agora = new Date(Date.UTC(2026, 10, 11, 15, 0));
    assert.equal(quando(Date.UTC(2026, 10, 10, 15, 0), agora), "ontem, 12:00");
    assert.equal(quando(Date.UTC(2026, 10, 13, 2, 59), agora), "amanhã, 23:59");
    assert.equal(quando(Date.UTC(2026, 10, 20, 2, 59), agora), "19/11, 23:59");
  });
  test("dia por extenso com inicial maiúscula", () => {
    assert.equal(hojeExtenso(new Date(Date.UTC(2026, 10, 11, 15, 0))), "Quarta-feira, 11 de novembro");
  });
});

describe("duração legível", () => {
  test("minutos, horas e dias", () => {
    assert.equal(duracao(45 * 60e3), "45min");
    assert.equal(duracao(6 * H + 19 * 60e3), "6h 19min");
    assert.equal(duracao(5 * H), "5h");
    assert.equal(duracao(3 * 24 * H + 2 * H), "3 dias");
    assert.equal(duracao(-5), "0min");
  });
});

describe("situação do prazo (mesma conta das regras: prazo + 24h ou reabertaAte)", () => {
  const agora = Date.UTC(2026, 10, 11, 15, 0);
  const at = prazoMs => ({ prazo: { toMillis: () => prazoMs, toDate: () => new Date(prazoMs) } });
  test("antes do prazo: aberta, chip forte se fecha em menos de 24h", () => {
    const s = situacao(at(agora + 6 * H), agora);
    assert.equal(s.estado, "aberta");
    assert.equal(chipDePrazo(at(agora + 6 * H), agora).classe, "chip forte");
    assert.equal(chipDePrazo(at(agora + 3 * 24 * H), agora).texto, "Fecha em 3 dias");
  });
  test("depois do prazo e antes de +24h: atrasada, ainda aberta", () => {
    const c = chipDePrazo(at(agora - 10 * H), agora);
    assert.equal(c.s.estado, "atrasada");
    assert.equal(c.texto, "Atrasada · aberta por mais 14h");
    assert.equal(c.curto, "Atrasada · 14h");
  });
  test("passou de 24h: encerrada; reabertura estende", () => {
    assert.equal(situacao(at(agora - 30 * H), agora).estado, "encerrada");
    const reaberta = { ...at(agora - 30 * H), reabertaAte: { toMillis: () => agora + 2 * H, toDate: () => new Date(agora + 2 * H) } };
    assert.equal(situacao(reaberta, agora).estado, "atrasada");
    assert.equal(limiteDeEntrega(reaberta), agora + 2 * H);
  });
});

// ---------- Fase 5 ----------
const ts = v => ({ toMillis: () => v, toDate: () => new Date(v) });

describe("prazo digitado (data + hora) sempre em Brasília", () => {
  test("20/11/2026 23:59 de Brasília = 21/11 02:59 em UTC; e volta igual", () => {
    const v = msDeCampos("2026-11-20", "23:59");
    assert.equal(v, Date.UTC(2026, 10, 21, 2, 59));
    assert.deepEqual(camposDeMs(v), { data: "2026-11-20", hora: "23:59" });
  });
  test("campos vazios ou errados viram NaN", () => {
    assert.ok(Number.isNaN(msDeCampos("", "23:59")));
    assert.ok(Number.isNaN(msDeCampos("2026-11-20", "")));
  });
  test("recibo 'dd/mm às hh:mm'", () => {
    assert.equal(diaMesHora(Date.UTC(2026, 10, 12, 0, 30)), "11/11 às 21:30");
  });
});

describe("desfazer em até 4h", () => {
  const agora = Date.UTC(2026, 10, 11, 15, 0);
  test("resta 2h 10min; depois de 4h, nada", () => {
    assert.equal(restanteParaDesfazer({ entregueEm: ts(agora - (H + 50 * 60e3)) }, agora), 2 * H + 10 * 60e3);
    assert.equal(duracao(restanteParaDesfazer({ entregueEm: ts(agora - (H + 50 * 60e3)) }, agora)), "2h 10min");
    assert.equal(restanteParaDesfazer({ entregueEm: ts(agora - 5 * H) }, agora), 0);
    assert.equal(restanteParaDesfazer(null, agora), 0);
  });
});

describe("validação dos formulários", () => {
  test("nota máxima: vírgula ou ponto, vazio = sem nota; fora de 0-100 recusa", () => {
    assert.deepEqual(lerNotaMaxima("8,5"), { valor: 8.5 });
    assert.deepEqual(lerNotaMaxima("10"), { valor: 10 });
    assert.deepEqual(lerNotaMaxima("  "), { valor: null });
    assert.ok(lerNotaMaxima("0").erro); assert.ok(lerNotaMaxima("101").erro); assert.ok(lerNotaMaxima("dez").erro);
  });
  test("link: só http(s), sem espaços", () => {
    assert.ok(linkValido("https://exemplo.com/a?b=1"));
    assert.ok(!linkValido("exemplo.com")); assert.ok(!linkValido("javascript:alert(1)")); assert.ok(!linkValido("https://a b.com"));
  });
  test("rascunho guardado por pessoa + turma + atividade", () => {
    assert.equal(chaveRascunho("u1", "t1", "a1"), "fatesck-rascunho:u1:t1:a1");
  });
});

describe("ordem das listas de atividades", () => {
  test("abertas primeiro (a que fecha antes no topo), encerradas depois (mais recente no topo)", () => {
    const agora = Date.UTC(2026, 10, 11, 15, 0);
    const at = (id, prazo) => ({ id, prazo: ts(prazo) });
    const lista = [at("enc-velha", agora - 10 * 24 * H), at("aberta-longe", agora + 5 * 24 * H), at("enc-nova", agora - 2 * 24 * H),
      at("atrasada", agora - 2 * H), at("aberta-perto", agora + 3 * H)];
    assert.deepEqual(ordenarAtividades(lista, agora).map(a => a.id), ["aberta-perto", "atrasada", "aberta-longe", "enc-nova", "enc-velha"]);
  });
});

// ---------- Fase 6 ----------
import { lerNota, formatarNota, media, tituloDaFolha, idFolhaDaAtividade } from "../public/js/utils/notas-util.js";

describe("notas: digitar, mostrar e média", () => {
  test("aceita vírgula ou ponto, até 2 casas; vazio = sem nota; fora da faixa recusa", () => {
    assert.deepEqual(lerNota("8,5"), { valor: 8.5 });
    assert.deepEqual(lerNota("7.25", 10), { valor: 7.25 });
    assert.deepEqual(lerNota(" "), { valor: null });
    assert.ok(lerNota("11", 10).erro); assert.ok(lerNota("-1").erro); assert.ok(lerNota("oito").erro); assert.ok(lerNota("8,555").erro);
    assert.deepEqual(lerNota("12", 12), { valor: 12 });
  });
  test("mostra com vírgula", () => {
    assert.equal(formatarNota(8.5), "8,5"); assert.equal(formatarNota(7), "7"); assert.equal(formatarNota(null), "");
  });
  test("média só de quem tem nota, 1 casa", () => {
    assert.equal(media([8, 5.5, 7.5]), 7);
    assert.equal(media([10, 9, 8, undefined]), 9);
    assert.equal(media([]), null);
    assert.equal(formatarNota(media([7, 8])), "7,5");
  });
  test("folha da atividade: id fixo e título até 80 caracteres", () => {
    assert.equal(idFolhaDaAtividade("bd-lista3"), "atv_bd-lista3");
    assert.equal(tituloDaFolha("x".repeat(120)).length, 80);
    assert.equal(tituloDaFolha("Lista 3"), "Lista 3");
  });
});

// ---------- Fase 7a ----------
import { readFileSync } from "node:fs";
import { ACOES, nomeDaAcao, opcoesDeAcao } from "../public/js/utils/auditoria-util.js";

describe("registro de alterações: nome em português de cada ação", () => {
  test("toda ação aceita pelas regras tem nome em português (e nenhuma sobra)", () => {
    const regras = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const bloco = regras.match(/d\.acao in \[([^\]]+)\]/)[1];
    const nasRegras = [...bloco.matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort();
    assert.deepEqual(Object.keys(ACOES).sort(), nasRegras);
  });
  test("ação desconhecida aparece como está; filtro em ordem alfabética", () => {
    assert.equal(nomeDaAcao("notas_apagadas"), "Folha de notas apagada");
    assert.equal(nomeDaAcao("xyz"), "xyz");
    const nomes = opcoesDeAcao().map(o => o[1]);
    assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
});
