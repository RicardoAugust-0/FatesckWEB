// Validação geral: em todas as coleções, campo desconhecido, tipo errado, texto grande demais
// ou só com espaços são recusados. Cada caso tem uma versão válida que PASSA, para provar que a recusa
// vem só do defeito inserido.
import { describe, test } from "node:test";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { prepararTestes, como, visitante, ok, nega, agora, NOMES, em, DIA } from "./apoio.mjs";

prepararTestes();

const grande = n => "x".repeat(n);

// [nome, quem escreve, caminho, documento válido, defeitos]
const CASOS = [
  ["perfil (usuarios)", "novo", "usuarios/novo",
    () => ({ nome: "Pessoa Nova", email: "novo@aluno.cps.sp.gov.br", perfil: "aluno", status: "ativo", criadoEm: agora() }),
    { extra: { x: 1 }, tipo: { nome: 123 }, grande: { nome: grande(81) }, espacos: { nome: "  " } }],
  ["atividade", "prof-a", "turmas/turma-a/atividades/nova",
    () => ({ titulo: "Lista", prazo: em(DIA), autorUid: "prof-a", criadoEm: agora() }),
    { extra: { cor: "red" }, tipo: { prazo: "amanhã" }, grande: { titulo: grande(121) }, espacos: { titulo: "   " } }],
  ["entrega", "aluno-1", "turmas/turma-a/atividades/atv-aberta/entregas/aluno-1",
    () => ({ texto: "ok", entregueEm: agora(), atrasada: false, alunoUid: "aluno-1", alunoNome: NOMES["aluno-1"], corrigida: false }),
    { extra: { nota: 10 }, tipo: { texto: 42 }, grande: { texto: grande(5001) }, espacos: { texto: " " } }],
  ["mensagem do chat", "aluno-1", "turmas/turma-a/mensagens/nova",
    () => ({ texto: "Oi", autorUid: "aluno-1", autorNome: NOMES["aluno-1"], autorPapel: "aluno", criadoEm: agora() }),
    { extra: { html: "<b>" }, tipo: { texto: ["a"] }, grande: { texto: grande(2001) }, espacos: { texto: "\n " } }],
  ["aviso da turma", "prof-a", "turmas/turma-a/avisos/novo",
    () => ({ texto: "Aviso", autorUid: "prof-a", autorNome: NOMES["prof-a"], autorPapel: "professor", criadoEm: agora() }),
    { extra: { fixo: true }, tipo: { texto: 1 }, grande: { texto: grande(2001) }, espacos: { texto: "  " } }],
  ["aviso do curso", "rep-1", "avisosCurso/novo",
    () => ({ texto: "Aviso", autorUid: "rep-1", autorNome: NOMES["rep-1"], autorPapel: "representante", criadoEm: agora() }),
    { extra: { fixo: true }, tipo: { texto: false }, grande: { texto: grande(2001) }, espacos: { texto: "   " } }],
  ["folha de notas", "prof-a", "turmas/turma-a/notas/nova",
    () => ({ titulo: "P2", notaMax: 10, publicada: false, autorUid: "prof-a", criadoEm: agora() }),
    { extra: { peso: 2 }, tipo: { notaMax: "10" }, grande: { titulo: grande(81) }, espacos: { titulo: " " } }],
  ["nota (item)", "prof-a", "turmas/turma-a/notas/prova1/itens/aluno-2",
    () => ({ valor: 8, comentario: "Bom", atualizadoEm: agora() }),
    { extra: { media: 8 }, tipo: { valor: "8" }, grande: { comentario: grande(501) }, espacos: { comentario: "  " } }],
  ["turma", "prof-a", null, null, null], // coberta em turmas-codigos-membros (precisa de lote)
  ["leitura (badge)", "aluno-1", "usuarios/aluno-1/leituras/curso_avisos",
    () => ({ vistoEm: agora() }),
    { extra: { x: 1 }, tipo: { vistoEm: "agora" } }],
  ["conversa", "aluno-2", "conversas/prof-a_aluno-2",
    () => ({ professorUid: "prof-a", alunoUid: "aluno-2", participantes: ["prof-a", "aluno-2"], professorNome: NOMES["prof-a"],
             alunoNome: NOMES["aluno-2"], turmaId: "turma-a", criadoEm: agora(), atualizadoEm: agora() }),
    { extra: { assunto: "x" }, tipo: { participantes: "prof-a,aluno-2" } }],
  ["mensagem privada", "aluno-1", "conversas/prof-a_aluno-1/mensagens/nova",
    () => ({ texto: "Oi", autorUid: "aluno-1", autorNome: NOMES["aluno-1"], criadoEm: agora() }),
    { extra: { lida: true }, tipo: { texto: 1 }, grande: { texto: grande(2001) }, espacos: { texto: " " } }],
  ["pedido de entrada", "aluno-sem", "turmas/turma-a/pedidos/aluno-sem",
    () => ({ uid: "aluno-sem", nome: NOMES["aluno-sem"], turmaNome: "Turma turma-a", turmaCor: "#A61C24", codigo: "ABCD2345", status: "pendente", pedidoEm: agora() }),
    { extra: { admin: true }, tipo: { status: 1 } }]
].filter(c => c[2]);

describe("validação de campos em todas as coleções", () => {
  for (const [nome, uid, caminho, valido, defeitos] of CASOS) {
    test(`${nome}: versão válida é aceita`, async () => {
      await ok(setDoc(doc(como(uid), caminho), valido()));
    });
    for (const [tipo, defeito] of Object.entries(defeitos)) {
      test(`${nome}: ${{ extra: "campo desconhecido", tipo: "tipo errado", grande: "texto grande demais", espacos: "texto só com espaços" }[tipo]} é recusado`, async () => {
        await nega(setDoc(doc(como(uid), caminho), { ...valido(), ...defeito }));
      });
    }
  }
});

describe("negação por padrão", () => {
  test("coleção que não existe nas regras: ninguém lê nem escreve", async () => {
    await nega(getDoc(doc(como("admin-1"), "qualquer/x")));
    await nega(setDoc(doc(como("admin-1"), "qualquer/x"), { a: 1 }));
    await nega(getDoc(doc(como("prof-a"), "disciplinas/x")));
    await nega(getDoc(doc(como("aluno-1"), "envios/x")));
  });
  test("visitante sem login não lê nada", async () => {
    const db = visitante();
    await nega(getDoc(doc(db, "turmas/turma-a")));
    await nega(getDoc(doc(db, "avisosCurso/c-adm")));
    await nega(getDoc(doc(db, "codigos/ABCD2345")));
    await nega(getDoc(doc(db, "representantes/rep-1")));
  });
});
