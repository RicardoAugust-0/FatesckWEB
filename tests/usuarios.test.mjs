// Perfis, e-mail institucional, verificação de e-mail, aprovação de professor, admins e leituras.
import { describe, test } from "node:test";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, Timestamp } from "firebase/firestore";
import { prepararTestes, como, visitante, ok, nega, agora, registrar, lote, NOMES } from "./apoio.mjs";

prepararTestes();

const perfil = (uid, extra = {}) => ({ nome: "Pessoa Nova", email: `${uid}@aluno.cps.sp.gov.br`, perfil: "aluno", status: "ativo", criadoEm: agora(), ...extra });

describe("cadastro (usuarios/{uid})", () => {
  test("aluno novo cria o próprio perfil, mesmo antes de verificar o e-mail", async () => {
    await ok(setDoc(doc(como("novo", { verificado: false }), "usuarios/novo"), perfil("novo")));
  });
  test("professor novo cria perfil pendente", async () => {
    await ok(setDoc(doc(como("novo"), "usuarios/novo"), perfil("novo", { perfil: "professor", status: "pendente" })));
  });
  test("ninguém cria perfil de professor já ativo", async () => {
    await nega(setDoc(doc(como("novo"), "usuarios/novo"), perfil("novo", { perfil: "professor", status: "ativo" })));
  });
  test("ninguém cria perfil 'admin' nem aluno pendente", async () => {
    await nega(setDoc(doc(como("novo"), "usuarios/novo"), perfil("novo", { perfil: "admin" })));
    await nega(setDoc(doc(como("novo"), "usuarios/novo"), perfil("novo", { status: "pendente" })));
  });
  // Domínio institucional: exatamente cps.sp.gov.br ou um subdomínio dele (não um simples "termina com").
  const cadastrarCom = e => setDoc(doc(como("novo", { emailToken: e }), "usuarios/novo"), perfil("novo", { email: e }));
  for (const e of ["novo@aluno.cps.sp.gov.br", "novo@cps.sp.gov.br", "novo@fatec.aluno.cps.sp.gov.br"]) {
    test(`e-mail institucional aceito: ${e}`, async () => { await ok(cadastrarCom(e)); });
  }
  for (const e of ["novo@evilcps.sp.gov.br", "novo@cps.sp.gov.br.fake.com", "novo@gmail.com", "novo@fatec.sp.gov.br",
                   "novo@aluno.cps.sp.gov.br@gmail.com", "novo@xcps.sp.gov.br", "novo@cps-sp.gov.br", "novo@.cps.sp.gov.br"]) {
    test(`e-mail não institucional recusado: ${e}`, async () => { await nega(cadastrarCom(e)); });
  }
  test("e-mail diferente do e-mail do login é recusado", async () => {
    await nega(setDoc(doc(como("novo"), "usuarios/novo"), perfil("novo", { email: "outro@aluno.cps.sp.gov.br" })));
  });
  test("não cria perfil de outra pessoa", async () => {
    await nega(setDoc(doc(como("novo"), "usuarios/outro"), perfil("outro")));
  });
  test("nome só com espaços, campo extra ou hora do aparelho são recusados", async () => {
    const db = como("novo");
    await nega(setDoc(doc(db, "usuarios/novo"), perfil("novo", { nome: "    " })));
    await nega(setDoc(doc(db, "usuarios/novo"), perfil("novo", { extra: 1 })));
    await nega(setDoc(doc(db, "usuarios/novo"), perfil("novo", { criadoEm: Timestamp.now() })));
  });
  test("visitante sem login não cria nada", async () => {
    await nega(setDoc(doc(visitante(), "usuarios/x"), perfil("x")));
  });
});

describe("ninguém muda o próprio perfil/status", () => {
  test("aluno não vira professor", async () => {
    await nega(updateDoc(doc(como("aluno-1"), "usuarios/aluno-1"), { perfil: "professor" }));
  });
  test("professor pendente não se aprova", async () => {
    await nega(updateDoc(doc(como("prof-p"), "usuarios/prof-p"), { status: "ativo" }));
  });
  test("aluno não muda o próprio nome nem apaga o perfil", async () => {
    await nega(updateDoc(doc(como("aluno-1"), "usuarios/aluno-1"), { nome: "Outro Nome" }));
    await nega(deleteDoc(doc(como("aluno-1"), "usuarios/aluno-1")));
  });
});

