import { sessaoAtual, destino } from "../js/auth.js";

// Os botões funcionam na hora (antes, só depois que o Firebase respondia).
document.getElementById("btn-aluno").addEventListener("click", () => window.location.href = "../login_aluno/index.html");
document.getElementById("btn-professor").addEventListener("click", () => window.location.href = "../login_professor/index.html");

// Se já existe sessão completa, vai direto para o lugar certo.
try {
  const sessao = await sessaoAtual();
  if (sessao && (sessao.admin || sessao.perfil)) window.location.replace(destino(sessao, ".."));
} catch (e) { console.error(e); }
