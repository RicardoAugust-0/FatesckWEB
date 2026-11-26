// "Aguardando liberação": professor cadastrado que a administração ainda não aprovou.
// Enquanto estiver pendente, as regras não deixam ele fazer nada de professor.
import { usuarioAtual, carregarSessao, destino, mensagemDeErro, sair } from "../js/core/auth.js";
import { mensagem } from "../js/ui/ui.js";

const $ = id => document.getElementById(id);
const erro = $("erro"), status = $("status"), btn = $("btn-verificar");
const AQUI = "../aguardando_liberacao/index.html";
let conferindo = false;

$("btn-sair").addEventListener("click", () => sair(".."));
btn.addEventListener("click", () => conferir(true));

async function conferir(manual = false) {
  if (conferindo) return;
  conferindo = true;
  if (manual) { mensagem(erro); mensagem(status); btn.disabled = true; }
  try {
    const s = await carregarSessao(await usuarioAtual());
    const ir = destino(s, "..");
    if (ir !== AQUI) { window.location.replace(ir); return; }
    if (manual) mensagem(status, "Seu acesso ainda não foi liberado. Avisaremos aqui assim que for.");
  } catch (e) {
    console.error(e);
    if (manual) mensagem(erro, mensagemDeErro(e));
  } finally {
    conferindo = false;
    btn.disabled = false;
  }
}

await conferir();
setInterval(() => { if (!document.hidden) conferir(); }, 10000);
