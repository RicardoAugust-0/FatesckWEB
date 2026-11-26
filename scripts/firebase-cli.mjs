// Roda o firebase-tools local (node_modules) sempre no projeto falso "demo-fatesck".
// O emulador do Firestore precisa de Java (JDK 21+). Se o Java não estiver no PATH,
// procuramos em locais comuns e ajustamos o PATH só deste processo (nada é alterado no sistema).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJETO } from "./config.mjs";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(RAIZ, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const BLOQUEADOS = ["deploy", "login", "use", "init", "hosting:channel:deploy", "firestore:delete"];

function javaFunciona(env) {
  const r = spawnSync("java", ["-version"], { env, stdio: "ignore" });
  return r.status === 0;
}

function pastasDeJava() {
  const pastas = [];
  if (process.env.JAVA_HOME) pastas.push(join(process.env.JAVA_HOME, "bin"));
  const bases = [
    "C:\\Program Files\\Java", "C:\\Program Files\\Eclipse Adoptium", "C:\\Program Files\\Microsoft",
    "C:\\Program Files\\Zulu", "C:\\Program Files\\Android\\openjdk", "/usr/lib/jvm", "/Library/Java/JavaVirtualMachines"
  ];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const nome of readdirSync(base).sort().reverse()) {
      pastas.push(join(base, nome, "bin"), join(base, nome, "Contents", "Home", "bin"));
    }
  }
  pastas.push("C:\\Program Files\\Android\\Android Studio\\jbr\\bin");
  const exe = process.platform === "win32" ? "java.exe" : "java";
  return pastas.filter(p => existsSync(join(p, exe)));
}

// Devolve as variáveis de ambiente com o Java disponível, ou encerra com instruções.
export function ambienteComJava() {
  const env = { ...process.env };
  if (javaFunciona(env)) return env;
  for (const pasta of pastasDeJava()) {
    const tentativa = { ...env };
    const chave = Object.keys(tentativa).find(k => k.toUpperCase() === "PATH") || "PATH";
    tentativa[chave] = pasta + delimiter + (tentativa[chave] || "");
    if (javaFunciona(tentativa)) { console.log("[fatesck] Usando Java de: " + pasta); return tentativa; }
  }
  console.error("\n[fatesck] Java não encontrado. O emulador do Firestore precisa do JDK 21 ou mais novo.");
  console.error("Instale o JDK (por exemplo o Temurin 21, em https://adoptium.net) e rode o comando de novo.\n");
  process.exit(1);
}

// Inicia o firebase-tools com os argumentos dados. Devolve o processo filho.
export function rodarFirebase(args) {
  if (BLOQUEADOS.includes(args[0])) {
    console.error("[fatesck] Comando bloqueado neste projeto de desenvolvimento: firebase " + args[0]);
    process.exit(1);
  }
  return spawn(process.execPath, [CLI, ...args, "--project", PROJETO], { cwd: RAIZ, env: ambienteComJava(), stdio: "inherit" });
}

// Uso direto: node scripts/firebase-cli.mjs emulators:exec ...
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  rodarFirebase(process.argv.slice(2)).on("exit", codigo => process.exit(codigo ?? 1));
}
