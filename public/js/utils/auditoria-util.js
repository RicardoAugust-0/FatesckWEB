// Registro de alterações (Fase 7a): nomes em português de cada ação gravada em "auditoria" (testado em utilitarios).
export const ACOES = {
  aluno_aprovado: "Pedido de entrada aprovado",
  aluno_recusado: "Pedido de entrada recusado",
  aluno_adicionado: "Aluno adicionado pela administração",
  aluno_removido: "Aluno removido da turma",
  professor_aprovado: "Professor liberado",
  turma_arquivada: "Turma arquivada",
  turma_desarquivada: "Turma desarquivada",
  prazo_alterado: "Prazo alterado",
  entrega_reaberta: "Entrega reaberta",
  entrega_desfeita: "Entrega desfeita",
  notas_despublicadas: "Notas despublicadas",
  notas_apagadas: "Folha de notas apagada",
  aviso_editado: "Aviso editado",
  aviso_apagado: "Aviso apagado",
  representante_adicionado: "Representante adicionado",
  representante_removido: "Representante removido",
  mensagem_removida: "Mensagem removida"
};
export const nomeDaAcao = acao => ACOES[acao] || acao;
// Opções do filtro "Tipo", em ordem alfabética do nome em português.
export const opcoesDeAcao = () => Object.entries(ACOES).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
