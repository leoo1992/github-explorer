# RepoScope — Estratégia de comercialização

## Posicionamento

O RepoScope é um produto de **engineering intelligence** que transforma evidências públicas do GitHub em uma leitura técnica rápida, consistente e compartilhável.

O produto não toma decisões de contratação. Ele organiza sinais técnicos observáveis para apoiar revisão humana por recrutadores técnicos, Tech Leads e equipes de engenharia.

## Modelo comercial atual

### RepoScope Pro

Preço: **R$ 9,90 por mês**.

O fluxo atual é paid-only:

1. visitante acessa a landing pública e vê uma demonstração com dados fictícios;
2. cria conta por e-mail/senha, Google ou Microsoft;
3. segue para o checkout Stripe;
4. a assinatura é confirmada no servidor e sincronizada por webhook;
5. somente usuários com assinatura `active` ou `trialing` acessam o dashboard e os endpoints de análise.

Não existe análise gratuita no fluxo atual.

## Entregas do plano

- análise de repositório público;
- análise agregada de owner/organização;
- busca por nome de projeto;
- stack, linguagens, arquitetura e dependências;
- sinais de qualidade de engenharia;
- evidências explicáveis para cada score;
- acesso ao Customer Portal do Stripe para gerenciar assinatura, pagamento e cancelamento.

## Público prioritário

- recrutadores técnicos;
- empresas de recrutamento e seleção;
- Tech Leads e Engineering Managers;
- times de tecnologia fazendo revisão inicial de software público.

## Princípios de confiança

O score mede sinais observáveis presentes nos repositórios públicos analisados. Ele não representa competência profissional e não deve ser usado como decisão automática de contratação.

Para uso em recrutamento:

- sempre exibir evidências por trás do score;
- manter revisão humana;
- não inferir atributos pessoais;
- não classificar automaticamente candidatos para contratação;
- explicar limitações de amostragem, projetos antigos e código não público.

## Arquitetura comercial

- **Supabase Auth** — cadastro, login, sessão e OAuth;
- **Supabase Postgres** — estado de assinatura com RLS;
- **Stripe Billing + Checkout** — cobrança recorrente;
- **Stripe Customer Portal** — autosserviço pós-venda;
- **GitHub REST API** — dados públicos analisados;
- **Vercel** — aplicação Next.js e endpoints server-side.

## Estado de provisionamento

- projeto Supabase `RepoScope` criado em `sa-east-1`;
- tabela `public.subscriptions` aplicada com RLS;
- produto Stripe de teste `RepoScope Pro` criado;
- preço de teste ativo de R$ 9,90/mês;
- preço antigo de R$ 79/mês desativado;
- Customer Portal de teste configurado;
- fluxo de checkout, confirmação, webhooks e portal implementado no código;
- CI exige typecheck, lint, testes, cobertura mínima de 80% e build.

## Dependências externas para produção

- credenciais Google OAuth;
- credenciais Microsoft Entra ID OAuth;
- habilitação dos provedores sociais no Supabase Auth;
- secret key do Supabase configurada no ambiente server-side;
- Stripe em live mode com produto/preço live de R$ 9,90/mês;
- restricted/secret Stripe key e webhook signing secret no ambiente server-side;
- configuração das variáveis no projeto Vercel com acesso ao scope correto;
- Site URL e Redirect URLs de produção no Supabase Auth.

## Próximas evoluções de produto

Depois do MVP pago estabilizado, os incrementos de maior valor são:

- histórico de análises;
- exportação PDF/CSV;
- workspaces de equipe;
- GitHub App para repositórios privados;
- limites de uso por plano;
- relatórios compartilháveis;
- auditoria e retenção configurável para clientes empresariais.