describe("leitura de perfis", () => {
  test("cada um lê o próprio perfil, não o de outra pessoa", async () => {
    await ok(getDoc(doc(como("aluno-1"), "usuarios/aluno-1")));
    await nega(getDoc(doc(como("aluno-1"), "usuarios/aluno-2")));
    await nega(getDoc(doc(como("prof-a"), "usuarios/aluno-1")));
  });
  test("lista de usuários e de professores pendentes: só o admin", async () => {
    const pendentes = db => getDocs(query(collection(db, "usuarios"), where("status", "==", "pendente")));
    await ok(pendentes(como("admin-1")));
    await nega(pendentes(como("prof-a")));
    await nega(pendentes(como("aluno-1")));
    await nega(getDocs(collection(como("prof-a"), "usuarios")));
  });
});

describe("e-mail não verificado", () => {
  test("sem verificar o e-mail não lê turma, não entra por código, não lê código", async () => {
    const db = como("aluno-1", { verificado: false });
    await nega(getDoc(doc(db, "turmas/turma-a")));
    await nega(getDoc(doc(db, "turmas/turma-a/atividades/atv-aberta")));
    await nega(getDoc(doc(db, "codigos/ABCD2345")));
    const novo = como("aluno-sem", { verificado: false });
    await nega(setDoc(doc(novo, "turmas/turma-a/membros/aluno-sem"),
      { uid: "aluno-sem", nome: NOMES["aluno-sem"], papel: "aluno", entrouEm: agora(), codigo: "ABCD2345" }));
  });
});

describe("aprovação de professor (admin)", () => {
  const aprovar = (db, uid, comRegistro = true) => {
    const b = lote(db);
    b.update(doc(db, "usuarios", uid), { status: "ativo", aprovadoEm: agora(), aprovadoPor: "admin-1" });
    if (comRegistro) registrar(b, db, "aprovacao_" + uid, "admin-1", "professor_aprovado", "usuarios/" + uid);
    return b.commit();
  };
  test("admin aprova professor pendente, com registro", async () => {
    await ok(aprovar(como("admin-1"), "prof-p"));
  });
  test("aprovação sem registro é recusada", async () => {
    await nega(aprovar(como("admin-1"), "prof-p", false));
  });
  test("professor ativo não aprova outro professor", async () => {
    const db = como("prof-a");
    await nega(updateDoc(doc(db, "usuarios/prof-p"), { status: "ativo", aprovadoEm: agora(), aprovadoPor: "prof-a" }));
  });
  test("admin não 'aprova' aluno nem muda perfil", async () => {
    await nega(updateDoc(doc(como("admin-1"), "usuarios/aluno-1"), { perfil: "professor" }));
  });
});

describe("admins/{uid}", () => {
  test("admin lê o próprio documento; outros não; ninguém escreve", async () => {
    await ok(getDoc(doc(como("admin-1"), "admins/admin-1")));
    await nega(getDoc(doc(como("aluno-1"), "admins/admin-1")));
    await nega(setDoc(doc(como("aluno-1"), "admins/aluno-1"), { nome: "Eu", email: "aluno-1@aluno.cps.sp.gov.br" }));
    await nega(setDoc(doc(como("admin-1"), "admins/prof-a"), { nome: "X", email: "x@cps.sp.gov.br" }));
  });
});

describe("leituras (badges)", () => {
  test("o dono grava e lê as próprias leituras com hora do servidor", async () => {
    const db = como("aluno-1");
    await ok(setDoc(doc(db, "usuarios/aluno-1/leituras/turma_turma-a_chat"), { vistoEm: agora() }));
    await ok(getDoc(doc(db, "usuarios/aluno-1/leituras/turma_turma-a_chat")));
    await ok(setDoc(doc(db, "usuarios/aluno-1/leituras/curso_avisos"), { vistoEm: agora() }));
  });
  test("ninguém grava nas leituras de outra pessoa; chave, hora e campos inválidos são recusados", async () => {
    await nega(setDoc(doc(como("aluno-2"), "usuarios/aluno-1/leituras/turma_turma-a_chat"), { vistoEm: agora() }));
    const db = como("aluno-1");
    await nega(setDoc(doc(db, "usuarios/aluno-1/leituras/qualquer_coisa"), { vistoEm: agora() }));
    await nega(setDoc(doc(db, "usuarios/aluno-1/leituras/curso_avisos"), { vistoEm: Timestamp.now() }));
    await nega(setDoc(doc(db, "usuarios/aluno-1/leituras/curso_avisos"), { vistoEm: agora(), x: 1 }));
  });
});
