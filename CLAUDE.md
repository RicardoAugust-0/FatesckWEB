# CLAUDE.md — Fatesck v2 (working copy)

Guidance for Claude Code sessions continuing this project. Read fully before doing anything.

## 1. HARD RULES (always)

- **Work only in this copy**: `site/PI_Fatesck_v2`. Never modify the original `site/PI_Fatesck-main/PI_Fatesck-main` (verify with checksums at the end of each phase) nor the GitHub repo.
- **NO git command of any kind** — not even `git --version`, `git status`, `gh`. There is no `.git` here and there must never be one.
- **Never touch the real Firebase project** (`fatesk-3819c`) or its console/rules/data. **No `firebase deploy`, no Vercel, no deploy of any kind.** Only the Emulator Suite with the fake project `demo-fatesck` (`scripts/firebase-cli.mjs` blocks `deploy`/`login`/`use`/`init`).
- **Exception decided by Fernando (2026-11-12): temporary demo on Vercel** with a SEPARATE Firebase project only for demonstration (see §7). Claude only prepares code/commands; **Fernando himself** creates the demo project, deploys rules/indexes, runs `npm run seed:demo` and deploys to Vercel. Claude never runs any deploy and never reads the service-account key.
- **Never kill browser processes** by name, filter or in bulk. If you start a test browser yourself, close **only that exact process, by the PID you recorded** (use a private temp profile). Never touch Fernando's browsers. Killing *this project's* emulator processes (by command line containing `PI_Fatesck_v2`) is fine.
- **Do only what was asked.** No unrequested "improvements".
- **Any design decision or anything not covered** by the spec/preview: STOP and ask Fernando **in Portuguese**, with 2–3 options in plain language (he is a student, no jargon), marking your recommendation. Do not invent screens.
- **Follow the approved preview screenshots** in `site/prints-previa/` (6 screens: student home light/dark, student phone light/dark, teacher "Minhas turmas", teacher class page).
- **Logo**: `midia/logo.png` unchanged (never redraw/recolor). On red/dark backgrounds put it on a white rounded plate.
- **All messages to Fernando in Brazilian Portuguese.** User-facing text pt-BR; code comments in Portuguese; Portuguese identifiers.
- **Stop after each phase**: run all tests, report (what changed, differences from preview, screenshots, how to test each flow), then **wait for Fernando's OK**.
- Do not edit `docs/originais/` (group deliverables). No secrets in files/messages. Don't repeat test passwords in chat.
- Stack is fixed: plain HTML + CSS + JS ES modules (no bundler, no framework) + Firebase JS SDK **v11.0.2 via CDN** (gstatic). npm only for dev tooling.
- **At the end of every phase, before asking Fernando for his OK, update this CLAUDE.md** (phase status, new decisions, new files, new commands, known points) so a new session can always continue from it.
- **This CLAUDE.md is only a working note for this copy.** It must NOT be included if the project is ever published to GitHub — remind Fernando to remove it at that time.

## 2. Project summary and phase plan

Fatesck = FATEC "Projeto Integrador" (ADS): replacement for MS Teams for the college — activities, teacher↔student chat, grades. Prototype; if approved by the college it goes to real use. Original spec with the phase details: **`docs/prompt-original-fases.md`** — it starts with an ADENDO that overrides the original text where they conflict. Read it whenever the details of a phase are needed. (At the end of Phase 4 this file had not been placed in `docs/` yet; Fernando adds it.)

| Phase | Content | Status |
|---|---|---|
| 0 | Copy, emulator config, seed, npm scripts | DONE, approved |
| 1 | Final schema + `firestore.rules` + rules tests | DONE, approved (incl. reps delta + decision A3) |
| 2 | Auth & roles: signup/login, institutional e-mail, verify-email screen, pending-professor screen, `/admin/` skeleton + login, password reset, orphan-account fix, LGPD notice | DONE, approved (then e-mail domain changed to cps.sp.gov.br) |
| 3 | UI foundation: tokens, themes + toggle, sidebar, banner/cards, toasts/skeletons, phone bottom bar, PWA | DONE, approved |
| 4 | Classes: create (name + 8 colors + live preview, 8-char code), join **request** by code, ⋯ menu, archive/"Ver arquivadas"/unarchive, class page with tabs, Alunos tab (approve/reject), admin class tools + representatives | DONE, approved by Fernando. Decision: KEEP the join-request flow and ADD the "Aprovar todos" button. |
| 5 | Activities & deliveries (§3.3) + "Aprovar todos" — see §3 "Activities (Phase 5)" | DONE, approved |
| 6 | Grades (§3.4) — see §3 "Grades (Phase 6)" | DONE, approved (incl. the two fixes: delete DRAFT sheet; admin "Despublicar") |
| 7a | Notices (class + course-wide, authorship labels incl. Ex-Representante, edit/delete audited), unread counters + menu badges with mark-as-seen via `usuarios/{uid}/leituras`, admin "Registro de alterações" list | DONE, approved |
| 7b | Chat (class + private teacher↔student, onSnapshot, representative tag, unread counters + mark-as-read, hard-delete by teacher/admin audited, admin reads chats) — see §3 "Chat (Phase 7b)" | DONE, **approved 2026-11-12** (with decisions in §3 + seed messages in the archived class). **Next: do NOT start Phase 8** — Fernando first runs a review-only "revisão geral" (audit) in a NEW session (his own prompt; outputs in `site/revisao-geral/`, no project file changes). Wait for his instructions. |
| 8 | Bug sweep & hardening (§5): remove old dead code in `js/app.js` legacy bits if any, header search already removed, every `await` handled, mobile tables→stacked cards, full rules test run | TODO |
| 9 | Docs: `docs/estado-atual.md`, README (emulator, seed, tests, first admin by hand, how to change admin, folder/collection structure, how Fernando deploys later), `docs/roteiro-de-testes.md` manual checklist (student, teacher, pending teacher, admin; desktop+phone; light+dark). LGPD notice already done in Phase 2 | TODO |

