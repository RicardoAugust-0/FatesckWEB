// npm run seed:demo — carrega os MESMOS dados de teste do emulador no projeto Firebase SÓ DE DEMONSTRAÇÃO
// (o projeto de js/config-demo.js), para a demonstração temporária no Vercel.
// Quem roda é o Fernando, no computador dele. Recusa o projeto real (fatesk-3819c).
//
// Precisa de uma chave de conta de serviço do projeto de demonstração (arquivo .json baixado no console:
// Configurações do projeto > Contas de serviço > Gerar nova chave privada). A chave é SEGREDO:
// guarde FORA desta pasta e informe o caminho na variável GOOGLE_APPLICATION_CREDENTIALS.
//
// ATENÇÃO: apaga todos os dados do projeto de demonstração e recria as contas de teste.
import { readFileSync, existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp as TimestampAdmin } from "firebase-admin/firestore";
import { Timestamp } from "firebase/firestore";
import { configDemo } from "../public/js/core/config-demo.js";
import { RAIZ } from "./firebase-cli.mjs";
import { montarEscritas, conferir, CONTAS, SENHA_TESTE, resumoContas } from "./seed.mjs";

const PROJETO_REAL = "fatesk-3819c";
const parar = msg => { console.error("\n[seed:demo] " + msg + "\n"); process.exit(1); };

// ----- conferências de segurança -----
if (!configDemo?.projectId) parar("Preencha public/js/core/config-demo.js com a configuração do projeto de demonstração.");
if (configDemo.projectId === PROJETO_REAL) parar("public/js/core/config-demo.js aponta para o projeto REAL. Use um projeto só de demonstração.");
const caminhoChave = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!caminhoChave || !existsSync(caminhoChave)) parar("Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho da chave .json do projeto de demonstração.");
const rel = relative(RAIZ, resolve(caminhoChave));
if (!rel.startsWith("..") && !isAbsolute(rel)) parar("A chave .json está DENTRO da pasta do projeto. Mova para fora (ela é segredo).");
const chave = JSON.parse(readFileSync(caminhoChave, "utf8"));
if (chave.project_id !== configDemo.projectId) parar(`A chave é do projeto "${chave.project_id}", mas public/js/core/config-demo.js é do "${configDemo.projectId}".`);
if (chave.project_id === PROJETO_REAL) parar("A chave é do projeto REAL. Use a chave do projeto de demonstração.");

conferir();
const app = initializeApp({ credential: cert(chave), projectId: configDemo.projectId });
const auth = getAuth(app), db = getFirestore(app);

// Converte os Timestamps do SDK web (usados no seed do emulador) para os do SDK de administração.
const converter = v => v instanceof Timestamp ? TimestampAdmin.fromMillis(v.toMillis())
  : Array.isArray(v) ? v.map(converter)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, converter(x)]))
  : v;

try {
  console.log(`[seed:demo] Projeto de demonstração: ${configDemo.projectId}`);
  // 1) apaga os dados antigos (todas as coleções do topo, com subcoleções)
  for (const colecao of await db.listCollections()) await db.recursiveDelete(colecao);
  // 2) recria as contas de teste (mesmos uids do emulador, e-mail já verificado)
  await auth.deleteUsers(CONTAS.map(c => c.uid));
  for (const c of CONTAS) {
    await auth.createUser({ uid: c.uid, email: c.email, password: SENHA_TESTE, displayName: c.nome, emailVerified: true });
  }
  // 3) grava os documentos
  const escritas = montarEscritas();
  for (let i = 0; i < escritas.length; i += 400) {
    const lote = db.batch();
    for (const [caminho, dados] of escritas.slice(i, i + 400)) lote.set(db.doc(caminho), converter(dados));
    await lote.commit();
  }
  console.log(`\n[seed:demo] Pronto: ${CONTAS.length} contas e ${escritas.length} documentos no projeto ${configDemo.projectId}.\n`);
  console.log(resumoContas());
} catch (e) {
  console.error("[seed:demo] Falhou:", e.message || e);
  process.exitCode = 1;
}
