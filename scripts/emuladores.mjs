// npm run emulators — sobe os emuladores (Authentication + Firestore + painel) e serve o site.
// Tudo local: projeto falso "demo-fatesck". Nada chega ao Firebase real.
import { RAIZ, rodarFirebase } from "./firebase-cli.mjs";
import { iniciarServidor } from "./servidor.mjs";
import { HOST, PORTA_SITE, PORTA_UI } from "./config.mjs";

let servidor;
try {
  servidor = await iniciarServidor(RAIZ);
} catch (e) {
  console.error(`[fatesck] Não foi possível abrir o site na porta ${PORTA_SITE}: ${e.code === "EADDRINUSE" ? "a porta já está em uso (os emuladores já estão rodando em outra janela?)" : e.message}`);
  process.exit(1);
}

console.log(`\n[fatesck] Site:               http://${HOST}:${PORTA_SITE}/`);
console.log(`[fatesck] Painel do emulador: http://${HOST}:${PORTA_UI}/`);
console.log("[fatesck] Em outro terminal, rode \"npm run seed\" para carregar os dados de teste.");
console.log("[fatesck] Para encerrar: Ctrl+C. Os dados do emulador são apagados ao encerrar.\n");

const filho = rodarFirebase(["emulators:start", "--only", "auth,firestore"]);
filho.on("exit", codigo => { servidor.close(); process.exit(codigo ?? 0); });
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => { /* o firebase-tools recebe o mesmo sinal e encerra os emuladores */ });
