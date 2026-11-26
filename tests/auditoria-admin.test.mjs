// Registro de alterações: só acrescenta, só o admin lê, e não aceita registro falso.
import { describe, test } from "node:test";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, Timestamp } from "firebase/firestore";
import { prepararTestes, como, ok, nega, agora, NOMES } from "./apoio.mjs";

prepararTestes();

const reg = (uid, extra = {}) => ({ acao: "aviso_editado", autorUid: uid, autorNome: NOMES[uid], alvo: "turmas/turma-a/avisos/v1", detalhes: "", criadoEm: agora(), ...extra });

describe("registro de alterações", () => {
  test("só o admin lê", async () => {
    await ok(getDocs(collection(como("admin-1"), "auditoria")));
    await ok(getDoc(doc(como("admin-1"), "auditoria/reg-1")));
    await nega(getDocs(collection(como("prof-a"), "auditoria")));
    await nega(getDoc(doc(como("prof-a"), "auditoria/reg-1")));
    await nega(getDocs(collection(como("aluno-1"), "auditoria")));
  });
  test("ninguém altera nem apaga (nem o admin)", async () => {
    await nega(updateDoc(doc(como("admin-1"), "auditoria/reg-1"), { detalhes: "alterado" }));
    await nega(deleteDoc(doc(como("admin-1"), "auditoria/reg-1")));
    await nega(deleteDoc(doc(como("prof-a"), "auditoria/reg-1")));
    await nega(setDoc(doc(como("prof-a"), "auditoria/reg-1"), reg("prof-a")));
  });
  test("registro em nome de outra pessoa, com nome falso ou hora do aparelho: recusado", async () => {
    await nega(setDoc(doc(como("prof-a"), "auditoria/r"), reg("prof-a", { autorUid: "prof-b" })));
    await nega(setDoc(doc(como("prof-a"), "auditoria/r"), reg("prof-a", { autorNome: "Administração" })));
    await nega(setDoc(doc(como("prof-a"), "auditoria/r"), reg("prof-a", { criadoEm: Timestamp.now() })));
    await nega(setDoc(doc(como("prof-a"), "auditoria/r"), reg("prof-a", { acao: "inventada" })));
    await nega(setDoc(doc(como("prof-a"), "auditoria/r"), reg("prof-a", { extra: 1 })));
  });
  test("aluno comum não cria registro; representante só para os próprios avisos", async () => {
    await nega(setDoc(doc(como("aluno-1"), "auditoria/r"), reg("aluno-1")));
    await ok(setDoc(doc(como("rep-1"), "auditoria/r"), reg("rep-1", { alvo: "avisosCurso/c-rep" })));
    await nega(setDoc(doc(como("rep-1"), "auditoria/r2"), reg("rep-1", { acao: "turma_arquivada" })));
  });
  test("professor pendente não cria registro", async () => {
    await nega(setDoc(doc(como("prof-p"), "auditoria/r"), reg("prof-p")));
  });
});