## 3. All decisions made by Fernando (authoritative)

**Roles & accounts**
- Roles: aluno, professor, admin. Admin = `admins/{uid}` doc created **by hand in the console** (client can never write it); admin has **no** `usuarios` doc; admin logs in only at **`/admin/`** (separate login, clear Portuguese errors). Currently the admin is Fernando. Admin is exempt from e-mail verification.
- Teacher signup → `status: 'pendente'` → "Aguardando liberação" screen until admin approves (approve only, no reject; audited `professor_aprovado`). Pending teacher has zero teacher powers (rules).
- **E-mail domain**: exactly `cps.sp.gov.br` **or any subdomain** (e.g. `@aluno.cps.sp.gov.br`); NOT a plain endsWith. Regex `^[^@\s]+@([a-z0-9-]+\.)*cps\.sp\.gov\.br$` (case-insensitive) in client (`js/auth.js`) and rules (`email.lower().matches(...)`). Rejects `evilcps.sp.gov.br`, `cps.sp.gov.br.fake.com`, old `fatec.sp.gov.br`.
- **E-mail verification required** (rules check `email_verified`); profile creation allowed before verification (avoids orphan accounts). "Confirme seu e-mail" screen: auto-check every 10s + "Já confirmei" + resend with 60s cooldown.
- **LGPD notice** on signup with required "Li e concordo" checkbox — **required but NOT stored**.
- Password reset inline on the login card; generic success message.
- Orphan-account fix: on profile write failure → retry (10s timeout each) → delete the auth user; if that fails, the profile is completed on next login (asks name if missing).

