// Inicializa o Firebase direto do CDN (sem npm/bundler).
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { configDemo } from "./config-demo.js";

// Configuração real (produção). Só é usada fora do localhost.
const firebaseConfig = {
  apiKey: "AIzaSyAjGT0ffgKy3HM0cb0p8J98i_eX4suzmDk",
  authDomain: "fatesk-3819c.firebaseapp.com",
  projectId: "fatesk-3819c",
  storageBucket: "fatesk-3819c.firebasestorage.app",
  messagingSenderId: "221479971789",
  appId: "1:221479971789:web:8e49d82840cba9cf3ab284",
  measurementId: "G-3N62JZV09F"
};

// Desenvolvimento: em localhost/127.0.0.1 o site fala SOMENTE com o Emulador do Firebase,
// usando o projeto falso "demo-fatesck" (mesmo de .firebaserc e scripts/config.mjs).
// Assim nenhum teste local chega ao projeto real.
export const emulador = ["localhost", "127.0.0.1"].includes(location.hostname);
const configEmulador = { apiKey: "demo-chave-local", authDomain: "demo-fatesck.firebaseapp.com", projectId: "demo-fatesck" };

// Demonstração temporária: no Vercel (*.vercel.app) o site usa SOMENTE o projeto de demonstração
// (js/config-demo.js). Nunca cai no projeto real: sem a configuração de demonstração, para com erro.
export const demonstracao = location.hostname.endsWith(".vercel.app");
if (demonstracao && (!configDemo || configDemo.projectId === firebaseConfig.projectId)) {
  throw new Error("Configuração de demonstração ausente ou inválida em js/config-demo.js.");
}

export const app = initializeApp(emulador ? configEmulador : demonstracao ? configDemo : firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (emulador) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
