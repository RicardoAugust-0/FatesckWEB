// Página Chat do aluno (Fase 7b): chat das turmas + conversas particulares com professores.
import { montarChat } from "../chat-ui.js";

export async function montar({ sessao, perfil, conteudo, definirCabecalhoMovel, definirContador, contadorAoVivo }) {
  definirCabecalhoMovel("Chat", "Turmas e professores");
  contadorAoVivo("chat"); // o número do menu passa a ser o da própria página, em tempo real
  montarChat(conteudo, { sessao, perfil, aoContar: n => definirContador("chat", n) });
}