**Classes**
- Class = discipline. 8 colors: `#A61C24` Vermelho, `#3B4048` Grafite, `#2455C6` Azul, `#1F7A66` Verde, `#C2570C` Laranja, `#5B4BD5` Violeta, `#7A1118` Vinho, `#15171A` Preto.
- Code: 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, unique (`codigos/{codigo}` create-only). `codigos/{codigo}` = `{turmaId, arquivada, nome, cor}` (nome/cor kept equal to the class by rules, so a non-member can build a request). `get` by exact code only; `list` forbidden.
- **Joining = a REQUEST** (`turmas/{t}/pedidos/{alunoUid}`), approved or rejected by the class teacher or admin, both **audited** (`aluno_aprovado`, `aluno_recusado`). Rejected requests stay with `status: 'recusado'` so the student sees it; student can re-request (same doc back to `pendente`) or dismiss; student can cancel a pending request. Students can no longer add themselves as members. Admin can still add a student directly by e-mail (audited `aluno_adicionado`) and remove (audited `aluno_removido`).
- **"Aprovar todos" button** (implemented in Phase 5): shown when there are **2+ pending requests** and the class is not archived — teacher: in the "Pedidos de entrada" card header (Alunos tab); admin: below the requests list in "Gerenciar". Shared dialog `janelaAprovarTodos()` (`js/turmas-ui.js`): confirmation "Aprovar N pedidos?" + "Aprovar N", progress "Aprovando… X de N", toast on full success. Logic `aprovarTodos()` (`js/turmas.js`): same writes as the single approval (member + delete request + 1 `aluno_aprovado` audit entry per student), **5 approvals per batch** (`APROVACOES_POR_LOTE`; measured in the emulator: max 7 per batch for a teacher, 8 for admin, because of the 20 rule-reads limit). Each batch is all-or-nothing; if a batch is refused, its students are retried one by one, so only the problem ones are left out; batches already written stay. The dialog then lists who failed ("X de N aprovados…") and the remaining requests stay in the list to retry. No rules change was needed.
- Code shown only via ⋯ menu ("Mostrar código da turma", "Copiar código") and the "Código da turma" button on the class page. Students' ⋯ menu: "Abrir turma", "Copiar código".
- Teacher ⋯: Mostrar código, Copiar código, Alterar cor e nome, Arquivar turma. Archived class card ⋯: Mostrar código, Desarquivar.
- **Archived class = read-only** for everyone (no new activities/deliveries/messages/notices/grades, code rejects requests); members still read it; teacher/admin can **unarchive** (both audited).
- Dialogs ("Entrar em uma turma", "Código da turma", "Alterar cor e nome", confirmations) = centered modal; bottom sheet on phones.
- "Ver arquivadas" swaps the list on the same screen ("Ver ativas" to return). Student "Turmas" page uses the same red banner (Entrar em uma turma + Ver arquivadas).
- Class page tabs: teacher Atividades, Entregas, Notas, Chat, Avisos, Alunos; student Atividades, Notas, Chat, Avisos (students can't list classmates). Unbuilt tabs show "em construção" + the phase.
- Admin tools live in `/admin/` sections: Professores pendentes, Turmas (Nova turma + per-class "Gerenciar": code, add active professor, requests, add student by e-mail, remove, archive), Representantes do curso.

**Activities, deliveries, grades (decision "A3", final)**
- Delivery doc id = student uid (one per student). `entregueEm == request.time`; `atrasada` computed by rules (`request.time > prazo`); accepted until `reabertaAte` or `prazo + 24h`, whichever is later.
- Two teacher actions: "Estender prazo" (changes `prazo`, audited `prazo_alterado`) and "Reabrir entrega até…" (sets `reabertaAte`, still flagged late, audited `entrega_reaberta`).
- Teacher corrects (`corrigida`) and grades **any time, no wait**.
- Student undoes within **4h** of delivering, **no other condition**; after 4h only teacher/admin (audited `entrega_desfeita`). Every undo writes `atividades/{a}/desfeitas/{aluno}` in the same batch. The grade item **stays** for the teacher, marked "entrega desfeita"; teacher can edit/delete it. **Students never write or delete grades.**
- A student sees a grade only if the sheet is published AND, for activity-linked sheets (`atv_{atividadeId}`, one per activity): their delivery doesn't exist or is ≥4h old, AND there's no `desfeitas` mark newer than the item's `atualizadoEm`. Non-activity sheets ("Prova 1") visible once published.
- Grades can be **unpublished** (audited `notas_despublicadas`). Max grade per sheet (`notaMax`, default 10), decimals allowed.
- **"Zero automático"**: do NOT implement or plan. If it seems to matter, ask Fernando with options during the Grades phase.

**Activities (Phase 5) — UI decisions by Fernando + how it works**
- Create/edit activity = **centered dialog** (bottom sheet on phone): título, prazo (date + time, default 23:59, always São Paulo = UTC-3, must be in the future), descrição (optional), nota máxima (optional, comma accepted, 0 < n ≤ 100). Edit changes only título/descrição/nota (empty field = field removed); the deadline changes only via ⋯ "Estender prazo" (must be later than current prazo and now). ⋯ also has "Reabrir entrega até…" (must be after now and after prazo+24h) and "Apagar atividade" (confirmation says how many deliveries go with it; one batch). Only the activity author sees Editar/⋯ and correction/undo buttons; other teachers of the class see read-only.
- Student delivers in a **dialog** opened from the activity row ("Entregar"): text and/or link (http/https only), disabled "Anexar arquivo · Disponível em breve", late warning; draft autosaved in localStorage (`fatesck-rascunho:{uid}:{turma}:{atividade}`), restored on reopen, cleared after delivering. After an undo the undone text/link come back as draft. The row then shows the receipt "Entregue em dd/mm às hh:mm (· com atraso)" + "Desfazer · 2h 10min" (4h window) + "Ver entrega" (dialog with what was delivered). Chips/countdowns refresh every minute.
- `atrasada` must equal the rules' server-time check: the client guesses with the device clock and, if refused within 5 min of the deadline, retries with the opposite value.
- "Ver entregas"/"Corrigir" open the **activity screen** at `inicial_professor/atividades/#{turmaId}/{atividadeId}`: header (prazo, reabertura, nota, chip), Editar + ⋯, progress "X de Y entregaram", card "Entregaram" (text, link, time, late, "Marcar como corrigida"/"Desmarcar", "Desfazer entrega" with audit) and card "Não entregaram" (shows "Entrega desfeita pelo aluno/professor em …"). "Corrigir" here only sets `corrigida`; numeric grades are Phase 6.
- Class page: teacher Atividades tab = preview 6 list ("+ Nova atividade", progress bar, "N entregas para corrigir"+Corrigir or state chip+"Ver entregas", Editar) + Resumo; **Entregas tab grouped by activity** (one card per activity, "Marcar como corrigida", "Abrir atividade"); the Entregas tab shows a red counter of the teacher's deliveries to correct. Student Atividades tab = same rows as the student's global page.
- Global "Atividades" page: filter by class (select; on phone above the list). Student: cards "Para entregar" and "Entregues e encerradas"; `#turma/atividade` in the URL (Início "Entregar") opens the delivery dialog. Teacher: all activities of active classes; new activities are created only inside the class page.
- **Class color on activity items** (Fernando, option A, after Phase 5 — APPROVED 2026-11-11; Vinho kept without outline unless Fernando asks): 6px stripe on the left with the class color (`comCorDaTurma()` in `componentes.js`, CSS `.com-cor`). Applied to: student Início "Atividades pendentes", student Atividades (both cards), class page activity rows (teacher and student), teacher global Atividades, teacher Início "Atividades para corrigir", Entregas tab cards, activity screen header. The class name stays written under the title (color is never the only signal). Preto `#15171A` and Grafite `#3B4048` get a light 1px outline on the stripe in the dark theme only (`data-cor-escura`). Screenshots: `site/prints-cor-da-turma/`.
- List order everywhere: still accepting deliveries first (closest limit on top), then closed (most recent deadline on top).

**Grades (Phase 6) — UI decisions by Fernando + how it works**
- Sheet ("Prova 1") grading = **large dialog** (`janelaFolha()` in `js/notas-ui.js`, `abrirJanela({ classe: "grande" })`): título + nota máxima editable by the author, one row per student (nota with comma + optional comment), live "X de Y com nota · média da turma", **saved only by "Salvar"** (or "Publicar", which saves first). Empty grade = no grade / deletes an existing one; comment without grade is refused. Closing with unsaved changes shows an inline warning first (close again to discard). Publishing with students without grade asks inline ("Publicar mesmo assim"). Despublicar asks inline, then audited `notas_despublicadas`.
- Activity grade = **grade field on each delivery** in the activity screen (plus on "Não entregaram" rows that already have a grade, e.g. "entrega desfeita" — grade stays, A3). Bar "Notas desta atividade": chip, count + class average, "Salvar notas", "Publicar notas"/"Despublicar" (confirmation dialogs). The sheet `atv_{atividadeId}` (title = activity title cut to 80 chars, notaMax = activity notaMax or 10) is created on the first save, in its OWN write before the grades (the item rules read the saved sheet). Unsaved typed grades survive screen reloads (module map) and the browser warns when leaving the page.
- Only the sheet author (activity author for activity sheets) edits/publishes; others see read-only. Changing nota máxima is written before the grades (rules compare with the saved max); lowering below an existing grade is refused in the client.
- Class page: teacher Atividades tab right column = "Resumo da turma" + **"Notas lançadas"** (preview 6: chip Publicada/Rascunho, "Publicada em dd/mm · média da turma 7,4" / "Rascunho · 12 de 32 notas lançadas", "Lançar notas"/"Ver notas"/"Abrir atividade", "+ Nova folha"); activity rows show "✓ Notas publicadas" when the activity sheet is published. Notas tab: teacher = all sheets + "+ Nova folha de notas" (creating opens the dialog); student = "Minhas notas" for that class.
- Global "Notas": student = **one card per class** (class color stripe, archived classes included with "(arquivada)"), only own published + visible grades ("9,5 de 10", comment), no final average/weights; teacher = one card per active class with its sheets and "+ Nova folha". A student reading a missing own grade gets an empty doc; hidden ones (A3) are refused → both shown as nothing (`minhaNota()` returns null).

**Notices & badges (Phase 7a) — decisions by Fernando + how it works**
- Avisos page (student and teacher, `js/paginas/avisos-comum.js`): **"Mural do curso" on top = wide red band** (like the home banner, megaphone icon, notices as white cards, up to 3 per row on desktop, 1 per row on phone, first 6 + "Ver todos (N)") — **more prominent than the class boards**; then **one card per active class** (class color stripe, first 5 + "Ver todos"). This OVERRIDES the original text "course notices mixed with class notices, no separate area" on this page; the home "Avisos recentes" card stays mixed (preview 1).
- Publish = **button + dialog** (`janelaAviso()` in `js/avisos-ui.js`): teacher "+ Novo aviso" on each of their class cards and in the class Avisos tab; active representative "+ Novo aviso do curso" on the mural (`autorPapel: "representante"`); admin publishes course notices in `/admin/` (`autorPapel: "admin"`). Admin cannot post class notices (rules).
- Edit/delete via ⋯ on the notice (author while allowed; admin any, in `/admin/` > Avisos): edit = same dialog, audited `aviso_editado` (detalhes keep the old text); delete = confirmation, audited `aviso_apagado` with fixed id `aviso_apagado_turma_{t}_{id}` / `aviso_apagado_curso_{id}`. Labels "Professor / Representante / Ex-Representante / Administração" from `rotuloPapel()`; edited notices show "· editado".
- **Mark as seen = opening the page** (`marcarVisto()` writes `usuarios/{uid}/leituras/{chave}` with server time): Avisos page → `curso_avisos` + `turma_{t}_avisos` of all shown classes; class Avisos tab → that class; student Atividades page → `turma_{t}_atividades` of all classes; class Atividades tab (student) → that class. "Novo" chip (and light red background) uses the leituras read BEFORE marking, so it stays while the page is open.
- Menu counters on ALL internal pages (`js/contadores.js`, called by `app.js` after the page mounts; the home pages keep their own): Atividades (student: activities created after the last visit), Avisos (notices by OTHER people after the last visit, class + course), Chat (unread messages; marking as read comes in 7b).
- Admin `/admin/` new sections (`admin/avisos-registro-admin.js`): **Avisos** (mural do curso: publish + edit/delete any; class notices by class select: edit/delete) and **Registro de alterações** (newest first, 30 per page + "Carregar mais", filters Tipo and Turma, line = date · author · action in Portuguese · class + detalhes). Portuguese names of actions in `js/auditoria-util.js` (a test checks they match the rules list). Composite indexes for the filtered queries added to `firestore.indexes.json` (acao+criadoEm, turmaId+criadoEm, acao+turmaId+criadoEm).

**Chat (Phase 7b) — decisions by Fernando + how it works**
- Fernando's choices: reuse the earlier chat draft as a base; desktop = **list on the left + conversation on the right**; phone = **list first, then the conversation full screen** with a back arrow (browser "back" also returns to the list); messages = **bubbles** (mine on the right in red, others on the left with name + role tag, day separators "Hoje/Ontem/date").
- Chat page (`js/chat-ui.js` `montarChat()`; student and teacher): list "Turmas" (archived ones included, chip "Arquivada", read-only) + "Conversas com professores/alunos", each with its own unread counter; nothing opens by itself (placeholder "Escolha uma conversa"); "+ Nova conversa" dialog (class → people; student sees only teachers of own classes, teacher sees the students of own classes; no student↔student — rules). Deep link `?abrir=turma_{id}` / `?abrir=conversa_{id}`. Class page Chat tab = only that class conversation (`turmaFixa`).
- Real time: `onSnapshot` (`js/chat.js`: `ouvirMensagens` last 300, `ouvirNovas` for unread, `ouvirMinhasConversas`). Enter sends on desktop, Shift+Enter = new line; max 2000 chars.
- Unread / read: `usuarios/{uid}/leituras/turma_{id}_chat` and `conversa_{id}`; opening a conversation (page visible) marks it read (400 ms debounce). The Chat menu counter is live on the Chat page (`contadorAoVivo("chat")` in `app.js`); other pages compute it once on load.
- Delete: trash button next to each message — class teacher (class chat, class not archived) or admin (both kinds); confirmation dialog; audit `mensagem_removida` with fixed id; **the deleted text is NOT stored in the audit entry** (only whose message and where).
- Admin: `/admin/` section "Chat" (`admin/chat-admin.js`): select with class chats and private conversations, read-only in real time, trash to delete (not in archived classes). Admin never writes in chats.
- Private conversation id `{profUid}_{alunoUid}`. **Decided by Fernando (7b approval): the private chat stays ALWAYS open for writing, even after the class is archived**; only the class chat becomes read-only.
- **Decided by Fernando (7b approval): the "Professor" tag IS shown in private chats** (replaces the old "Private chats: no tag"). "Representante"/"Ex-Representante" tags are class-chat only.
- Seed: the archived class Algoritmos (`turma-alg`) has 4 old class-chat messages (teacher, student, representative) to test the read-only screen.
- No rules change was needed in 7b.

**Representatives & authorship**
- `representantes/{alunoUid}`: only admin adds/removes (audited); **no limit** on how many. Readable by active users.
- Course-wide notices `avisosCurso`: posted by an active representative or admin; edited/deleted (audited) by their author while still a representative, or by admin. Visible to all active users, mixed with class notices (no separate area).
- Every notice/message shows **who posted it and the role**: "Professor" / "Representante" / "Administração", validated by rules from real data. Removed representatives: old notices AND chat messages show **"Ex-Representante"** (computed from current `representantes`).
- Class chat messages carry `autorPapel` checked by rules: a representative can't hide the tag; a normal student can't use it. Private chats: only the "Professor" tag (shown by the client from `professorUid`; no `autorPapel` field), never Representante/Ex-Representante.
- Class notices: only class teachers post (`autorPapel: 'professor'`); author or admin edit/delete (audited `aviso_editado`, `aviso_apagado`).

**Chat & audit**
- Chat message deletion = **hard delete** (document removed), teacher (class chat) or admin (both kinds), audited `mensagem_removida`. Students can't delete messages (even their own). Admin can read chats (no E2E for this prototype).
- **Audit log mandatory**, enforced by rules: audited create/update carries `auditoriaId` and the rule checks (`getAfter`) a fresh entry by the same author with the right action/target; audited deletes use a deterministic id + `existsAfter`. `auditoria` is append-only, admin-read-only. Actions allowed by the rules now also include `notas_apagadas`.

**UI decisions**
- Teacher "Início" = summary screen (approved draft): banner (Turmas ativas, Atividades para corrigir, Mensagens não lidas) + "Atividades para corrigir" (5 oldest + "Ver todas") + "Avisos recentes". "Minhas turmas" is the preview screen 5.
- Login/signup/verify/pending/admin screens: keep their card layout, new tokens/font/3px red top border only. Password field has an "eye" button to show/hide the password (asked by Fernando after Phase 5; `ligarMostrarSenha()` in `ui.js`, called by `iniciarLogin`, so aluno/professor login + signup + admin).
- Phone (≤520px): red header with logo + bell (Avisos, counter) + door (Sair) + avatar; bottom bar Início, Turmas, Tarefas, Chat, Notas; floating theme toggle. Student phone home shows 2 pending activities + "Ver todas as atividades (+N)"; desktop shows 3.
- Theme persisted in localStorage (`fatesck-tema`), first visit follows `prefers-color-scheme`.

## 4. How to run (from this folder)

```bash
npm install            # first time
npm run emulators      # Auth 9099, Firestore 8080, Emulator UI 4000 (hub 4400), site http://127.0.0.1:5000/
npm run seed           # (other terminal) wipes and reloads emulator data; prints accounts and class codes
npm run links          # lists e-mail verification / password reset links generated by the Auth emulator
npm run test:rules     # all tests (rules + utilities) inside a temporary Firestore emulator; must be green
npm run icones         # regenerates PWA icons from midia/logo.png (sharp)
node scripts/gerar-paginas.cjs   # regenerates internal page HTML shells + entry-page <head>
```
- Java (JDK 21+) is required by the Firestore emulator; `scripts/firebase-cli.mjs` finds the Android Studio JDK (`C:\Program Files\Android\openjdk\...`) automatically.
- `npm run test:rules` needs port 8080 free (stop `npm run emulators` first).
- In the emulator, verification links appear in the emulators terminal, in the Emulator UI **Logs** tab, and via `npm run links`. Password reset links need `&newPassword=...` appended (emulator behavior).
- Seed accounts (password: constant `SENHA_TESTE` in `scripts/seed.mjs`; never repeat it in chat):
  - admin `admin.teste@cps.sp.gov.br` (use `/admin/`)
  - professors: `helena.souza@cps.sp.gov.br` (Banco de Dados I, Sistemas Operacionais, Algoritmos [archived]), `rogerio.alves@cps.sp.gov.br` (Engenharia de Software, Redes de Computadores), pending `marcos.lima@cps.sp.gov.br`
  - students `@aluno.cps.sp.gov.br`: ana.costa, bruno.martins (rep), camila.ferreira (rep), diego.nascimento (rejected request in ES), eduarda.lopes, felipe.araujo (no class; pending request in BD)
- The in-app browser pane does not support service workers; test PWA in Edge/Chrome.

## 5. Known points / announced for later

- Unread counts ("Novidades", menu badges) count everything since the last visit, but nothing marks things as seen yet → numbers are high until Phase 7. Badges are only computed on the home pages for now.
- "Minhas turmas" cards slightly narrower than preview 5.
- Chat is built (7b). The seed's archived class now has chat messages (read-only footer, no trash buttons, no text field). After `npm run seed` every logged-in browser session is lost (accounts are recreated) — log in again.
- In-app browser pane: screenshots often time out or come cropped/tiled — retry, or use the `zoom` action on the full viewport; in phone emulation the tool's clicks land in the wrong place (use the element's `.click()` to check). This is the tool, not the site.
- Admin has NO activities UI yet (the rules already let admin edit/extend/reopen/undo/correct). Ask Fernando if it is wanted.
- Deleting an activity leaves its `desfeitas/*` docs behind (rules forbid deleting them); harmless, nobody lists them without the activity.
- Activities of archived classes don't appear on the global "Atividades" pages (only inside the archived class page, read-only).
- The in-app browser pane sometimes keeps an old `css/base.css` in memory even with `Cache-Control: no-store`; after CSS edits reload with Ctrl+F5 (or re-link the stylesheet with `?v=`).
- Sheet deletion (fix after Phase 6, decided by Fernando): ONLY a DRAFT sheet (never a published one), by its author or the admin, class not archived, with confirmation and audit `notas_apagadas` (fixed id `folha_apagada_{turma}_{folha}_{criadoEm ms}`); `apagarFolha()` deletes the grades (itens) + the sheet + the audit entry in one batch (35 grades fit). Buttons: "Apagar rascunho" in the sheet dialog (inline "Confirmar apagar"), in the activity screen grade bar (confirmation dialog) and in admin > Notas. An activity sheet `atv_{id}` can be created again after deletion.
- Admin "Despublicar" (fix after Phase 6): admin > Notas shows "Despublicar" on published sheets (confirmation dialog, audit `notas_despublicadas`) and "Apagar rascunho" on drafts; not shown for archived classes. Admin still does not type grades.
- Student Notas page keeps archived classes marked "(arquivada)" (confirmed by Fernando).
- In the in-app browser pane, use `http://localhost:5000` for a second logged-in person (different origin = separate session from `127.0.0.1:5000`).
- Phase 8: ensure every remaining `alert()`-free, error-handled flow; mobile tables as stacked cards.
- Phase 9 README must explain (as instructions for Fernando, never executed by Claude): create the first admin by hand (Auth user + `admins/{uid}` doc with `nome`, `email`); how to change the admin later (create/delete `admins/{uid}`); add the Vercel domain to Firebase Auth **authorized domains**; deploy `firestore.rules` and `firestore.indexes.json` (collection-group indexes on `membros.uid` and `pedidos.uid`, and the `auditoria` composite indexes used by the admin log filters); publish to Vercel; that the real config in `js/firebase.js` is used only outside localhost.
- Old pages "Disciplinas", "Notificações", "Correções" were removed; old collections (`disciplinas`, `envios`, top-level `atividades/avisos`) are no longer used.

