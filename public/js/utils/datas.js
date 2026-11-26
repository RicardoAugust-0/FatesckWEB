// Datas sempre no horário de Brasília (America/Sao_Paulo), nunca em UTC.
const FUSO = "America/Sao_Paulo";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const fmtChave = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }); // AAAA-MM-DD
const fmtExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });

// Aceita Timestamp do Firestore, Date ou milissegundos.
export function paraDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  return null;
}
export const ms = v => paraDate(v)?.getTime() ?? 0;

// "11/11/2026 às 21:40"
export function dataHora(v) {
  const d = paraDate(v);
  return d ? `${fmtData.format(d)} às ${fmtHora.format(d)}` : "";
}

// Dia do calendário em São Paulo, para comparar "hoje"/"ontem"/"amanhã".
const diaSP = d => fmtChave.format(d);
function diferencaDias(d, agora = new Date()) {
  const [a, b] = [diaSP(d), diaSP(agora)].map(s => Date.UTC(...s.split("-").map((n, i) => i === 1 ? n - 1 : +n)));
  return Math.round((a - b) / 864e5);
}

// "11/11 às 14:20" (recibo de entrega)
export function diaMesHora(v) {
  const d = paraDate(v);
  return d ? `${fmtDiaMes.format(d)} às ${fmtHora.format(d)}` : "";
}

// Campos <input type="date"> e <input type="time"> sempre no horário de Brasília.
// O Brasil não tem horário de verão desde 2019: São Paulo é sempre UTC-3.
export function msDeCampos(data, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "") || !/^\d{2}:\d{2}$/.test(hora || "")) return NaN;
  return Date.parse(`${data}T${hora}:00-03:00`);
}
export function camposDeMs(v) {
  const d = paraDate(v);
  return d ? { data: fmtChave.format(d), hora: fmtHora.format(d) } : { data: "", hora: "" };
}

// "hoje, 14:20" · "ontem, 09:05" · "amanhã, 23:59" · "14/11, 23:59"
export function quando(v, agora = new Date()) {
  const d = paraDate(v);
  if (!d) return "";
  const dif = diferencaDias(d, agora), hora = fmtHora.format(d);
  if (dif === 0) return `hoje, ${hora}`;
  if (dif === -1) return `ontem, ${hora}`;
  if (dif === 1) return `amanhã, ${hora}`;
  return `${fmtDiaMes.format(d)}, ${hora}`;
}

// Chat: hora da mensagem ("14:20") e separador de dia ("Hoje", "Ontem", "11/11/2026").
export function horaCurta(v) {
  const d = paraDate(v);
  return d ? fmtHora.format(d) : "";
}
export function rotuloDia(v, agora = new Date()) {
  const d = paraDate(v);
  if (!d) return "";
  const dif = diferencaDias(d, agora);
  return dif === 0 ? "Hoje" : dif === -1 ? "Ontem" : fmtData.format(d);
}

// "Quarta-feira, 11 de novembro"
export function hojeExtenso(agora = new Date()) {
  const t = fmtExtenso.format(agora);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Duração legível: "6h 19min", "45min", "3 dias", "1 dia"
export function duracao(msRestante) {
  const min = Math.max(0, Math.floor(msRestante / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 48) return m ? `${h}h ${m}min` : `${h}h`;
  const dias = Math.floor(h / 24);
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}
