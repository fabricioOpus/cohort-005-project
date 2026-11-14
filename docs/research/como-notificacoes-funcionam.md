# Como notificações funcionam num app web

> Pesquisa para a issue [#12](https://github.com/fabricioOpus/cohort-005-project/issues/12) (mapa [#11](https://github.com/fabricioOpus/cohort-005-project/issues/11)).
> Pergunta: como uma notificação nasce e chega à pessoa num app web como o Cadence, quais canais existem e o que cada um exige do app.
> Fontes: specs (W3C/WHATWG/IETF), MDN, web.dev, blog do WebKit e as regras publicadas do Gmail e do Yahoo. Consultadas em 2026-11-14.

## 1. A ideia central: evento ≠ notificação ≠ entrega

Em qualquer app, uma notificação passa por quatro etapas:

1. **Evento de domínio**: algo aconteceu (um Comment foi criado, uma Lesson ficou disponível, alguém respondeu a um Comment).
2. **Decisão de destinatários**: quem deve saber disso (por exemplo, o Instructor dono do Course, ou os Students com Enrollment ativo), já descontando o autor e as duplicatas.
3. **Registro da notificação**: uma linha por destinatário numa tabela, com estado de lida ou não lida. Essa linha é a "verdade" do canal dentro do app.
4. **Entrega em canais**: mostrar dentro do app, mandar um e-mail ou disparar um Web Push. Cada canal pode falhar ou atrasar de forma independente.

Separar essas etapas permite que um provedor de e-mail fora do ar não impeça a criação do Comment, e que a lista dentro do app continue correta mesmo se o push não chegar.

## 2. Peças da arquitetura

| Peça | O que é | No Cadence |
| --- | --- | --- |
| **Evento** | Chamada disparada no ponto do código onde a ação acontece, logo depois de gravar no banco. | A action que cria o Comment ou a Lesson. |
| **Fila / job** | Trabalho assíncrono: a action enfileira e um worker processa depois, com novas tentativas (*retry*). Evita que um e-mail lento atrase a resposta HTTP. | Hoje não existe. Opções: tabela de jobs no próprio SQLite, um serviço de fila/workflow, ou envio síncrono "best effort" no início. |
| **Provedor** | Serviço externo que efetivamente entrega: SMTP/API de e-mail ou o *push service* do navegador. | O Web Push dispensa provedor pago, porque cada navegador opera o seu *push service*. O e-mail precisa de um. |
| **Entrega** | Tentativa de envio por canal, que pode falhar. Uma assinatura de push pode expirar, e um e-mail pode voltar (*bounce*). | Registrar falhas e limpar assinaturas mortas. |
| **Lida / não lida** | Estado guardado no servidor (`readAt`) para o sino e o contador. | Tabela de notificações com `userId`, tipo, referência ao Comment ou à Lesson e `readAt`. |
| **Preferências** | Opção de desativar por tipo e por canal. | Pendente no mapa (#11). |

### Tempo real: polling, SSE ou WebSocket

Para o sino dentro do app atualizar sem recarregar a página, há três opções:

- **Polling**: o cliente consulta o servidor a cada N segundos. É o mais simples e funciona com qualquer servidor, mas o atraso chega a N segundos e gera requisições à toa. Num app React Router, até a revalidação dos loaders ao navegar já produz um "quase tempo real" sem código extra.
- **Server-Sent Events (SSE)**: conexão HTTP de mão única, do servidor para o cliente, aberta com `EventSource` e servida com `text/event-stream`. O navegador reconecta sozinho ([MDN — Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)). Limitação: sem HTTP/2, o navegador aceita só **6 conexões por domínio** somando todas as abas ([mesma página](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)). Para notificações, mão única basta.
- **WebSocket**: canal bidirecional ([MDN — WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)). Faz sentido para chat ou colaboração. Para um sino de notificações, costuma ser mais do que o necessário.

Conexões longas (SSE ou WebSocket) exigem um servidor que mantenha processos vivos. Isso pesa em hospedagens *serverless*. O polling não tem esse problema.

## 3. Canais

### 3.1 Dentro do app (in-app)

Sino com contador e lista de notificações, lidas da tabela própria do app. Não depende de permissão do navegador, de provedor nem de DNS: é só banco e UI. A limitação é que **só alcança quem está com o app aberto**. Costuma ser a base sobre a qual os outros canais se apoiam.

### 3.2 E-mail

Alcança a pessoa fora do app e em qualquer dispositivo, sem pedir permissão. O que o app precisa:

- **Um provedor de envio** (API ou SMTP). Para desenvolvimento local, um servidor SMTP falso ou o modo de teste do provedor.
- **Domínio verificado** com registros DNS:
  - **SPF** ([RFC 7208](https://www.rfc-editor.org/rfc/rfc7208)): lista quais servidores podem enviar e-mail pelo domínio.
  - **DKIM** ([RFC 6376](https://www.rfc-editor.org/rfc/rfc6376)): assinatura criptográfica do e-mail.
  - **DMARC** ([RFC 7489](https://www.rfc-editor.org/rfc/rfc7489)): política que exige alinhamento entre o domínio do `From:` e o SPF/DKIM.
- **Regras do Gmail.** Desde fevereiro de 2024, *todo* remetente precisa de SPF **ou** DKIM, DNS reverso válido e TLS, e deve manter a taxa de spam abaixo de 0,3%. Remetentes em massa (mais de 5.000 mensagens por dia para o Gmail) precisam de SPF **e** DKIM **e** DMARC (pode ser `p=none`), além de **descadastro com um clique** ([Google — Email sender guidelines](https://support.google.com/a/answer/81126)).
- **Regras do Yahoo**, equivalentes: SPF e DKIM, DMARC no mínimo `p=none`, cabeçalho `List-Unsubscribe` com um clique e descadastro atendido em até 2 dias ([Yahoo Sender Hub — Best practices](https://senders.yahooinc.com/best-practices/)).
- **Descadastro com um clique** ([RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html)): cabeçalhos `List-Unsubscribe` (URI HTTPS com um identificador difícil de forjar) e `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. O provedor de e-mail do destinatário faz um POST nessa URL, sem cookies, então o app precisa de um endpoint que descadastre **sem login**. A assinatura DKIM tem de cobrir os dois cabeçalhos.

O Cadence fica muito abaixo de 5.000 mensagens por dia, mas cumprir SPF, DKIM e DMARC e o descadastro desde o início evita a caixa de spam. Além disso, os provedores de envio normalmente cuidam de quase tudo isso quando o domínio é verificado.

### 3.3 Web Push

Notificação do sistema operacional disparada pelo servidor, **mesmo com o site fechado**. Ela combina três padrões:

- **Service Worker** ([W3C](https://www.w3.org/TR/service-workers/)): script que roda em segundo plano. Sem um service worker ativo, não há push ([MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
- **Push API** ([W3C](https://www.w3.org/TR/push-api/)): cria a assinatura e recebe a mensagem. O protocolo de rede é o Web Push ([RFC 8030](https://www.rfc-editor.org/rfc/rfc8030)), com identificação do servidor por **VAPID** ([RFC 8292](https://www.rfc-editor.org/rfc/rfc8292)).
- **Notifications API** ([WHATWG](https://notifications.spec.whatwg.org/)): exibe o aviso na tela.

"Push" é o transporte e "notification" é a exibição. Os navegadores não permitem push silencioso, por isso os dois andam juntos ([web.dev — Push notifications overview](https://web.dev/articles/push-notifications-overview)).

**Fluxo** ([web.dev — overview](https://web.dev/articles/push-notifications-overview)):

1. Num clique, o usuário aceita a permissão e o JavaScript chama `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <chave pública VAPID> })`.
2. O navegador devolve um `PushSubscription` com um `endpoint` (URL do *push service* do navegador) e chaves de criptografia. O app salva isso no banco, por usuário e por dispositivo. O endpoint funciona como um segredo, e a rota de inscrição precisa de proteção contra CSRF ([MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
3. Para notificar, o servidor criptografa o payload, assina um JWT com a **chave privada VAPID** e faz um POST no `endpoint`, com `TTL` obrigatório e `Urgency` opcional. A biblioteca Node `web-push` cuida disso ([web.dev — Web Push protocol](https://web.dev/articles/push-notifications-web-push-protocol)).
4. O *push service* guarda a mensagem até o dispositivo ficar online e a entrega. O service worker acorda no evento `push` e chama `showNotification()`.
5. Respostas **404 ou 410** significam assinatura expirada, que deve ser apagada ([web.dev — Web Push protocol](https://web.dev/articles/push-notifications-web-push-protocol)).

**Não há provedor pago:** os *push services* (Google, Mozilla, Apple) são gratuitos e escolhidos pelo navegador. O app só gera um par de chaves VAPID uma vez.

**Requisitos gerais:** HTTPS (contexto seguro; `localhost` vale em desenvolvimento) e permissão em três estados (`granted`, `denied`, `default`), pedida em resposta a uma interação do usuário ([MDN — Notification.requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)).

**Android:** no Chrome, no Firefox e no Edge para Android, o Web Push funciona direto do navegador, sem instalar o site. O blog do WebKit descreve a exigência de instalação como específica do iOS e do iPadOS ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

**iOS e iPadOS 16.4 ou mais recente** ([WebKit — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)):

- Só um web app **adicionado à Tela de Início** pode pedir permissão. No Safari comum, não há push no iPhone.
- O site precisa de um **Web App Manifest** com `display` igual a `standalone` ou `fullscreen`, o que na prática faz dele uma PWA instalável.
- A permissão precisa vir de uma interação direta (por exemplo, tocar em "Ativar notificações").
- Usa os mesmos padrões (Push API, Notifications API e Service Workers), passando pelo APNs da Apple. **Não exige conta de desenvolvedor Apple**. Se o servidor restringe destinos, é preciso liberar `*.push.apple.com`.
- Consequência: no iPhone, o Student precisa instalar o Cadence na Tela de Início antes de receber push. Muitos não vão fazer isso, e o e-mail cobre esse buraco.

**UX de permissão** ([web.dev — Permission UX](https://web.dev/articles/push-notifications-permissions-ux)):

- Nunca pedir permissão ao carregar a página.
- Pedir no contexto em que o valor é óbvio, de preferência com um "pré-pedido" na própria UI ("Quer ser avisado quando o Instructor responder?") antes do prompt do navegador.
- Oferecer um interruptor nas configurações e explicar como desativar.
- O bloqueio (`denied`) é quase irreversível: o app não pode perguntar de novo, e o usuário teria de mexer nas configurações do navegador.

## 4. Comparação dos canais

| | Dentro do app | E-mail | Web Push |
| --- | --- | --- | --- |
| **Alcança quem está fora do app?** | Não | Sim, em qualquer dispositivo | Sim, mesmo com o site fechado |
| **Precisa de permissão?** | Não | Não, mas exige descadastro | Sim, prompt do navegador, e o bloqueio é quase definitivo |
| **Infra exigida** | Tabela + UI (+ polling/SSE) | Provedor, domínio com SPF/DKIM/DMARC, endpoint de descadastro com um clique | Service worker, chaves VAPID, tabela de assinaturas, HTTPS; manifest para iOS |
| **Custo de provedor** | Nenhum | Plano gratuito do provedor, normalmente suficiente para estudo | Nenhum (*push services* gratuitos) |
| **Rodar localmente** | Trivial | Fácil com SMTP falso ou modo de teste; envio real exige domínio | Funciona em `localhost` no desktop; no celular exige HTTPS público, e no iOS, instalação |
| **Cobertura no celular** | Só com o app aberto | Total | Android: bom. iOS: só PWA instalada (16.4+) |
| **Riscos** | Nenhum relevante | Spam, entregabilidade, DNS | Assinaturas expiram (404/410), permissão negada, suporte desigual |
| **Complexidade** | **Baixa** | **Média** (a maior parte fica no provedor e no DNS) | **Média-alta** (service worker, criptografia via biblioteca, UX de permissão, iOS) |

## 5. O que isso significa para o Cadence

- **O canal dentro do app é a base obrigatória.** A tabela de notificações com `readAt` atende ao sino, ao contador e ao "lida/não lida", e serve de registro para os outros canais. Para tempo real, polling ou a revalidação do React Router bastam no início; SSE é um passo seguinte barato, se fizer falta.
- **O e-mail é o canal externo de maior cobertura e menor atrito.** Funciona no iPhone sem instalação e não pede permissão. Ele cria duas obrigações que conversam com o item "desativar por tipo" do mapa: um link de descadastro com um clique, sem login (RFC 8058), e um domínio verificado. A escolha do provedor (plano gratuito, SDK TypeScript, modo local) é o próximo passo natural.
- **O Web Push é opcional e incremental.** Ele não exige provedor, mas exige service worker, chaves VAPID, uma tabela de assinaturas e UX de permissão cuidadosa. No iOS, só funciona se o Cadence virar uma PWA instalável. Vale como fase posterior, depois que o canal dentro do app e o e-mail estiverem prontos.
- **A arquitetura deve separar evento, notificação e entrega desde já.** A action grava a notificação (síncrono e barato) e a entrega externa vai para um job com retry, para que falha de e-mail ou push nunca quebre a criação de um Comment. Isso também resolve parte do caso "Comment apagado antes da entrega": o job pode verificar se o Comment ainda existe antes de enviar.
