# ADENDO — LEIA PRIMEIRO (decisões posteriores que SUBSTITUEM o texto original abaixo)

Este arquivo é o prompt original das 10 fases (Fase 0 a 9). Depois dele, Fernando tomou decisões que mudam alguns pontos. Onde houver conflito, **vale este adendo**, nesta ordem de prioridade: (1) CLAUDE.md da raiz, (2) este adendo, (3) o texto original.

1. **Domínio do e-mail institucional:** NÃO é `@fatec.sp.gov.br`. Vale `@cps.sp.gov.br` ou qualquer subdomínio (ex.: `@aluno.cps.sp.gov.br`), com a expressão `^[^@\s]+@([a-z0-9-]+\.)*cps\.sp\.gov\.br$` (sem diferenciar maiúsculas), igual no cliente e nas regras. Todo "fatec.sp.gov.br" abaixo está obsoleto.
2. **E-mail verificado obrigatório** nas regras (exceto o admin). O perfil pode ser criado antes de verificar.
3. **Entrada na turma por código = PEDIDO de entrada** aprovado pelo professor da turma ou pelo admin (e não entrada automática), com botão **"Aprovar todos"** (professor e admin). Cada aprovação vai para o registro de alterações. O aluno pode cancelar o pedido, pedir de novo ou dispensar um pedido recusado.
4. **Turma arquivada = somente leitura**, com "Desarquivar".
5. **Prazo:** duas ações separadas, ambas auditadas: **"Estender prazo"** (muda o prazo) e **"Reabrir entrega até…"** (mantém o prazo, aceita entregas até uma data; continuam "atrasada").
6. **Registro de alterações obrigatório pelas regras** (a regra exige o registro no mesmo lote). Ações: prazo alterado, entrega reaberta, entrega desfeita, mensagem removida, professor aprovado, aluno adicionado/removido, turma arquivada/desarquivada, notas despublicadas, aviso editado/apagado, representante adicionado/removido, aprovação de pedidos.
7. **Decisão A3 (correção, desfazer e visibilidade de nota):**
   - O professor corrige e lança nota a qualquer hora, sem espera.
   - O aluno desfaz a entrega até 4h depois, sem nenhuma outra condição; depois disso, só professor ou admin.
   - O aluno NUNCA escreve nem apaga nota.
   - Todo desfazer grava a marca `desfeitas/{aluno}` no mesmo lote; a marca `corrigida` some com a entrega; o item de nota FICA para o professor, marcado "entrega desfeita".
   - O aluno só vê uma nota se a folha estiver publicada E, se a folha for ligada a uma atividade, a entrega dele não existir ou tiver 4h ou mais (hora do servidor) E não houver marca de desfeita mais nova que a última edição da nota.
   - Notas sem atividade (ex.: "Prova 1") aparecem assim que publicadas.
   - Notas podem ser despublicadas (com registro).
   - Não existe "zero automático" para quem não entrega: não implementar nada disso sem perguntar.
8. **Avisos:** o autor ou o admin podem editar e apagar (com registro).
9. **Representantes do curso (2 alunas, sem limite fixo):** só o admin adiciona e remove (coleção `representantes`). Representantes e admin postam **avisos do curso** (`avisosCurso`), visíveis a todos os usuários ativos, misturados com os avisos das turmas, mostrando sempre QUEM postou e o papel (Professor / Representante / Administração), validado pelas regras. Representante pode editar e apagar os próprios avisos; admin edita e apaga qualquer um. Mensagens do chat da turma têm etiqueta "Representante" validada pelas regras; se a pessoa deixa de ser representante, a tela mostra "Ex-Representante".
10. **Admin atual:** é o próprio Fernando (por enquanto), com login separado em `/admin/` e documento `admins/{uid}` criado à mão. O README (Fase 9) explica como trocar.
11. **Aviso de privacidade (LGPD):** o aceite é exigido no cadastro, mas NÃO é guardado.
12. **Mensagem de chat apagada** some de vez (sem "Mensagem removida"); o registro guarda quem apagou e quando.
13. **Idioma das mensagens para o Fernando:** português do Brasil. Prompts e CLAUDE.md em inglês.
14. **Regras extras de conduta:** nunca rodar nenhum comando git (nem `git --version`); nunca matar processos de navegador por nome (fechar só o processo que você abriu, pelo PID); perguntar ao Fernando em português, com 2–3 opções e uma recomendação, antes de qualquer decisão de design ou ponto não definido.
15. **Fases concluídas e aprovadas** quando este arquivo foi criado: 0, 1, 2, 3 e 4. Próxima: **Fase 5** (atividades e entregas). Veja o CLAUDE.md para o estado atual.