## 6. Where things are

- Entry pages: `inicio/`, `login_aluno/`, `login_professor/`, `verificar_email/`, `aguardando_liberacao/`, `admin/` (`script.js` login+pending teachers, `gerenciar.js` classes+representatives).
- Internal pages (HTML shells, all load `js/app.js`): `inicial_aluno/{index,turmas,turma,atividades,notas,chat,avisos}`, `inicial_professor/{same}`. Class page URL: `.../turma/?id={turmaId}#aba`.
- `js/`: `firebase.js` (emulator on localhost), `auth.js` (session, routing `destino()`, login/signup/reset/orphan fix, domain check), `app.js` (shell: sidebar, phone header/bar, routing to `js/paginas/*`, list `PRONTAS`), `ui.js` (`el()`, `esc()`, `toast()`, skeletons, `abrirJanela()`, `abrirMenu()`, `copiar()`, `confirmar()`, `guardado` = safe localStorage), `componentes.js` (banner, card, class card, chips, notices, role labels), `dados.js` (Firestore reads), `turmas.js` (class/request/admin writes), `turmas-ui.js` (color form, dialogs, ⋯ menus, join dialog), `datas.js` (São Paulo time formatting, date/time fields ↔ ms), `prazos.js` (deadline state/chips, 4h undo window, form validation, list order, draft key — pure, unit-tested), `atividades.js` (activity/delivery writes), `atividades-ui.js` (activity dialogs, ⋯ menu, teacher/student rows, delivery dialog), `notas.js` (sheet/grade writes), `notas-ui.js` (sheet dialog, new sheet, sheet rows, student card), `notas-util.js` (parse/format grade, average — pure), `avisos.js` (notice writes + `marcarVisto()`), `avisos-ui.js` (notice dialog, notice item with ⋯, mural, class board), `contadores.js` (menu counters), `auditoria-util.js` (action names — pure), `tema*.js`, `icones.js`, `pwa.js`.
- `js/paginas/`: `aluno-inicio.js`, `aluno-turmas.js`, `aluno-comum.js`, `aluno-atividades.js`, `aluno-notas.js`, `professor-inicio.js`, `professor-turmas.js`, `professor-comum.js`, `professor-atividades.js` (global list + activity screen with grade fields), `professor-notas.js`, `avisos-comum.js` + `aluno-avisos.js`/`professor-avisos.js` (thin wrappers), `turma.js` (class page, both roles). Admin: `admin/notas-admin.js`, `admin/avisos-registro-admin.js`.
- `css/base.css` (tokens light/dark, all components, phone ≤520px).
- `firestore.rules` (authoritative schema), `firestore.indexes.json`, `firebase.json`, `.firebaserc` (`demo-fatesck`).
- `tests/` (node:test + @firebase/rules-unit-testing; `apoio.mjs` base scenario; 283 tests at end of Phase 4; 314 at end of Phase 5; 329 at end of Phase 6; 339 with the Phase 6 fixes; **353 at end of Phase 7a** — `aprovar-todos.test.mjs`, `fase5-fluxos.test.mjs`, `fase6-fluxos.test.mjs`, `fase7a-fluxos.test.mjs`, `fase7b-fluxos.test.mjs` (client writes/queries; **380 at end of Phase 7b**), `utilitarios.test.mjs` (pure helpers)).
- `scripts/` (`config.mjs` ports/project, `firebase-cli.mjs`, `emuladores.mjs`, `servidor.mjs`, `seed.mjs`, `links.mjs`, `gerar-icones.mjs`, `gerar-paginas.cjs`).
- PWA: `manifest.webmanifest`, `sw.js` (app shell only, never Firestore/other origins), icons in `midia/icones/`.
- Screenshots: preview `site/prints-previa/`; delivered `site/prints-fase3/`, `site/prints-fase4/`, `site/prints-fase5/`, `site/prints-cor-da-turma/`, `site/prints-fase6/`, `site/prints-correcoes-fase6/`, `site/prints-fase7a/`, `site/prints-fase7b/` (also holds `saida-dos-testes.txt`).
- Chat files (7b): `js/chat.js` (listeners + writes), `js/chat-ui.js` (`painelConversa()`, `montarChat()`), `js/paginas/aluno-chat.js` / `professor-chat.js`, `admin/chat-admin.js`; helpers `horaCurta()`/`rotuloDia()` in `datas.js`; CSS block "Fase 7b — chat" at the end of `css/base.css`.

