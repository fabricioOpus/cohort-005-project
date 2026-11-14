# Provedores de notificação para o Cadence

Pesquisa do ticket [#13](https://github.com/fabricioOpus/cohort-005-project/issues/13), parte do mapa [#11](https://github.com/fabricioOpus/cohort-005-project/issues/11).
Fontes consultadas em **2026-11-14** (páginas oficiais de preço, docs e repositórios; versões via `npm view` no mesmo dia). Itens marcados **[não verificado]** não foram confirmados numa fonte primária: a página não dizia, ou a tabela de planos não pôde ser lida sem ambiguidade.

## Contexto e critérios

O Cadence (React Router + Node/TypeScript + SQLite/Drizzle) não tem infraestrutura de notificação nem de e-mail. As três notificações do mapa são: Comment novo → Instructor dono do Course; Lesson nova → Students com Enrollment ativo; resposta → autor do Comment. Canais candidatos: dentro do app, e-mail, Web Push.

Critérios: (1) plano gratuito suficiente para estudo; (2) fácil de rodar e testar localmente; (3) bom SDK Node/TypeScript.

O volume esperado num projeto de estudo é de dezenas a centenas de mensagens por mês, então qualquer plano gratuito abaixo descrito cobre o volume. O que diferencia os provedores é o **custo de integração e o atrito no desenvolvimento local**.

## Dois tipos de provedor

- **API de entrega de e-mail** (Resend, Postmark): só e-mail. Dentro do app, preferências e digest ficam por nossa conta.
- **Orquestrador de notificações** (Knock, Novu, Courier, MagicBell, SuprSend, OneSignal): workflows multicanal, inbox pronta, preferências e, em alguns, digest. O e-mail costuma sair por um provedor de e-mail plugado (ex.: Resend), então é uma dependência a mais.

## Provedores

### Resend (e-mail)

- **Canais:** só e-mail (transacional e broadcasts).
- **Inbox/sino:** não tem.
- **Preferências/descadastro:** broadcasts inserem o link de descadastro via placeholder `{{{RESEND_UNSUBSCRIBE_URL}}}`; e-mails transacionais não têm central de preferências ([pricing](https://resend.com/pricing)).
- **Digest:** não tem; seria implementado por nós.
- **Plano gratuito:** 3.000 e-mails/mês, **100/dia**, 3 domínios, 1 webhook, retenção de 30 dias ([pricing](https://resend.com/pricing)).
- **Desenvolvimento local:** endereços de teste `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`, `suppressed@resend.dev` (aceitam `+label`), que **contam na cota** ([docs](https://resend.com/docs/dashboard/emails/send-test-emails)). Precisa de rede e chave de API. Para trabalhar offline, o código pode ter um adaptador SMTP apontando para o Mailpit (abaixo).
- **SDK:** `resend` 6.38.1, MIT, escrito em TypeScript; casa com `react-email` (6.11.13, MIT) para templates em JSX (`npm view`, 2026-11-14).

### Postmark (e-mail)

- **Canais:** só e-mail (streams transacionais e de broadcast separados) ([pricing](https://postmarkapp.com/pricing)).
- **Inbox/sino, digest:** não tem.
- **Plano gratuito:** **100 e-mails/mês**, sem excedente, sem expiração ([pricing](https://postmarkapp.com/pricing)).
- **Desenvolvimento local:** token `POSTMARK_API_TEST` valida o request sem entregar; enquanto a conta não é aprovada, só envia para o mesmo domínio do remetente ([API overview](https://postmarkapp.com/developer/api/overview)). Existe um "sandbox mode" de servidor, cujos detalhes por plano ficaram **[não verificado]**.
- **SDK:** `postmark` 5.1.1, MIT (`npm view`).
- **Leitura:** excelente entregabilidade, mas a cota grátis de 100/mês é apertada e a aprovação de conta é um atrito para estudo.

### Knock (orquestrador)

- **Canais:** in-app feed, e-mail (via provedor plugado: Resend, SendGrid, SMTP etc.), push (APNs, FCM), SMS, chat ([integrações de e-mail](https://docs.knock.app/integrations/email/overview)). **Não tem Web Push de primeira classe**: a doc manda usar FCM no navegador com service worker do Firebase ([tutorial FCM web push](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)).
- **Inbox/sino:** `@knocklabs/react` traz `NotificationFeedPopover`, `NotificationFeed` e `NotificationIconButton` (sino com contagem), além de hooks headless ([React overview](https://docs.knock.app/in-app-ui/react/overview)).
- **Preferências/descadastro:** PreferenceSet por usuário (workflows, categorias, canais), central de preferências hospedada sem código ([preferences](https://docs.knock.app/concepts/preferences)); descadastro de 1 clique para e-mail "comercial", com cabeçalhos automáticos ([commercial unsubscribe](https://docs.knock.app/preferences/commercial-unsubscribe)). Componente React pronto de central de preferências: **[não verificado]**; a doc aponta um guia de construção com hooks.
- **Digest:** batch/digest incluídos no plano Free ([pricing](https://knock.app/pricing)).
- **Plano gratuito:** até 10.000 mensagens/mês, canais e feeds ilimitados, logs de 30 dias; não há corte rígido ao exceder ([pricing](https://knock.app/pricing)).
- **Desenvolvimento local:** ambiente de desenvolvimento separado; canal de e-mail de teste embutido (até 100/mês, só para membros da conta); **sandbox mode** por canal/ambiente renderiza o e-mail no dashboard sem entregar e sem contar na cota ([knock-test](https://docs.knock.app/integrations/email/knock-test)). É serviço cloud: não roda offline e não alcança SMTP em `localhost`.
- **SDK:** `@knocklabs/node` 1.41.1 (Apache-2.0) e `@knocklabs/react` 0.15.1 (MIT), ambos atualizados em novembro de 2026 (`npm view`).

### Novu (orquestrador; cloud e self-host)

- **Canais:** in-app, e-mail, SMS, chat, push ([pricing](https://novu.co/pricing)). Push via FCM, APNs, Expo, OneSignal, Pusher Beams, Pushpad, webhook; **Web Push (VAPID) nativo não aparece** na doc, o caminho para o navegador é FCM ou Pushpad/OneSignal ([push](https://docs.novu.co/platform/integrations/push)).
- **Inbox/sino:** `<Inbox />` em `@novu/react` (React 18+ e 19), com preferências embutidas e componente `Preferences` ([inbox overview](https://docs.novu.co/platform/inbox/overview)).
- **Preferências/descadastro:** por workflow e por canal na própria Inbox ([inbox overview](https://docs.novu.co/platform/inbox/overview)). Link de descadastro em e-mail: **[não verificado]**.
- **Digest:** passo `digest` com janela regular ou agendada, chave de agregação; só um digest por workflow ([digest](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest), [framework](https://docs.novu.co/framework/digest)). Limites de digest no Free: **[não verificado]**.
- **Plano gratuito (cloud):** 10.000 workflow runs/mês, até 5 workflows, 2 ambientes, retenção do activity feed de 24 h, 3 membros ([pricing](https://novu.co/pricing)).
- **Desenvolvimento local (cloud):** `npx novu@latest dev` abre o dashboard em modo Local e cria um túnel do Novu Cloud até o endpoint Bridge do app (`localhost:4000/api/novu` por padrão); exige rede e chave secreta ([studio](https://docs.novu.co/framework/studio)).
- **Self-host:** núcleo MIT, pasta `enterprise` sob licença comercial ([GitHub](https://github.com/novuhq/novu)). Rodar local exige MongoDB, Redis, LocalStack opcional, Node 22, pnpm e ~8 GB de RAM, com API, worker, WebSocket e dashboard separados ([run locally](https://docs.novu.co/community/run-in-local-machine)). A página de preço lista self-host apenas como Enterprise ([pricing](https://novu.co/pricing)) e a doc diz que algumas funções exclusivas do cloud ficam de fora no self-host, sem listar quais ([self-hosting](https://docs.novu.co/community/self-hosting-novu/overview)). **Desproporcional** para um app SQLite de estudo.
- **SDK:** `@novu/api` 3.19.1, `@novu/react` 3.19.2 (ISC), `@novu/framework` 2.14.0 (`npm view`).

### Courier (orquestrador)

- **Canais:** e-mail, SMS, chat, push mobile (APNs/FCM) e inbox via WebSocket ([inbox](https://www.courier.com/docs/platform/inbox/inbox-overview)). Web Push no navegador é roteado por OneSignal (ou outros terceiros), não por Courier ([push overview](https://www.courier.com/docs/external-integrations/push/intro-to-push)).
- **Inbox/sino:** `@trycourier/courier-react` v9 (React 18+), com contagem de não lidas, arquivar, tempo real ([inbox](https://www.courier.com/docs/platform/inbox/inbox-overview)).
- **Preferências:** central de preferências por tópico e canal ([inbox](https://www.courier.com/docs/platform/inbox/inbox-overview)); componente React específico **[não verificado]**.
- **Digest:** existe ([digest](https://www.courier.com/docs/platform/automations/digest)), mas a tabela de preço lista "Digest & batching" sob **Enterprise** ([pricing](https://www.courier.com/pricing)); disponibilidade no Free é **[não verificado]**, provavelmente ausente.
- **Plano gratuito:** Developer, 10.000 envios/mês (um envio = um template para um destinatário, mesmo multicanal); ambientes de teste contam na cota ([pricing](https://www.courier.com/pricing)).
- **SDK:** `@trycourier/courier` 10.0.0 (Apache-2.0), `@trycourier/courier-react` 9.3.5 (MIT) (`npm view`).

### MagicBell (orquestrador)

- **Canais:** in-app, e-mail (via SES, Mailgun, SendGrid, SMTP…), **Web Push com chaves VAPID próprias** (armazena `endpoint` + `p256dh`/`auth`), push mobile, Slack, SMS ([docs](https://www.magicbell.com/docs), [web push](https://www.magicbell.com/docs/channels/web_push)).
- **Inbox/sino:** `@magicbell/react` com `FloatingInbox`, `Inbox`, `ToastContainer`, `UserPreferences` e `WebPushButton` ([React](https://www.magicbell.com/docs/libraries/magicbell-react)).
- **Preferências:** `UserPreferences` (canal por categoria) ([React](https://www.magicbell.com/docs/libraries/magicbell-react)). Descadastro de e-mail: **[não verificado]**.
- **Digest:** **[não verificado]**.
- **Plano gratuito:** Builder, **1.000 entregas/mês**, contadas por canal (100 in-app + 50 e-mail = 150) ([pricing](https://www.magicbell.com/pricing)).
- **SDK:** `@magicbell/react` 1.14.0, sem licença declarada no npm (`npm view`).

### SuprSend (orquestrador)

- **Canais:** ilimitados no Free, incluindo Web Push, e feed in-app com marca SuprSend ([pricing](https://www.suprsend.com/pricing)).
- **Inbox/sino:** `@suprsend/react` (o antigo `@suprsend/react-inbox` está em fim de suporte; autenticação passou a JWT) ([docs](https://docs.suprsend.com/docs/inbox-react)).
- **Preferências e digest:** listados nos planos pagos (Business), **não no Free**; o Free libera tudo só por 30 dias de trial ([pricing](https://www.suprsend.com/pricing)).
- **Plano gratuito:** 10.000 notificações/mês ([pricing](https://www.suprsend.com/pricing)).
- **SDK:** `@suprsend/node-sdk` 1.15.1, MIT, última publicação em maio de 2026 (`npm view`).

### OneSignal (push-first)

- **Canais:** Web Push (Chrome, Firefox, Safari, Edge; iOS 16.4+ só com o site adicionado à tela inicial), push mobile, e-mail, SMS ([web push setup](https://documentation.onesignal.com/docs/en/web-push-setup)).
- **Inbox/sino:** **não há in-app para web**; in-app messages são só para SDK mobile ([in-app overview](https://documentation.onesignal.com/docs/en/in-app-messages-setup)).
- **Plano gratuito:** 10.000 e-mails/mês; push mobile e in-app ilimitados até 1.000 MAU; Web Push com máximo de 10.000 inscritos por envio ([pricing](https://onesignal.com/pricing)).
- **Desenvolvimento local:** exige HTTPS válido e o service worker do OneSignal; teste em `localhost` não é coberto pela página ([web push setup](https://documentation.onesignal.com/docs/en/web-push-setup)) **[não verificado]**.
- **SDK:** `@onesignal/node-onesignal` 5.20.0, MIT (`npm view`).

### Linha de base "sem provedor"

- **Dentro do app:** tabela `notifications` no SQLite via Drizzle, gravada na mesma action que cria o Comment/Lesson; sino e lista feitos com componentes do próprio app; leitura/não lida por coluna. Zero custo e zero rede; tudo testável com Vitest. Preferências por tipo também são uma tabela nossa. Digest exige um job agendado (não há infraestrutura de fila hoje).
- **E-mail:** Resend (API) em produção; em desenvolvimento, um transporte SMTP com `nodemailer` (10.5.0, MIT-0) apontando para o **Mailpit**, que captura tudo localmente (SMTP `1025`, UI `8025`, API REST para testes de integração; MIT) ([Mailpit](https://github.com/axllent/mailpit)). Descadastro: link assinado para uma rota nossa que altera a preferência.
- **Web Push:** biblioteca `web-push` 4.0.0 (MPL-2.0, Node >= 16; tipos em `@types/web-push` 3.6.4, MIT) gera chaves VAPID e cifra o payload (`aes128gcm`) ([GitHub](https://github.com/web-push-libs/web-push), `npm view`). Exige service worker e armazenar as inscrições (`endpoint`, `p256dh`, `auth`) no SQLite. Navegadores tratam `localhost` como contexto seguro, então dá para testar sem HTTPS **[não verificado em fonte primária nesta pesquisa]**. Sem custo de provedor (o serviço de push do navegador é gratuito).

## Tabela comparativa

| Provedor | In-app | E-mail | Web Push | Inbox React pronta | Preferências / descadastro | Digest no Free | Plano gratuito | Dev local | SDK Node/TS |
|---|---|---|---|---|---|---|---|---|---|
| Resend | não | sim | não | não | só broadcasts | não | 3.000/mês, 100/dia | `@resend.dev` (conta na cota); Mailpit via SMTP | ótimo, TS nativo |
| Postmark | não | sim | não | não | streams separados | não | 100/mês | token `POSTMARK_API_TEST` | bom |
| Knock | sim | via provedor | só via FCM | sim (popover, sino) | central hospedada + 1 clique | **sim** | 10.000 msgs/mês | env dev + sandbox sem custo; precisa de rede | ótimo, ativo |
| Novu Cloud | sim | via provedor | via FCM/Pushpad | sim (`<Inbox />` + prefs) | na Inbox | [não verificado] | 10.000 runs/mês, 5 workflows | `npx novu dev` + túnel | bom |
| Novu self-host | sim | via provedor | idem | sim | idem | sim (núcleo) | grátis (MIT), mas pesado | Mongo + Redis + 4 serviços, ~8 GB | idem |
| Courier | sim | via provedor | via OneSignal | sim | central de preferências | provavelmente não (Enterprise) | 10.000 envios/mês | testes contam na cota | bom |
| MagicBell | sim | via provedor | **sim, VAPID** | sim (+ `WebPushButton`) | `UserPreferences` | [não verificado] | 1.000 entregas/mês (por canal) | [não verificado] | médio |
| SuprSend | sim | via provedor | sim | sim | só pago | não (só pago) | 10.000/mês | [não verificado] | médio |
| OneSignal | **não na web** | sim | sim | não | [não verificado] | não | 10.000 e-mails; push até 1.000 MAU | HTTPS + SW deles | médio |
| Sem provedor | SQLite | Resend + Mailpit | `web-push` | fazemos nós | fazemos nós | job nosso | grátis | 100% offline | — |

## Recomendação por cenário

- **Só e-mail:** **Resend** + `react-email`, com Mailpit via SMTP em desenvolvimento para não gastar cota nem precisar de rede. Preferência por tipo e link de descadastro ficam numa tabela nossa (é pouco código). Postmark só se a entregabilidade importar mais que a cota de 100/mês.
- **Dentro do app + e-mail:** duas opções razoáveis. (a) **Sem provedor no in-app** (tabela SQLite + sino próprio) e Resend no e-mail: mais simples de testar, fica no domínio do Cadence e mantém a regra "uma notificação por evento" no nosso código. (b) **Knock** com Resend plugado, se quisermos aprender um orquestrador: é o único com digest e central de preferências no plano gratuito e sandbox sem custo de cota. Recomendação para estudo: **(a)**, deixando o digest de fora até ser necessário; escolher (b) se digest ou central de preferências pronta forem requisitos do PRD.
- **Dentro do app + e-mail + Web Push:** **sem provedor** (SQLite + Resend + `web-push`) continua o caminho mais leve; nenhum orquestrador trata Web Push VAPID como cidadão de primeira classe, exceto o **MagicBell**, cujo plano grátis (1.000 entregas por canal) é o mais apertado. Knock, Novu e Courier mandam Web Push via FCM/OneSignal, o que soma uma segunda conta de terceiro e um service worker do Firebase.

## Perguntas em aberto para o mapa

- O PRD exige **digest** (ex.: agrupar Comments para o Instructor)? Se sim, pesa a favor do Knock; se não, a linha de base basta.
- A entrega será síncrona na action ou via job? A linha de base com digest ou reenvio exige um job; orquestradores absorvem isso.
- Itens [não verificado] acima (digest no Free do Novu e do MagicBell, descadastro de e-mail no Novu/MagicBell, teste de Web Push em `localhost`) precisam de checagem se esses provedores forem finalistas.
