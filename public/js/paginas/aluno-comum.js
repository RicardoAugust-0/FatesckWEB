// Peças do aluno usadas no Início e em Turmas: cards dos pedidos de entrada.
import { el, toast } from "../ui/ui.js";
import { cardTurma } from "../ui/componentes.js";
import { quando } from "../utils/datas.js";
import { cancelarPedido } from "../servicos/turmas.js";
import { janelaEntrar } from "../ui/turmas-ui.js";
import { mensagemDeErro } from "../core/auth.js";

// Pedido pendente: "Aguardando aprovação" + "Cancelar pedido". Recusado: "Pedido recusado" + "Pedir de novo" / "Dispensar".
export function cardPedido(sessao, p, recarregar) {
  const recusado = p.status === "recusado";
  const remover = async (botao, aviso) => {
    botao.disabled = true;
    try { await cancelarPedido(sessao, p.turmaId); toast(aviso); recarregar(); }
    catch (e) { console.error(e); toast("Não foi possível. " + mensagemDeErro(e), { tipo: "erro" }); botao.disabled = false; }
  };
  const acoes = el("div", { class: "turma-acao", style: { display: "flex", gap: "8px", flexWrap: "wrap" } });
  if (recusado) {
    acoes.append(
      el("button", { type: "button", class: "botao pequeno", onclick: () => janelaEntrar(sessao, recarregar) }, "Pedir de novo"),
      el("button", { type: "button", class: "botao pequeno neutro", onclick: e => remover(e.currentTarget, "Pedido dispensado.") }, "Dispensar"));
  } else {
    acoes.append(el("button", { type: "button", class: "botao pequeno neutro", onclick: e => remover(e.currentTarget, "Pedido cancelado.") }, "Cancelar pedido"));
  }
  return cardTurma({
    turma: { nome: p.turmaNome, cor: p.turmaCor },
    subtitulo: recusado ? "O professor recusou o seu pedido." : `Pedido enviado ${quando(p.pedidoEm)}`,
    chips: [recusado ? { texto: "Pedido recusado", classe: "chip contorno" } : { texto: "Aguardando aprovação", icone: "relogio" }],
    classe: "pedido", extra: acoes
  });
}