---

# Prompt for Claude Code — Fatesck v2 (work on a COPY only) — TEXTO ORIGINAL

> Recommended: run Claude Code on the most capable model available (Opus 5.5). This is a long, multi-step task.
> The approved preview screenshots are in `site/prints-previa/`.

---

## 0. HARD RULES (read first, obey always)

1. **Work ONLY on a COPY of the repository. Never modify the original folder or the GitHub repository.**
   - First step: copy the project to a sibling folder, e.g. `cp -r PI_Fatesck PI_Fatesck_v2`, and work only inside `PI_Fatesck_v2`.
   - If the copy contains a `.git` folder, **remove it** (`rm -rf PI_Fatesck_v2/.git`) so no accidental push is possible.
   - **Do NOT run** `git commit`, `git push`, `git add`, `git branch`, `git remote`, `gh pr`, or anything that touches GitHub. **No commits at all.** The group must approve changes first and Fernando may want to change things.
2. **Never touch the real Firebase project `fatesk-3819c`.** Develop and test only against the **Firebase Emulator Suite** (Authentication + Firestore). Do NOT run `firebase deploy`, do NOT change the real console, rules or data, and do NOT deploy to Vercel or anywhere else. Publishing happens later, by Fernando, after the group approves.
3. **Do only what this prompt asks.** If something is ambiguous, not covered, or is a design decision not covered by the approved preview: **STOP and ask Fernando**, presenting 2–3 options. Zero margin for error is the goal. Do not "improve" things on your own.
4. **Work in phases (section 8). After each phase: run the tests, report what changed, and WAIT for Fernando's OK before the next phase.**
5. **Brand:** use the original logo `midia/logo.png` **unchanged**. Never redraw, recolor or reinterpret it. On red or dark backgrounds, place it on a white rounded plate (as in the preview).
6. **Language:** user-facing text in Brazilian Portuguese (pt-BR). Code comments in Portuguese, matching the current repo. Keep identifiers consistent with the repo's current Portuguese naming.
7. **Do not edit `docs/originais/`** (the group's deliverables). Add new docs elsewhere (section 7).
8. Keep the current stack: plain HTML + CSS + JavaScript (ES modules, no bundler) + Firebase v11 via CDN. npm is only for dev tooling (emulator, tests). Do not introduce frameworks.

---

## 1. Context

**Fatesck** is a group project (FATEC "Projeto Integrador", ADS course) to **replace Microsoft Teams** for the college, web + mobile, without depending on an institutional partnership with Microsoft. The group reduced the scope to: **activities (assignments), chat between teacher and students, and posting of grades**. For now it is a **prototype to present the idea**; if the college approves it, it goes to real use.

Original repo (GitHub `RicardoAugust-0/PI_Fatesck`): `inicio/`, `login_aluno/`, `login_professor/`, `inicial_aluno/*`, `inicial_professor/*` (each page is a tiny HTML shell loading `js/app.js`), `css/base.css`, `js/{firebase,auth,dados,app}.js`, `firestore.rules`, `README.md`, `docs/originais/*`. Firebase Auth (email/password) + Firestore. Hosting is on Vercel (already exists; not your concern now).

---

## 2. Setup (Phase 0) — DONE

- Copy created, emulator configured (`demo-fatesck`), `js/firebase.js` connects to emulators on localhost, npm scripts `emulators`, `seed`, `test:rules`, seed data in the emulator only, no "create sample data" button.

---

## 3. Functional requirements (decided by Fernando)

### 3.1 Roles, admin, signup
- Three roles: **aluno**, **professor**, **admin**.
- **Admin-only page** (`/admin/`) — students and teachers cannot access it (enforced by security rules, not just hidden in the UI). The admin can: approve pending teachers, create classes, add/remove **students** in any class, add **teachers** to any class, view all grades, delete chat messages (class and private), view the change log.
- **Nobody becomes admin through the site.** The first admin is created manually in the Firebase console (document written by hand). `admins/{uid}` is not writable by clients; `isAdmin()` = `exists(admins/uid)`. Document this in the README.
- **Teacher signup:** anyone can sign up as teacher, but the account stays **`pendente`** and sees only an **"Aguardando liberação"** screen until an admin approves. Approval only (no "reject" button). Rules must make a pending teacher unable to do anything a teacher can.
- **Student signup:** no approval needed. A student with no class sees an empty state ("Você ainda não está em nenhuma turma. Entre com o código da turma.").
- **Only institutional emails** can sign up (see ADENDO item 1 for the correct domain).
- **"Esqueci minha senha"** link using Firebase password reset email.
- **Fix the orphan-account bug.**
- Role/status must not be editable by the user themself (rules).

### 3.2 Classes ("turmas") — Teams model
- **Class = discipline** (one concept). Each card is one class/discipline, like Teams "Equipes".
- A **teacher creates their own classes** (name, color). Each class gets an auto-generated **join code** (8 chars, unambiguous alphabet, hard to guess, unique).
- **Students enter with the code** themselves (see ADENDO item 3: it is a request approved by professor/admin). Teachers do NOT invite or add students. **Codes of archived classes are rejected.**
- The **code is NOT shown on the class card**. It is inside the card's three-dots (⋯) menu: "Mostrar código da turma" and "Copiar código" (also reachable by the "Código da turma" button inside the class page).
- **Admin** can create classes, **add/remove students**, and **add teachers** to any class. A **teacher cannot add another teacher**.
- A student sees only the classes they belong to; a teacher sees only classes they belong to; admin sees all.
- **Archive class** (⋯ menu): leaves the main screen but keeps all activities and grades; students cannot join an archived class. Provide "Ver arquivadas".
- The **teacher chooses the class color** (8 options, preview shows the student's card).
- **Class page** (click a card): header in red, tabs **Atividades, Entregas, Notas, Chat, Avisos, Alunos**. Inside a class, the teacher sees only that class's activities.
- The side-menu item **"Atividades"** is a global overview of the user's activities across classes, **with a filter by class**.

### 3.3 Activities and deliveries
- Activity fields: **title**, **deadline with date AND time** (default **23:59** if no time is chosen), **description (optional)**, **max grade (optional)**.
- The teacher can **edit and delete** their own activities. Deleting an activity that has deliveries asks for confirmation and deletes the deliveries too.
- **Delivery by the student: text and/or link.** A **"Anexar arquivo" option is shown but DISABLED** (note: "Disponível em breve"). Do NOT implement file upload / Firebase Storage.
- **Undo window:** the student can undo/redo their delivery within **4 hours after delivering**. After that, **only the teacher or the admin** can undo it.
- **Late deliveries:** the system does **not** block after the deadline; the delivery is flagged **"atrasada"** with **date and time of delivery** visible to the teacher. **24 hours after the deadline the delivery closes.** The teacher/admin can **extend the deadline / reopen** delivery (two actions, see ADENDO item 5).
- **All time limits (4h, 24h, late flag) must be enforced in Firestore Security Rules using server time** (`request.time`), never the device clock. Rules force `entregueEm == request.time` on create.
- **One delivery per student per activity**: deterministic document id (the student's uid under `.../atividades/{id}/entregas/{alunoUid}`).
- The student's name stored in a delivery must come from the user's profile, and rules must reject a different value.
- **Delivery receipt:** after delivering, show "Entregue em dd/mm às hh:mm" plus the **Undo** button with the remaining time ("Desfazer · 2h 10min"). This lives on the **Atividades** screen (NOT on the home screen).
- **Countdown** on activity cards (time left to deliver; "Atrasada · aberta por mais Xh Ymin"; time left to undo).
- **Teacher view:** per activity "28 de 32 entregaram" with a progress bar, and the list of who delivered / who didn't; actions Corrigir / Editar / Ver entregas / extend deadline.
- **Autosave draft** of the delivery text in `localStorage` (per user+activity), restored on return, cleared after delivery.
- All dates/"atrasada" computed in **America/Sao_Paulo**, never UTC.

### 3.4 Grades ("notas")
- **Numeric with decimals** (e.g. 8,5; accept comma input).
- There is **no "prova" type**. The teacher just **posts a grade** with a free title (e.g. "Prova 1"). A grade entry may also come from a graded delivery.
- **Optional comment** per grade.
- Only separate grades are shown; **no final average and no weights**.
- **Draft → Publish:** the teacher enters all students' grades, reviews, then clicks **"Publicar"**. Until published, students cannot see them (enforce in rules). Unpublish is allowed (ADENDO item 7).
- Visibility: **each student sees ONLY their own grades**; the **teacher sees all grades of their classes plus the class average** (computed in the client); **admin sees everything**. Visibility timing follows ADENDO item 7.

### 3.5 Chat and notices
- **Two kinds of chat:** class chat (everyone in the class) and **private teacher↔student** conversations. Both teacher and student can write in both.
- A student can start a private chat **only with teachers of the classes they belong to**. **No student↔student chat.**
- A **teacher can delete messages in the class chat**. The **admin can delete messages in both** kinds (ADENDO item 12).
- For this prototype, chat is **readable by the admin** (no end-to-end encryption). Do NOT add E2E; the E2E docs are a future goal.
- Real-time with `onSnapshot`. **Unread counters** next to each conversation and in the menu.
- **"Avisos" (notices) stay separate from chat.** Teachers post notices to a class; students see them in "Avisos recentes" and in the Avisos page. Course-wide notices and authorship labels: ADENDO item 9.
- **Menu badges** for new/unseen activities, notices and messages (store last-seen timestamps per user).

### 3.6 Change log
- Record who did what and when (see ADENDO item 6). Append-only, readable by admin only ("Registro de alterações" list in the admin page).

---

## 4. Data model and security rules (Phase 1) — DONE

The final schema and rules were implemented in Phase 1 (see `firestore.rules`, `firestore.indexes.json`, and `tests/`). Default deny; types, allowed values, string lengths and unknown fields validated on every write; teachers only touch what they own inside their own classes; a pending teacher has no teacher powers; students cannot read other classes, other students' deliveries, or other students' grades. Automated rules tests run with `npm run test:rules`.

---

## 5. Bugs and code-quality fixes

- **Stored XSS:** escape every dynamic value rendered into HTML. Prefer building DOM nodes / `textContent` over string `innerHTML`; keep a single tested `esc()` helper. Add validation in rules.
- **Time zone bug:** use America/Sao_Paulo and server time rules.
- **Whitespace-only titles/notices:** `trim()` before validating (client and rules).
- **Home screen buttons dead until Firebase answered:** attach listeners first, redirect after.
- **Duplicate deliveries:** fixed by deterministic delivery id.
- **CSS typo** `var(--vok, …)`: fix.
- **Header search box did nothing:** remove it.
- **Mobile menu:** fixed bottom bar on phones.
- **Mobile tables cut off:** on phones, table rows become stacked cards; action buttons always visible; no horizontal scroll.
- Replace `alert()` by discreet **toast** messages and show **loading skeletons** on cards.
- Remove the "Criar dados de exemplo" button and the `semearExemplo` function.
- Every `await` has proper error handling and user-friendly pt-BR messages.

---

## 6. UI — follow the approved preview

Screenshots of the approved preview are in `site/prints-previa/` (6 screens). Follow them closely. If a screen you need is not covered, STOP and ask — do not invent design.

**Fonts:** Inter (weights 400/500/600/700), sizes as in the preview (h1 30px, card titles 15–16px, body 14px).

**Color tokens (CSS variables, theme via attribute on `<html>`):**

| token | light | dark |
|---|---|---|
| `--accent` (fills, same in both themes) | `#A61C24` | `#A61C24` |
| `--accentText` (small red text/icons) | `#A61C24` | `#FF646E` |
| `--accentSoft` | `#F8ECEC` | `#2A1517` |
| `--bg` | `#F3F3F4` | `#0D0E10` |
| `--surface` | `#FFFFFF` | `#16181B` |
| `--surface2` | `#F7F7F8` | `#1D2024` |
| `--border` | `#E3E4E6` | `#2B2F34` |
| `--text` | `#15171A` | `#F1F2F3` |
| `--text2` | `#565C64` | `#A4AAB2` |
| `--chip` | `#ECEDEF` | `#24272C` |

Palette: red, white, gray and black. Class colors chosen by the teacher: `#A61C24` Vermelho, `#3B4048` Grafite, `#2455C6` Azul, `#1F7A66` Verde, `#C2570C` Laranja, `#5B4BD5` Violeta, `#7A1118` Vinho, `#15171A` Preto.

**Layout and components:**
- **Left sidebar** 248px: red top block (logo on a white plate + user chip), nav list in the middle (active item = solid red with white text; badges), red footer with "Sair" and a small theme toggle icon button. Theme persisted in `localStorage`, respects `prefers-color-scheme` on first visit.
- **Every card has a 3px red top border**, radius 16px. Section titles have a small red vertical bar.
- **Student home:** red welcome banner "Olá, {nome}" with 3 tiles → "Atividades pendentes": only the 3 that close soonest, with time-left chip, footer "Mostrando as 3 que fecham primeiro · mais N abertas" + button "Ver todas as atividades"; next to it "Avisos recentes" → grid of class cards. No "Entregas recentes" or "Minhas notas" on the home.
- **Teacher home / "Minhas turmas":** red banner with tiles ("Turmas ativas", "Atividades para corrigir", "Mensagens não lidas"); class cards with the ⋯ menu; a "Nova turma" panel with name + 8 color swatches + live preview. Chips: "N atividades para corrigir" / "Tudo corrigido". Inside an activity row: "N entregas para corrigir".
- **Phones (≤ 520px):** red header with greeting; fixed bottom tab bar (Início, Turmas, Tarefas, Chat, Notas); small theme toggle floating above the bar; class cards in 2 columns; touch targets ≥ 44px; on the home, 2 pending activities + "Ver todas as atividades (+N)".
- **PWA:** manifest + icons from the original logo centered, unmodified + a minimal service worker (app shell only, never Firestore data). Theme color `#A61C24`.
- Accessibility: real `<button>`/`<a>`, labels on inputs, `aria-label` on icon-only buttons, visible focus, contrast ≥ 4.5:1, `prefers-reduced-motion` respected.

---

## 7. Documentation and delivery (final phase)

- **Do NOT edit `docs/originais/`.** Create **`docs/estado-atual.md`**: what was actually built, and what stays as future evolution (E2E encryption, Next.js/NestJS/PostgreSQL, file upload with Storage, App Check, real deployment). Make clear the original docs describe the long-term target.
- **Update `README.md`:** how to run with the emulator, how to seed, how to run the rules tests, how to create the first admin by hand and how to change the admin later, folders and collections, authorized domains in Firebase Authentication for the Vercel domain, and how Fernando publishes later (rules + indexes deploy + Vercel) — written as instructions for him, not executed by you.
- **Privacy notice (LGPD)** on the signup screens: what is stored (name, email, deliveries, grades, messages), that the admin can read the chat, required "Li e concordo" checkbox (acceptance not stored).
- **Manual test checklist** (`docs/roteiro-de-testes.md`): student, teacher, pending teacher, and admin flows on desktop and phone, light and dark theme.

---

## 8. Phases (stop after each one and wait for OK)

0. Copy + emulator + seed — DONE
1. Schema + security rules + rules tests — DONE
2. Auth and roles — DONE
3. UI foundation — DONE
4. Classes — DONE
5. **Activities and deliveries** (section 3.3) including countdowns, receipt, undo, late/extension, who-delivered list, draft autosave, global "Atividades" with class filter.
6. **Grades** (section 3.4 + ADENDO item 7).
7. **Chat + notices + badges + change log** (sections 3.5, 3.6, ADENDO item 9).
8. **Bug sweep + hardening** (section 5), final full run of the rules tests.
9. **Docs, README, LGPD notice, manual test checklist** (section 7). Final report: what changed, how to run, what Fernando must do manually later (create first admin, deploy rules and indexes, authorize the Vercel domain, publish to Vercel), and anything you were unsure about.

At every checkpoint remember: **copy only, no git, no real Firebase, no deploy.**
