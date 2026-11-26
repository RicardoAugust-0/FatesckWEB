// npm run links — mostra os links de "confirmar e-mail" e "nova senha" gerados pelo emulador.
// No emulador nenhum e-mail é enviado de verdade: o link fica guardado aqui (e aparece no terminal do "npm run emulators").
// Abra o link no navegador para confirmar o e-mail ou definir uma senha nova.
import { HOST, PORTA_AUTH, PROJETO } from "./config.mjs";

const TIPOS = { VERIFY_EMAIL: "Confirmar e-mail", PASSWORD_RESET: "Nova senha", EMAIL_SIGNIN: "Entrar por link" };

try {
  const r = await fetch(`http://${HOST}:${PORTA_AUTH}/emulator/v1/projects/${PROJETO}/oobCodes`);
  if (!r.ok) throw new Error("status " + r.status);
  const { oobCodes = [] } = await r.json();
  if (!oobCodes.length) {
    console.log("\nNenhum link gerado ainda. Faça um cadastro, clique em \"Reenviar e-mail\" ou em \"Esqueci minha senha\" e rode de novo.\n");
  } else {
    console.log("\nLinks gerados pelo emulador (do mais antigo para o mais novo):\n");
    for (const c of oobCodes) {
      // No emulador, o link de nova senha não abre um formulário: a senha nova vai no próprio link.
      const link = c.requestType === "PASSWORD_RESET" ? c.oobLink + "&newPassword=DIGITE_A_NOVA_SENHA" : c.oobLink;
      console.log(`  ${TIPOS[c.requestType] ?? c.requestType} — ${c.email}\n  ${link}\n`);
    }
    if (oobCodes.some(c => c.requestType === "PASSWORD_RESET"))
      console.log("Nova senha: troque DIGITE_A_NOVA_SENHA pela senha desejada (mínimo 6 caracteres) antes de abrir o link.");
    console.log("Cada link só funciona uma vez. Se um link de confirmação falhar, use o mais novo da mesma pessoa.\n");
  }
} catch (e) {
  console.error("\n[links] Os emuladores não estão rodando. Rode \"npm run emulators\" em outro terminal.\n");
  process.exitCode = 1;
}
