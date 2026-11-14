# Padrões de UI para notificações dentro do app

> Pesquisa para o ticket [#14](https://github.com/fabricioOpus/cohort-005-project/issues/14), parte do mapa [#11 — notificações no Cadence](https://github.com/fabricioOpus/cohort-005-project/issues/11).
> Pergunta: quais padrões de UI existem para notificações dentro de um app web, quando usar cada um e o que cabe no Cadence.
> Data: 2026-11-14.

As três notificações do mapa são: **Comment novo** num Course → Instructor dono; **Lesson nova disponível** → Students com Enrollment ativo; **resposta a um Comment** → autor do Comment.

## 1. O que o Cadence já tem

Tudo verificado no código desta branch:

- **Layout** (`app/routes/layout.app.tsx`): sidebar fixa à esquerda (`app/components/sidebar.tsx`), `<main>` com scroll e `<Toaster position="bottom-right" richColors closeButton />` do `sonner`. Não há header/masthead: o único lugar natural para um sino é o topo da sidebar (ao lado do logo "Cadence") ou o rodapé dela (perto do usuário/Settings).
- **Sidebar**: lista estática de `navItems` por papel. O item "Questions" (`/instructor/questions`, papéis Instructor e Admin) **não mostra contagem** hoje.
- **`instructor.questions`**: fila de Comments de primeiro nível sem resposta de staff, ordenada do mais novo ao mais antigo. Marca como "stale" depois de `STALE_AFTER_DAYS = 3`, responde inline via `useFetcher` e confirma com `toast.success("Reply posted.")`/`toast.error(...)`. Estado vazio: ícone verde + "You're all caught up". A fila **já é uma caixa de entrada orientada a tarefa**: o item sai quando é respondido, não quando é "lido".
- **sonner 2.0.8** (instalado): a região do Toaster já é `aria-live="polite"`, `aria-relevant="additions text"`, rótulo padrão `"Notifications"` e atalho `Alt+T` para focar a região; padrão de 3 toasts visíveis e duração de 4000 ms (constantes `VISIBLE_TOASTS_AMOUNT` e `TOAST_LIFETIME` em `node_modules/sonner/dist/index.mjs`; props documentadas em [sonner — Toaster](https://sonner.emilkowal.ski/toaster)).
- **Componentes shadcn instalados** (`app/components/ui/`): button, card, input, label, select, skeleton, tabs, textarea, chart. **Não há** popover, dropdown-menu nem badge ainda; o pacote `radix-ui` (^1.4.3) já está nas dependências, então adicioná-los é barato.
- **Revalidação**: no modo framework do React Router com SSR, "route loaders are automatically revalidated after all navigations and form submissions" ([React Router — Route Module, shouldRevalidate](https://reactrouter.com/start/framework/route-module#shouldrevalidate)). Ou seja, uma contagem calculada no loader de `layout.app.tsx` se atualiza sozinha a cada navegação ou envio de formulário, sem infraestrutura nova.

## 2. Vocabulário: indicador × notificação

A Nielsen Norman Group separa três coisas ([NN/g — Indicators, Validations, and Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/)):

- **Indicador**: destaca um elemento da página porque algo nele mudou; é contextual (fica junto ao elemento), condicional e **passivo** — não exige ação.
- **Notificação**: avisa sobre ocorrências gerais do sistema, normalmente não disparadas pela ação imediata do usuário. Pode ser **action-required** (urgente, intrusiva) ou **passiva** (informativa, menos intrusiva, mas "can easily be missed").
- **Validação**: ligada a uma entrada do usuário.

As três notificações do Cadence são **passivas** (nenhuma bloqueia o usuário). Isso favorece padrões persistentes e pouco intrusivos (badge, inbox, indicador inline) em vez de padrões que interrompem.

## 3. Catálogo de padrões

### 3.1 Sino com contador + painel (dropdown/drawer)

**O que é.** Um ícone de sino num lugar fixo da moldura do app; um badge sinaliza não lidas; clicar abre um painel com a lista recente. No PatternFly, o badge "will be located in the masthead" e "clicking the icon (or anywhere within the badge) will toggle the notification drawer" ([PatternFly — Notification badge](https://www.patternfly.org/components/notification-badge/design-guidelines)). O painel tem cabeçalho com a contagem de não lidas ("If unread notifications exist, report the number of unread notifications. Otherwise leave blank"), ação global "Mark all read", ações por item ("Mark as read", "Clear") e não lidas em negrito ([PatternFly — Notification drawer](https://www.patternfly.org/components/notification-drawer/design-guidelines)).

**Quando usar.** Quando há vários tipos de evento que não pertencem a uma única seção da navegação — no Cadence, o Student recebe "Lesson nova" e "resposta ao seu Comment", que vivem em Courses diferentes.

**Quando não usar.** O PatternFly avisa que o estado de não lida só faz sentido se o usuário consegue marcar como lida e se notificações novas são infrequentes: "If unread notifications will be present most of the time, alerting the user in this way looses its effect" ([PatternFly — Notification badge](https://www.patternfly.org/components/notification-badge/design-guidelines)). Para um Instructor com muitos Comments, um sino eternamente aceso perde valor.

**Custo.** Médio. Precisa de: tabela de notificações com `readAt`, contagem no loader do layout, componente Popover (Radix), action para marcar lida/todas. O Popover do Radix já resolve teclado e foco: segue o padrão WAI-ARIA Dialog e "Escape … closes the popover and moves focus to `Popover.Trigger`" ([Radix — Popover](https://www.radix-ui.com/primitives/docs/components/popover)). Espaço: o Cadence não tem header, então o sino vai para a sidebar.

### 3.2 Página de caixa de entrada (inbox)

**O que é.** Uma rota dedicada com a lista completa, filtros e triagem. O GitHub: "Your inbox shows all of the notifications that you haven't unsubscribed to or marked as Done"; mostra lidas e não lidas por padrão, com filtro `is:unread`; ações **Read/Unread**, **Done** (remove da inbox, retido por 3 meses), **Save** (mantido indefinidamente) e **Unsubscribe**; ações em lote selecionando vários itens ([GitHub Docs — Managing notifications from your inbox](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)). O Linear chama a inbox de "your notification center", tem aba **Priority** que "separates notifications that need your attention from other updates", snooze, atalhos (`U` lida/não lida, `Option/Alt+U` marca todas) e limite de 2.000 itens abertos ([Linear Docs — Inbox](https://linear.app/docs/inbox)). O Slack tem a visão **Unreads**, com "Mark as Read" por conversa e "Mark All Messages Read" no fim da lista ([Slack Help — View all your unread messages](https://slack.com/help/articles/226410907-View-all-your-unread-messages)).

**Quando usar.** Quando o volume justifica triagem, ou como "ver tudo" atrás de um painel do sino. O Carbon recomenda: "Consider using a notification center where a user can revisit and act on past notifications" ([Carbon — Notification usage](https://carbondesignsystem.com/components/notification/usage/)).

**Quando não usar.** Para volume baixo, uma página inteira é desproporcional; o painel do sino basta. Para o Instructor, **`instructor.questions` já é a inbox de trabalho** dos Comments de primeiro nível — duplicá-la cria duas filas com semânticas diferentes (lida × respondida).

**Custo.** Médio a alto (rota, paginação, filtros, ações em lote). Barato se for só a lista paginada com "marcar todas como lidas".

### 3.3 Toast / snackbar / flag

**O que é.** Mensagem curta, não modal, temporária. Carbon: "Toast notifications are non-modal, time-based window elements used to display short messages"; podem expirar após cerca de 5 s, devem ter botão de fechar e, como somem, "users should be able to find the information elsewhere" ([Carbon — Notification usage](https://carbondesignsystem.com/components/notification/usage/)). Atlassian (flag): "Default flags are for general, event-driven messages that are dismissible"; "Never use auto dismiss flags for any critical warning or error messages"; empilham com o mais recente no topo ([Atlassian — Flag](https://atlassian.design/components/flag/usage)).

**Quando usar.** Confirmação da **ação do próprio usuário** (é o que o Cadence já faz com "Reply posted."). Para eventos de terceiros só faz sentido se houver entrega em tempo real enquanto a pessoa está na tela — e sempre como **eco** de algo que também fica no sino/inbox.

**Quando não usar.** Como único canal de uma notificação. O Primer (GitHub) é taxativo: "Toasts pose significant accessibility concerns and are not recommended for use", citando WCAG 2.2.1 (tempo), 1.3.2 (ordem de leitura), 2.1.1 (teclado) e 4.1.3, além de toasts que passam despercebidos em telas grandes e somem antes de serem lidos ([Primer — Accessible notifications and messages](https://primer.style/accessibility/patterns/accessible-notifications-and-messages/)). A NN/g também aponta toasts como má escolha para erros ([NN/g — Indicators, Validations, and Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/)).

**Custo.** Quase zero para a UI (sonner já montado); o custo real está em ter algo que dispare o toast em tempo real (ver 3.10).

### 3.4 Badge de contagem em item da navegação

**O que é.** Um número junto a um item da navegação ("Questions 4"). A Atlassian: "Use badges to represent numerical data such as counts and metrics" e "Use badges alongside a label to clearly show which item is quantified"; números devem respeitar o locale ([Atlassian — Badge](https://atlassian.design/components/badge/usage)). PatternFly: a contagem é útil "especially when unread status isn't shown" ([PatternFly — Notification badge](https://www.patternfly.org/components/notification-badge/design-guidelines)). O Slack Unreads e o Linear (contagem do badge configurável pela aba Priority — [Linear Docs — Inbox](https://linear.app/docs/inbox)) seguem a mesma ideia.

**Quando usar.** Quando a contagem representa **trabalho pendente que vive numa seção específica** — o caso exato de "Questions" para o Instructor: o número é "Comments sem resposta", e zera quando ele responde, não quando ele "lê".

**Quando não usar.** Quando o número cresce sem que o usuário consiga zerá-lo, ou quando não há rótulo junto ("Don't use badges without context" — [Atlassian — Badge](https://atlassian.design/components/badge/usage)).

**Custo.** Baixo. Uma `count(*)` reaproveitando a consulta de `getUnansweredQuestions` no loader do layout, e um `<span>` no `NavLink`. Nenhuma tabela nova.

### 3.5 Indicador inline ("novo", ponto, negrito)

**O que é.** Marca contextual no próprio conteúdo: pílula "Nova" numa Lesson, ponto num Course do "recentes", negrito numa resposta ainda não vista. É o **indicador** da NN/g: contextual, condicional e passivo, "shown in close proximity to that element" ([NN/g — Indicators, Validations, and Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/)). O PatternFly usa negrito para não lidas: "Unread messages are displayed in bold-faced type" ([PatternFly — Notification drawer](https://www.patternfly.org/components/notification-drawer/design-guidelines)). Para conteúdo não numérico, a Atlassian sugere lozenge em vez de badge ([Atlassian — Badge](https://atlassian.design/components/badge/usage)).

**Quando usar.** Para "Lesson nova disponível": o Student vê no próprio Course/sidebar que há algo novo, sem depender de abrir o sino. Também para destacar, dentro do thread de Comments da Lesson, a resposta que motivou a notificação.

**Quando não usar.** Sozinho, para eventos que o usuário não vai encontrar navegando (uma resposta num Course que ele não abre há semanas).

**Custo.** Baixo a médio: precisa saber "desde quando é novo" (data da Lesson × última visita do Student, ou ligação com a notificação não lida).

### 3.6 Marcar como lida / marcar todas / concluir

- **Por item, implícito ao clicar**: "Single clicking a notification … marks it as read" ([PatternFly — Notification drawer](https://www.patternfly.org/components/notification-drawer/design-guidelines)).
- **Toggle explícito** lida/não lida: GitHub e Linear (`U`) ([GitHub Docs](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox), [Linear Docs](https://linear.app/docs/inbox)).
- **Todas**: "Mark all read" no menu global do drawer ([PatternFly](https://www.patternfly.org/components/notification-drawer/design-guidelines)); "Mark All Messages Read" no Slack ([Slack Help](https://slack.com/help/articles/226410907-View-all-your-unread-messages)); `Option/Alt+U` no Linear.
- **Done ≠ lida**: o GitHub separa "lida" de "Done" (sai da inbox) ([GitHub Docs](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)). No Cadence, para o Instructor, "Done" já tem significado de domínio: **responder** o Comment o tira da fila.

**Custo.** Baixo (coluna `readAt`, duas actions). "Done"/"Save"/snooze são YAGNI para o estudo.

### 3.7 Agrupamento

- **Por categoria**, com accordion e badge de não lidas por grupo; o PatternFly recomenda no máximo 3–4 categorias ([PatternFly — Notification drawer](https://www.patternfly.org/components/notification-drawer/design-guidelines)).
- **Por prioridade**: aba Priority do Linear ([Linear Docs](https://linear.app/docs/inbox)); filtros padrão do GitHub por motivo (assignments, participating, review requests, mentions) ([GitHub Docs](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)).
- **Por rajada**: a NN/g recomenda não disparar várias notificações seguidas — "If you have more than five notifications that you need to send at once, combine them into a single message" ([NN/g — Push notifications](https://www.nngroup.com/articles/push-notification/)). Embora o artigo trate de push, a lógica vale para o painel: 5 respostas no mesmo thread viram uma linha "5 novas respostas em <Lesson>".

**Para o Cadence.** Agrupar por **Comment/thread** (várias respostas ao mesmo Comment → uma linha) e, no máximo, por tipo. Agrupar por Course só se o Student tiver muitos Courses ativos.

### 3.8 Estados vazios

A NN/g pede que o estado vazio comunique o status do sistema ("Totally empty states cause confusion about how and whether the system is working"), ensine o recurso e ofereça caminhos diretos ([NN/g — Designing Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)). O Cadence já tem um bom modelo em `instructor.questions` ("You're all caught up" com ícone). Para o painel do sino: "Nenhuma notificação" + uma linha sobre o que vai aparecer ali (respostas aos seus Comments, Lessons novas) + link para os Courses. Mostrar "vazio" só depois do carregamento terminar (o Cadence já usa `Skeleton`).

### 3.9 Timestamps

Relativo para eventos recentes, absoluto para antigos; o PatternFly sugere relativo abaixo de uma hora ([PatternFly — Notification drawer](https://www.patternfly.org/components/notification-drawer/design-guidelines)). O Cadence já tem `formatRelativeTime` e `daysSince` em `~/lib/utils`.

### 3.10 Atualização: na navegação × tempo real

| Estratégia | Como | Custo | Observação |
|---|---|---|---|
| **Na navegação** | Contagem no loader de `layout.app.tsx`; revalida após toda navegação e envio de formulário ([React Router — Route Module](https://reactrouter.com/start/framework/route-module#shouldrevalidate)) | Zero infraestrutura | Atraso até a próxima navegação. Para notificações passivas, aceitável. |
| **Foco da janela / polling** | `useRevalidator().revalidate()` em `focus` ou intervalo — a doc cita "Window focus or polling on an interval" como casos de uso ([React Router — useRevalidator](https://reactrouter.com/api/hooks/useRevalidator)) | Baixo | Polling reexecuta **todos** os loaders da página; preferir foco da janela ou um `useFetcher` só da contagem. |
| **Server-Sent Events** | `EventSource` num resource route; conexão unidirecional que reconecta sozinha ([MDN — Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)) | Médio | Sem HTTP/2, limite de 6 conexões "per browser + domain", somando abas ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)). Necessário só se quisermos toast ao vivo. Provedores de notificação costumam trazer o próprio canal em tempo real — decidir junto com o provedor. |

### 3.11 Acessibilidade

- **Mensagens de status sem roubar foco** (WCAG 2.2, SC 4.1.3, nível AA): mensagens de status devem poder ser apresentadas por tecnologia assistiva "without receiving focus"; `role="status"` para resultados/estado, `role="alert"` para avisos e erros; usar `aria-live="assertive"` ou `role="alert"` em conteúdo não urgente é listado como falha ([W3C — Understanding SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)). Para o Cadence: mudança de contagem do badge → no máximo `polite`; nunca `alert`.
- **Toaster**: o sonner já usa região `aria-live="polite"` com rótulo "Notifications" e `Alt+T` (ver seção 1). Mesmo assim, toasts somem; o conteúdo precisa existir em outro lugar ([Primer](https://primer.style/accessibility/patterns/accessible-notifications-and-messages/), [Carbon](https://carbondesignsystem.com/components/notification/usage/)).
- **Botão do sino**: o número precisa estar no nome acessível (ex.: `aria-label="Notificações, 3 não lidas"`), não só visual. A Atlassian lembra de não depender só de cor e de formatar números conforme o locale ([Atlassian — Flag](https://atlassian.design/components/flag/usage), [Atlassian — Badge](https://atlassian.design/components/badge/usage)).
- **Painel**: Popover do Radix — foco gerenciado, `Tab`/`Shift+Tab`, `Escape` devolve foco ao gatilho ([Radix — Popover](https://www.radix-ui.com/primitives/docs/components/popover)).
- **Atalhos de teclado** são um diferencial de inbox (Linear `G I`, `J/K`, `U`; Slack `Cmd/Ctrl+Shift+A`) — fora do escopo do estudo, mas o mínimo é tudo operável por teclado.

### 3.12 Volume e controle

"Notifications are disruptive and annoy users when they are irrelevant"; ofereça controle de frequência e relevância dentro do app ([NN/g — Push notifications](https://www.nngroup.com/articles/push-notification/)). Carbon: "Notifications are disruptive… use them sparingly" ([Carbon](https://carbondesignsystem.com/components/notification/usage/)). Isso conversa com o item "desativar por tipo" do mapa #11: o painel do sino é o lugar natural para um link "Preferências".

## 4. Resumo comparativo

| Padrão | Persistente? | Melhor para | Custo no Cadence |
|---|---|---|---|
| Badge em item da nav | Sim | Trabalho pendente de uma seção (Questions) | Baixo |
| Indicador inline ("Nova") | Sim | Conteúdo novo achado navegando (Lesson) | Baixo–médio |
| Sino + painel | Sim | Eventos de vários Courses/tipos | Médio |
| Página inbox | Sim | Histórico, triagem, alto volume | Médio–alto |
| Toast | Não | Confirmar ação própria; eco ao vivo | ~0 (UI) / médio (tempo real) |

## 5. Combinações sugeridas para o Cadence

Entrada para o protótipo (ticket de prototype do mapa #11).

### A. Mínima, sem tempo real (recomendada para começar)

- **Instructor**: badge com a contagem de Comments sem resposta no item **Questions** da sidebar (mesma consulta de `getUnansweredQuestions`, só que `count`). Nenhum sino para Comment de primeiro nível: **a fila é a inbox**, e "Done" = responder. As **respostas** dentro de threads nos Courses dele (que não entram na fila, pois `parentId` não é nulo) e as respostas aos Comments dele aparecem no sino (abaixo).
- **Student e Instructor**: **sino com contador** no topo da sidebar, ao lado de "Cadence", abrindo um **Popover** com as ~10 mais recentes, agrupadas por Comment ("3 novas respostas em <Lesson>"), não lidas em negrito, "Marcar todas como lidas", clique marca como lida e navega para a Lesson com âncora no Comment. Estado vazio no estilo "You're all caught up".
- **Student**: pílula **"Nova"** na Lesson dentro do Course enquanto a notificação correspondente estiver não lida.
- **Atualização**: só na navegação (loader do layout) + revalidar no foco da janela.
- **Toast**: continua só para ações próprias.

### B. A + página de inbox

- Tudo de A, mais rota `/notifications` ("Ver todas" no rodapé do painel) com paginação, filtro "não lidas", ação em lote "marcar todas". Útil se o volume do Instructor crescer ou se o mapa decidir guardar histórico. Para o Instructor, a página **linka** para `instructor.questions` em vez de repetir os Comments de primeiro nível — uma notificação "Comment novo" clicada leva ao card na fila.

### C. A + tempo real

- Tudo de A, mais canal em tempo real (SSE próprio ou o do provedor escolhido) que atualiza o contador do sino e mostra um **toast discreto** ("Nova resposta de <nome> em <Lesson>", ação "Ver") ecoando a notificação que já está no painel. Respeitar `aria-live="polite"` (já padrão do sonner) e não usar auto-dismiss em nada que não esteja também no painel. Custo depende do provedor; adiar até a decisão de provedor do mapa.

### Coexistência com `instructor.questions`

- Duas semânticas distintas: **fila = trabalho** (sai quando respondido), **sino = novidade** (sai quando lido). Não misturar.
- Opção 1 (mais simples): Comment de primeiro nível **só** gera o badge de Questions, nunca entra no sino — evita contagem dupla.
- Opção 2: entra no sino também, e responder pela fila marca a notificação correspondente como lida automaticamente. Mais coerente com "uma notificação por evento" do mapa, porém mais acoplada.
- A escolha entre as duas é uma pergunta para o grilling/protótipo.

## Fontes

- [NN/g — Indicators, Validations, and Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/)
- [NN/g — Push notifications](https://www.nngroup.com/articles/push-notification/)
- [NN/g — Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/)
- [PatternFly — Notification badge](https://www.patternfly.org/components/notification-badge/design-guidelines)
- [PatternFly — Notification drawer](https://www.patternfly.org/components/notification-drawer/design-guidelines)
- [Primer — Accessible notifications and messages](https://primer.style/accessibility/patterns/accessible-notifications-and-messages/)
- [Atlassian Design System — Flag](https://atlassian.design/components/flag/usage)
- [Atlassian Design System — Badge](https://atlassian.design/components/badge/usage)
- [Carbon Design System — Notification usage](https://carbondesignsystem.com/components/notification/usage/)
- [W3C — Understanding SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [GitHub Docs — Managing notifications from your inbox](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)
- [Linear Docs — Inbox](https://linear.app/docs/inbox)
- [Slack Help — View all your unread messages](https://slack.com/help/articles/226410907-View-all-your-unread-messages)
- [Radix Primitives — Popover](https://www.radix-ui.com/primitives/docs/components/popover)
- [React Router — Route Module (shouldRevalidate)](https://reactrouter.com/start/framework/route-module#shouldrevalidate)
- [React Router — useRevalidator](https://reactrouter.com/api/hooks/useRevalidator)
- [MDN — Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [sonner — Toaster](https://sonner.emilkowal.ski/toaster) e código-fonte instalado (`node_modules/sonner/dist/index.mjs`, v2.0.8)

Não consultados com sucesso: as páginas do Material Design 3 (badges, snackbar) e do Apple HIG (notifications) renderizam via JavaScript e não puderam ser lidas; nenhuma afirmação deste documento se apoia nelas.
