# RepoScope — GitHub Engineering Intelligence

RepoScope transforma repositórios públicos do GitHub em sinais observáveis de arquitetura, stack, qualidade e maturidade de engenharia. O produto foi estruturado como SaaS pago para recrutadores técnicos, Tech Leads, empresas de recrutamento e times de tecnologia.

## Fluxo comercial

1. visitante acessa a landing pública e vê uma demonstração fictícia da avaliação;
2. cria uma conta com e-mail e senha; Google e Microsoft aparecem somente quando o respectivo OAuth está disponível;
3. é direcionado para a página do plano;
4. realiza a assinatura mensal de **R$ 9,90** pelo Stripe;
5. somente após a confirmação do pagamento o dashboard e as APIs de análise são liberados.

Não existe análise gratuita no fluxo atual.

## Forma de análise

- **Repositório** — informe `owner/repository` ou a URL completa de um repositório público do GitHub.

Os exemplos exibidos na aplicação usam repositórios públicos genéricos, como `vercel/next.js` e `facebook/react`.

## O que entrega

- análise heurística de arquitetura;
- descoberta de tecnologias por dependências e estrutura;
- composição de linguagens;
- mapa de camadas arquiteturais;
- **45 critérios de qualidade**, combinando sinais globais e regras específicas por linguagem;
- suporte de critérios para JavaScript, TypeScript, Python, Java, Kotlin, C#, Go, Rust, PHP, Ruby, Swift, Dart, C e C++;
- **modo Automático por stack**, que detecta tecnologias como Next.js, React, Angular, Vue, Svelte, NestJS, Django, FastAPI, Spring Boot, Laravel, Rails, .NET, Flutter, Go e Rust e aplica somente critérios compatíveis;
- catálogo de presets padrão não excluíveis (JavaScript, TypeScript, Next.js, Spring Boot, Laravel e outros);
- tela exclusiva `/presets` para assinantes criarem, editarem e excluírem presets próprios;
- presets personalizados persistidos por usuário e reutilizáveis em novas análises;
- sinais de qualidade como CI, testes, lint, type checking, Docker, lockfile, segurança, governança e licença;
- estrutura de arquivos com busca;
- inventário de dependências;
- tratamento de rate limit e erros da API do GitHub.

O score representa somente sinais técnicos observáveis no repositório. Ele não representa competência profissional, não substitui entrevista técnica e não deve ser usado como decisão automática de contratação.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth + Postgres
- Stripe Billing + Checkout + Customer Portal
- GitHub REST API
- Vercel

## Executar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## Variáveis de ambiente

```env
GITHUB_TOKEN=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
NEXT_PUBLIC_PLAN_PRICE_LABEL=R$ 9,90/mês
```

Nunca exponha `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` no cliente.

## Supabase

O projeto de produção é o `RepoScope` em `sa-east-1`, ref `boamqtcyvflgpewomfhj`. As tabelas de billing permanecem protegidas por RLS. A tabela `quality_presets` armazena os presets personalizados do usuário; o cliente não possui grants diretos nela e as operações passam pela API autenticada do RepoScope usando o backend.

Em Authentication configure:

- Email/Password como método base;
- Google OAuth opcional;
- Microsoft/Azure OAuth opcional;
- URL de produção como Site URL;
- `/auth/callback` entre as Redirect URLs permitidas.

A UI consulta `/auth/v1/settings` e usa fallback fail-closed: Google e Microsoft só são anunciados e exibidos quando o Supabase informa o provedor como habilitado. Se a consulta falhar ou uma tentativa OAuth falhar, o método é ocultado e o sistema mantém e-mail/senha como fallback.

Callback dos provedores sociais no Supabase:

```text
https://boamqtcyvflgpewomfhj.supabase.co/auth/v1/callback
```

## Stripe

O plano comercial é **RepoScope Pro — R$ 9,90/mês**.

No ambiente de teste atual:

- produto: `prod_VOKs3oCOq3dpUM`;
- preço ativo: `price_1UNYQUIRhSzSv4bjYFj2fz0O`;
- Customer Portal: `bpc_1UNYXHIRhSzSv4bjX2QzynPr`.

Configure o webhook de produção para:

```text
POST /api/billing/webhook
```

Eventos utilizados:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `customer.subscription.created`;
- `customer.subscription.updated`;
- `customer.subscription.deleted`;
- `invoice.paid`;
- `invoice.payment_failed`.

A rota de retorno do checkout confirma a sessão no servidor antes de encaminhar o usuário ao dashboard. O estado da assinatura também é atualizado por webhook para refletir renovações, cancelamentos e falhas de pagamento. Usuários pagos podem acessar `/account` e abrir o Customer Portal do Stripe.

## Endpoints protegidos

```text
GET /api/analyze?repo=vercel/next.js&mode=auto
GET /api/quality-presets
POST /api/quality-presets
DELETE /api/quality-presets?id=<preset-id>
```

Sem sessão autenticada retornam `401`. Sem assinatura ativa retornam `402`.

## Documentação

- [Estratégia comercial](docs/COMMERCIALIZATION.md)
- [Arquitetura](docs/ARCHITECTURE.md)

## Segurança

- análise restrita a repositórios públicos;
- APIs de análise protegidas no servidor por autenticação e assinatura ativa;
- assinatura sincronizada pelo webhook Stripe com validação de assinatura criptográfica;
- tabela de assinatura protegida por RLS;
- métodos OAuth seguem fallback fail-closed e nunca são anunciados quando indisponíveis;
- nenhuma chave secreta é enviada ao navegador.
