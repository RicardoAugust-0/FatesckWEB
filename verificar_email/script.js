// "Confirme seu e-mail": as regras só liberam o sistema depois que o e-mail institucional é confirmado.
import { auth } from "../js/firebase.js";
import { reload } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { usuarioAtual, carregarSessao, destino, reenviarVerificacao, mensagemDeErro, sair } from "../js/auth.js";
import { el, mensagem } from "../js/ui.js";

const $ = id => document.getElementById(id);
const erro = $("erro"), status = $("status"), btnConfirmei = $("btn-confirmei"), btnReenviar = $("btn-reenviar");
const ESPERA = 60; // segundos entre reenvios
let restante = 0, relogio = null, conferindo = false;

// Botões funcionam desde já
$("btn-sair").addEventListener("click", () => sair(".."));
btnConfirmei.addEventListener("click", () => conferir(true));
btnReenviar.addEventListener("click", async () => {
  mensagem(erro); mensagem(status);
  btnReenviar.disabled = true;
  try {
    await reenviarVerificacao();
    mensagem(status, "Enviamos um novo link. Pode levar alguns minutos para chegar.");
    iniciarEspera();
  } catch (e) {
    console.error(e);
    mensagem(erro, e.code === "auth/too-many-requests" ? "Muitos envios seguidos. Espere alguns minutos e tente de novo." : mensagemDeErro(e));
    btnReenviar.disabled = false;
  }
});

function iniciarEspera() {
  restante = ESPERA;
  clearInterval(relogio);
  const passo = () => {
    btnReenviar.disabled = restante > 0;
    btnReenviar.textContent = restante > 0 ? `Reenviar e-mail (${restante}s)` : "Reenviar e-mail";
    if (restante-- <= 0) clearInterval(relogio);
  };
  passo();
  relogio = setInterval(passo, 1000);
}

// Confere se o e-mail já foi confirmado. manual = a pessoa clicou em "Já confirmei".
async function conferir(manual = false) {
  if (conferindo || !auth.currentUser) return;
  conferindo = true;
  if (manual) { mensagem(erro); mensagem(status); btnConfirmei.disabled = true; }
  try {
    await reload(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true); // atualiza o "crachá" para as regras enxergarem a confirmação
      const s = await carregarSessao(auth.currentUser);
      mensagem(status, "E-mail confirmado! Entrando…");
      window.location.replace(destino(s, ".."));
      return;
    }
    if (manual) mensagem(erro, "Ainda não recebemos a confirmação. Abra o link do e-mail e tente de novo.");
  } catch (e) {
    console.error(e);
    if (manual) mensagem(erro, mensagemDeErro(e));
  } finally {
    conferindo = false;
    btnConfirmei.disabled = false;
  }
}

const user = await usuarioAtual();
if (!user) {
  window.location.replace("../inicio/index.html");
} else {
  $("texto").replaceChildren("Enviamos um link de confirmação para ", el("b", {}, user.email), ". Abra o link e volte aqui.");
  if (new URLSearchParams(location.search).has("enviado")) iniciarEspera();
  if (user.emailVerified) conferir();
  $("checando").hidden = false;
  setInterval(() => { if (!document.hidden) conferir(); }, 10000);
}
