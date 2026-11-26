// Autenticação: Firebase Auth (e-mail/senha) + perfil em usuarios/{uid} + admins/{uid}.
// Regras importantes (iguais às do firestore.rules):
//  - só e-mail institucional do CPS (…@cps.sp.gov.br ou subdomínio, ex.: @aluno.cps.sp.gov.br) pode se cadastrar;
//  - é preciso confirmar o e-mail antes de usar o sistema;
//  - professor nasce "pendente" e só entra depois que a administração libera;
//  - admin não se cadastra pelo site (documento admins/{uid} criado à mão) e entra por /admin/.
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
  sendEmailVerification, sendPasswordResetEmail, deleteUser
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { el, mensagem, ligarMostrarSenha } from "../ui/ui.js";

// Exatamente "cps.sp.gov.br" ou um subdomínio dele (ex.: aluno.cps.sp.gov.br). Mesma regra do firestore.rules.
// Não é um "termina com": "x@evilcps.sp.gov.br" e "x@cps.sp.gov.br.falso.com" são recusados.
export const emailInstitucional = email => /^[^@\s]+@([a-z0-9-]+\.)*cps\.sp\.gov\.br$/i.test(email);
export const DICA_EMAIL = "Use seu e-mail institucional, que termina em cps.sp.gov.br (por exemplo, nome@aluno.cps.sp.gov.br).";
const emailValido = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const MENSAGENS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Este e-mail já está cadastrado. Use \"Entrar\". Se o seu cadastro não terminou, ele será concluído quando você entrar.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/missing-email": "Digite seu e-mail.",
  "auth/user-disabled": "Esta conta foi desativada. Fale com a coordenação do curso.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com o servidor. Verifique sua internet e tente de novo.",
  "auth/requires-recent-login": "Por segurança, entre de novo e repita a operação.",
  "permission-denied": "Você não tem permissão para fazer isso.",
  "unavailable": "Sem conexão com o servidor. Verifique sua internet e tente de novo."
};
export const mensagemDeErro = e => MENSAGENS[e?.code] || "Não foi possível concluir. Tente novamente.";

export const AVISO_PRIVACIDADE = [
  "O Fatesck guarda seu nome, seu e-mail institucional, suas entregas, suas notas e suas mensagens, só para o funcionamento das aulas.",
  "A administração do curso pode ler as mensagens do chat (da turma e privadas) para moderação. As mensagens não são criptografadas de ponta a ponta."
];

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

// Usuário do Firebase Auth, depois que o SDK terminou de carregar a sessão salva.
export function usuarioAtual() {
  return new Promise(resolve => {
    const parar = onAuthStateChanged(auth, user => { parar(); resolve(user); });
  });
}

// Garante que o "crachá" (token) já diga que o e-mail foi confirmado, senão as regras recusam.
async function atualizarToken(user) {
  if (!user?.emailVerified) return;
  const t = await user.getIdTokenResult();
  if (!t.claims.email_verified) await user.getIdToken(true);
}

// { uid, email, emailVerificado, admin, nome, perfil, status } — perfil null = conta sem perfil (cadastro incompleto).
export async function carregarSessao(user) {
  if (!user) return null;
  await atualizarToken(user);
  const base = { uid: user.uid, email: user.email, emailVerificado: user.emailVerified };
  const admin = await getDoc(doc(db, "admins", user.uid));
  if (admin.exists()) return { ...base, admin: true, nome: admin.data().nome, perfil: "admin", status: "ativo" };
  const perfil = await getDoc(doc(db, "usuarios", user.uid));
  if (!perfil.exists()) return { ...base, admin: false, perfil: null };
  return { ...base, admin: false, ...perfil.data() };
}

export async function sessaoAtual() { return carregarSessao(await usuarioAtual()); }

// Para onde a pessoa deve ir, conforme a situação da conta. base = caminho até a raiz do site ("..").
export function destino(s, base) {
  if (!s) return base + "/inicio/index.html";
  if (s.admin) return base + "/admin/index.html";
  if (!s.perfil) return base + "/inicio/index.html";
  if (!s.emailVerificado) return base + "/verificar_email/index.html";
  if (s.perfil === "professor" && s.status !== "ativo") return base + "/aguardando_liberacao/index.html";
  return base + "/inicial_" + s.perfil + "/index.html";
}

// Usado pelas páginas internas: devolve a sessão se a pessoa pode estar aqui; senão redireciona.
export async function exigirPerfil(perfil, base) {
  let s = null;
  try { s = await sessaoAtual(); } catch (e) { console.error(e); }
  const certo = base + "/inicial_" + perfil + "/index.html";
  if (s && destino(s, base) === certo) return s;
  window.location.replace(destino(s, base));
  return null;
}

export async function sair(base) {
  try { await signOut(auth); } finally { window.location.replace(base + "/inicio/index.html"); }
}

