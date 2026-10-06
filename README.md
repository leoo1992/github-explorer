# RepoScope — GitHub Engineering Intelligence

RepoScope transforma repositórios públicos do GitHub em sinais observáveis de arquitetura, stack, qualidade e maturidade de engenharia. O produto foi estruturado como SaaS pago para recrutadores técnicos, Tech Leads, empresas de recrutamento e times de tecnologia.

## Fluxo comercial

1. visitante acessa a landing pública e vê uma demonstração fictícia da avaliação;
2. cria uma conta com e-mail/senha, Google ou Microsoft;
3. é direcionado para a página do plano;
4. realiza a assinatura mensal de **R$ 9,90** pelo Stripe;
5. somente após a confirmação do pagamento o dashboard e as APIs de análise são liberados.

Não existe análise gratuita no fluxo atual.

## Formas de análise

- **Repositório** — `owner/repository` ou URL completa do GitHub;
- **Owner / organização** — owner ou URL de perfil para análise em lote dos repositórios públicos;
- **Nome do projeto** — busca a correspondência pública mais relevante antes de analisar.

Os exemplos exibidos na aplicação usam projetos públicos genéricos, como `vercel/next.js`, `facebook/react` e `django`.

## O que entrega

- análise heurística de arquitetura;
- descoberta de tecnologias por dependências e estrutura;
- composição de linguagens;
- mapa de camadas arquiteturais;
- sinais de qualidade como CI, testes, lint, type checking, Docker, lockfile e licença;
- estrutura de arquivos com busca;
- inventário de dependências;
- score agregado dos sinais de qualidade encontrados nos repositórios públicos de um owner;
- análise concorrente em lotes;
- tratamento de rate limit e erros da API do GitHub.

O score representa somente sinais técnicos observáveis no repositório. Ele não representa competência profissional, não substitui entrevista técnica e não deve ser usado como decisão automática de contratação.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth + Postgres
- Stripe Billing
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

O projeto de produção é o `RepoScope` em `sa-east-1`. A tabela `subscriptions` possui RLS e usuários autenticados podem ler apenas a própria assinatura. Escritas são realizadas somente pelo backend usando a chave secreta.

Em Authentication configure:

- Email/Password;
- Google OAuth;
- Microsoft/Azure OAuth;
- URL de produção como Site URL;
- `/auth/callback` entre as Redirect URLs permitidas.

Callback dos provedores sociais no Supabase:

```text
https://boamqtcyvflgpewomfhj.supabase.co/auth/v1/callback
```

## Stripe

O plano comercial é **RepoScope Pro — R$ 9,90/mês**.

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

A rota de retorno do checkout confirma a sessão no servidor antes de encaminhar o usuário ao dashboard. O estado da assinatura também é atualizado por webhook para refletir renovações, cancelamentos e falhas de pagamento.

## Endpoints protegidos

```text
GET /api/analyze?repo=vercel/next.js&mode=repository
GET /api/analyze?repo=django&mode=project
GET /api/owner-quality?owner=vercel&offset=0&limit=6
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
- nenhuma chave secreta é enviada ao navegador.