## 7. Temporary demo on Vercel (prepared 2026-11-12, before the general review)

- Purpose: a friend of Fernando's looks at the site with all seed classes/students. Option B chosen: separate demo Firebase project + Vercel; real `fatesk-3819c` untouched.
- `js/firebase.js` picks the project by hostname: localhost/127.0.0.1 → emulator (`demo-fatesck`); `*.vercel.app` → `configDemo` from **`js/config-demo.js`** (throws if it is `null` or equals the real project); anything else → real config. `sw.js` caches `js/config-demo.js`.
- `js/config-demo.js`: `configDemo = null` until Fernando pastes the demo web config (not secret).
- **`npm run seed:demo`** (`scripts/seed-demo.mjs`, uses devDependency `firebase-admin`): loads the SAME data as the emulator seed into the demo project (wipes its Firestore, recreates the 10 accounts with verified e-mail and `SENHA_TESTE`). Guards (tested): refuses empty config, the real project id, a key of another project, a key inside the project folder. Needs `GOOGLE_APPLICATION_CREDENTIALS` = path to the demo service-account key kept OUTSIDE this folder. Dates are relative to when it runs.
- `scripts/seed.mjs` now exports `montarEscritas()`, `CONTAS`, `resumoContas()`, `conferir()`, `SENHA_TESTE`; its main part only runs when executed directly.
- **`.vercelignore`** keeps out CLAUDE.md, README, docs, tests, scripts, node_modules, logs, all `*.json`, firebase files → Vercel serves a plain static site.
- Fernando's commands (never run by Claude): `npx firebase-tools login`; `npx firebase-tools deploy --only firestore --project <demo-id>`; `npm run seed:demo`; `npx vercel --prod`; add the `*.vercel.app` domain to Auth authorized domains. Afterwards delete the Vercel project and the demo Firebase project.
- Tests after these changes: 380/380.
- **What actually happened (2026-11-12):** Fernando was on remote access without a terminal, so he EXPLICITLY authorized Claude to run the steps for `fatesck-demo` only. Done by Claude: rules published via `firebase-admin` `releaseFirestoreRulesetFromSource` (`firebase deploy` failed: the service account lacks serviceusage permission); `seed:demo` (10 accounts, 122 docs); Vercel login (device code approved by Fernando) + `vercel link` → project `candiru0-s-projects/fatesck-demo` + `vercel deploy --prod` → **https://fatesck-demo.vercel.app** (CLAUDE.md, scripts, json, .env return 404); `fatesck-demo.vercel.app` added to Auth authorized domains via Identity Toolkit API. The Vercel CLI created `.vercel/` (project link) and `.env.local` (OIDC token; deleted right away) and appended `.vercel` + `.env*` to `.gitignore`; `.vercelignore` also excludes them.
- Firestore indexes (3 `auditoria` composites + collection-group `membros.uid`/`pedidos.uid`) were first refused (403); Fernando then gave the key's service account the role "Cloud Datastore Index Admin" in Google Cloud IAM and Claude created all 5 via the Firestore REST API — all READY on 2026-11-12. (Without them the student class list and requests don't load.)
- The demo service-account key was uploaded by Fernando through the chat (stored in `~/.claude/uploads/`, outside this folder). When the demo ends: delete the Vercel project, the `fatesck-demo` Firebase project (invalidates the key) and the key file.