// Cria o perfil (usuarios/{uid}). Aluno nasce ativo; professor nasce pendente (as regras exigem isso).
async function criarPerfil(user, perfil, nome) {
  await setDoc(doc(db, "usuarios", user.uid), {
    nome, email: user.email, perfil, status: perfil === "aluno" ? "ativo" : "pendente", criadoEm: serverTimestamp()
  });
}
// Sem internet o Firestore não dá erro: fica esperando a conexão. Por isso cada tentativa tem prazo.
function comPrazo(promessa, ms = 10000) {
  let relogio;
  const prazo = new Promise((_, falhar) => {
    relogio = setTimeout(() => falhar(Object.assign(new Error("tempo esgotado"), { code: "unavailable" })), ms);
  });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(relogio));
}
async function tentarDuasVezes(fn) {
  try { return await comPrazo(fn()); } catch (e) {
    console.warn("Primeira tentativa falhou, tentando de novo.", e);
    await new Promise(r => setTimeout(r, 800));
    return comPrazo(fn());
  }
}

export async function reenviarVerificacao() {
  if (!auth.currentUser) throw Object.assign(new Error("sem sessão"), { code: "auth/requires-recent-login" });
  await sendEmailVerification(auth.currentUser);
}

// ---------------------------------------------------------------------------
// Tela de login / cadastro / recuperar senha
// perfil: "aluno" | "professor" | "admin". Para o admin não existe cadastro.
// aoEntrarAdmin(sessao): só para /admin/ (mostra o painel em vez de redirecionar).
// ---------------------------------------------------------------------------
export function iniciarLogin(perfil, { aoEntrarAdmin } = {}) {
  const $ = id => document.getElementById(id);
  const form = $("form-login"), erro = $("erro"), status = $("status");
  const titulo = $("titulo"), subtitulo = $("subtitulo");
  const campoNome = $("campo-nome"), campoSenha = $("campo-senha"), aviso = $("aviso-privacidade"), aceite = $("aceite");
  const btnEnviar = $("btn-enviar"), btnAlternar = $("btn-alternar"), btnEsqueci = $("btn-esqueci"), btnVoltar = $("btn-voltar");
  const rotulo = { aluno: "Aluno", professor: "Professor", admin: "Administração" }[perfil];
  const outro = { aluno: "professor", professor: "aluno" };
  let modo = "entrar", ocupado = false;
  ligarMostrarSenha(form.senha);

  // Texto do aviso de privacidade (cadastro)
  if (aviso && !aviso.dataset.pronto) {
    aviso.prepend(el("h2", {}, "Aviso de privacidade"), ...AVISO_PRIVACIDADE.map(t => el("p", {}, t)));
    aviso.dataset.pronto = "1";
  }

  function trocarModo(novo) {
    modo = novo;
    mensagem(erro); mensagem(status);
    const cadastro = modo === "cadastro", recuperar = modo === "recuperar";
    campoNome.hidden = !cadastro;
    form.nome.required = cadastro;
    campoSenha.hidden = recuperar;
    form.senha.required = !recuperar;
    form.senha.autocomplete = cadastro ? "new-password" : "current-password";
    if (aviso) aviso.hidden = !cadastro;
    if (btnAlternar) btnAlternar.hidden = recuperar;
    btnEsqueci.hidden = modo !== "entrar";
    titulo.textContent = recuperar ? "Recuperar a senha" : perfil === "admin" ? "Administração" : (cadastro ? "Cadastro do " : "Login do ") + rotulo;
    subtitulo.textContent = recuperar
      ? "Digite seu e-mail. Vamos enviar um link para você criar uma senha nova."
      : perfil === "admin" ? "Acesso restrito à administração do curso." : "Use seu e-mail institucional (termina em cps.sp.gov.br).";
    btnEnviar.textContent = recuperar ? "Enviar link" : cadastro ? "Criar conta" : "Entrar";
    if (btnAlternar) btnAlternar.textContent = cadastro ? "Já tenho conta" : "Criar conta";
    if (btnVoltar) btnVoltar.textContent = recuperar ? "Voltar ao login" : "Voltar";
    if (btnVoltar && perfil === "admin") btnVoltar.hidden = !recuperar; // no /admin/ só existe "voltar ao login"
    atualizarBotao();
    (cadastro ? form.nome : form.email).focus();
  }
  function atualizarBotao() {
    btnEnviar.disabled = ocupado || (modo === "cadastro" && !aceite?.checked);
  }
  function ocupar(sim) { ocupado = sim; atualizarBotao(); }

  // Os botões funcionam desde já (antes de qualquer resposta do servidor).
  btnAlternar?.addEventListener("click", () => trocarModo(modo === "cadastro" ? "entrar" : "cadastro"));
  btnEsqueci.addEventListener("click", () => trocarModo("recuperar"));
  btnVoltar?.addEventListener("click", () => {
    if (modo === "recuperar") trocarModo("entrar");
    else window.location.href = "../inicio/index.html";
  });
  aceite?.addEventListener("change", atualizarBotao);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (ocupado) return;
    mensagem(erro); mensagem(status);
    const nome = form.nome.value.trim().replace(/\s+/g, " ");
    const email = form.email.value.trim().toLowerCase();
    const senha = form.senha.value;

    if (!email) return mensagem(erro, "Digite seu e-mail.");
    if (!emailValido(email)) return mensagem(erro, "Digite um e-mail válido.");
    if (modo === "cadastro") {
      if (nome.length < 2 || nome.length > 80) return mensagem(erro, "Digite seu nome completo (de 2 a 80 caracteres).");
      if (!emailInstitucional(email)) return mensagem(erro, DICA_EMAIL);
      if (senha.length < 6) return mensagem(erro, "A senha precisa ter pelo menos 6 caracteres.");
      if (!aceite?.checked) return mensagem(erro, "Para criar a conta, marque \"Li e concordo\" no aviso de privacidade.");
    } else if (modo === "entrar" && !senha) return mensagem(erro, "Digite sua senha.");

    ocupar(true);
    try {
      if (modo === "recuperar") await recuperar(email);
      else if (modo === "cadastro") await cadastrar(nome, email, senha);
      else await entrar(email, senha, nome);
    } catch (err) {
      console.error(err);
      mensagem(erro, mensagemDeErro(err));
    } finally { ocupar(false); }
  });

  async function recuperar(email) {
    try { await sendPasswordResetEmail(auth, email); }
    catch (err) { if (err.code !== "auth/user-not-found") throw err; } // mesma resposta, exista ou não a conta
    mensagem(status, "Se existir uma conta com este e-mail, enviamos um link para criar uma senha nova. Confira também a caixa de spam.");
  }

  async function cadastrar(nome, email, senha) {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    try { await updateProfile(cred.user, { displayName: nome }); } catch (e) { console.warn(e); }
    try {
      await tentarDuasVezes(() => criarPerfil(cred.user, perfil, nome));
    } catch (err) {
      // Correção da "conta órfã": se o perfil não foi gravado, desfaz a conta para o e-mail ficar livre.
      console.error(err);
      try {
        await deleteUser(cred.user);
        mensagem(erro, "Não foi possível concluir o cadastro. Nada foi salvo; tente novamente em instantes.");
      } catch (e2) {
        console.error(e2);
        await signOut(auth).catch(() => {});
        mensagem(erro, "Não foi possível concluir o cadastro agora. Quando você entrar com este e-mail e senha, o cadastro será concluído.");
      }
      return;
    }
    try { await sendEmailVerification(cred.user); } catch (e) { console.warn(e); } // dá para reenviar na próxima tela
    window.location.href = "../verificar_email/index.html?enviado=1";
  }

  async function entrar(email, senha, nomeDigitado) {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    let s = await carregarSessao(cred.user);

    if (perfil === "admin") {
      if (!s.admin) {
        await signOut(auth);
        return mensagem(erro, "Esta conta não tem acesso à administração. Alunos e professores entram pela página inicial do Fatesck.");
      }
      return aoEntrarAdmin?.(s);
    }
    if (s.admin) {
      await signOut(auth);
      return mensagem(erro, "Esta é a conta da administração. Entre pela página de administração (/admin/).");
    }
    if (!s.perfil) {
      // Conta sem perfil (cadastro anterior não terminou): conclui agora, com o tipo desta página.
      if (!emailInstitucional(cred.user.email)) {
        await signOut(auth);
        return mensagem(erro, DICA_EMAIL);
      }
      const nome = (cred.user.displayName || nomeDigitado || "").trim();
      if (nome.length < 2) {
        await signOut(auth);
        campoNome.hidden = false;
        form.nome.focus();
        return mensagem(erro, "Seu cadastro não foi concluído. Digite seu nome completo e clique em Entrar de novo.");
      }
      await tentarDuasVezes(() => criarPerfil(cred.user, perfil, nome));
      if (!cred.user.emailVerified) { try { await sendEmailVerification(cred.user); } catch (e) { console.warn(e); } }
      s = await carregarSessao(cred.user);
    }
    if (s.perfil !== perfil) {
      await signOut(auth);
      return mensagem(erro, `Esta conta é de ${s.perfil}. Use a página de login de ${outro[perfil]}.`);
    }
    window.location.href = destino(s, "..");
  }

  trocarModo("entrar");

  // Já tem sessão? Vai direto para o lugar certo (sem travar os botões enquanto isso).
  (async () => {
    try {
      const s = await sessaoAtual();
      if (!s) return;
      if (perfil === "admin") { if (s.admin) aoEntrarAdmin?.(s); return; }
      if (s.perfil && s.perfil !== "admin") window.location.replace(destino(s, ".."));
    } catch (e) { console.error(e); }
  })();
}
