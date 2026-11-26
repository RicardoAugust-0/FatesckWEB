// Ícones de linha (SVG fixo, sem dados do usuário — por isso é seguro como HTML).
const D = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  turmas: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  atividades: '<rect x="5" y="3.5" width="14" height="17.5" rx="2"/><path d="M9 3.5V2.5h6v1M9 10h6M9 14h4"/>',
  notas: '<path d="M4 20h16"/><path d="M7 17V10M12 17V5M17 17v-4"/>',
  chat: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/>',
  avisos: '<path d="M4 9.5v5h3l7 4.5v-14L7 9.5H4Z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
  sair: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m15 8 4 4-4 4M19 12H9"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chave: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 6l2.5 2.5M14 8l2 2"/>',
  pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.3a3 3 0 0 1 0 5.4M18 14.2c1.8.8 3 2.7 3 5.8"/>',
  mais: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  balao: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/>',
  arquivo: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  lapis: '<path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z"/><path d="m14.5 6.5 3 3"/>',
  voltar: '<path d="m14.5 6-6 6 6 6"/>',
  lixeira: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M10 11v6M14 11v6"/>',
  enviar: '<path d="M4.5 12 20 4.5 15.5 20l-3.2-6.3L4.5 12Z"/><path d="m12.3 13.7 3.2-3.2"/>',
  sino: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z"/><path d="M10 21h4"/>'
};

export function icone(nome, classe = "icone") {
  return `<svg class="${classe}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${D[nome] ?? ""}</svg>`;
}

// Versão como elemento (para usar com el()).
export function iconeEl(nome, classe = "icone") {
  const t = document.createElement("template");
  t.innerHTML = icone(nome, classe);
  return t.content.firstChild;
}
