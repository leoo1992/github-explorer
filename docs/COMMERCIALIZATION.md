# RepoScope — Estratégia de comercialização

## Posicionamento

RepoScope é um SaaS de **engineering intelligence** que transforma evidências públicas do GitHub em uma leitura técnica rápida, consistente e compartilhável.

O produto apresenta sinais observáveis de engenharia — arquitetura, stack, CI/CD, testes, lint, Docker, documentação e outros artefatos — sem afirmar que o score representa competência profissional.

## Modelo comercial atual

### RepoScope Pro

O MVP comercial opera com **acesso somente pago**. Não existe análise gratuita após o lançamento comercial.

Fluxo:

1. visitante acessa a landing pública e vê exemplos fictícios do resultado;
2. cria conta por e-mail/senha, Google ou Microsoft;
3. autentica-se no Supabase Auth;
4. segue para o checkout recorrente do Stripe;
5. o backend libera o produto somente após confirmação da assinatura;
6. o usuário autenticado com assinatura ativa acessa análises de repositório, owner e nome de projeto;
7. alterações de assinatura são sincronizadas por webhooks do Stripe.

A landing pode demonstrar o produto, mas os endpoints de análise devem permanecer protegidos por autenticação e assinatura ativa.

## Público-alvo

- recrutadores técnicos, como ferramenta auxiliar de leitura de evidências;
- Tech Leads e Engineering Managers;
- empresas de tecnologia em revisão inicial e due diligence técnica;
- consultorias e equipes que precisam entender projetos públicos rapidamente.

## Princípios de confiança

Para contextos de recrutamento, o RepoScope é uma ferramenta de apoio à revisão humana e não um mecanismo de decisão automática.

- sempre mostrar evidências por trás do score;
- não recomendar contratação ou rejeição;
- não inferir atributos pessoais ou sensíveis;
- não ranquear pessoas para contratação;
- explicar limitações de amostragem, projetos antigos e código não público;
- permitir que a decisão final permaneça com uma pessoa responsável.

## Billing

A cobrança usa Stripe Billing + Checkout Sessions em modo `subscription`.

- preço recorrente configurado por `STRIPE_PRICE_ID`;
- assinatura ativa/trialing libera acesso;
- webhook assinado sincroniza o estado da assinatura com Supabase;
- cancelamentos e alterações posteriores devem refletir no banco antes de autorizar novas análises;
- produção e teste usam credenciais separadas.

O valor exibido na aplicação deve corresponder ao Price efetivamente configurado no Stripe. O preço de R$ 79/mês existente durante a integração é apenas um valor de teste até definição comercial explícita.

## Autenticação

Supabase Auth é a camada de identidade.

Métodos previstos:

- e-mail e senha;
- Google OAuth;
- Microsoft/Azure OAuth.

As URLs de callback devem ser limitadas às URLs oficiais do produto e aos ambientes de preview/desenvolvimento necessários.

## Próximas evoluções comerciais

- Customer Portal do Stripe para autoatendimento da assinatura;
- histórico de análises;
- relatórios exportáveis;
- limites de uso por plano;
- workspaces e RBAC para equipes;
- GitHub App para repositórios privados;
- SSO empresarial e integrações comerciais.

## Métricas

Acompanhar conversão landing → cadastro → checkout → assinatura ativa, taxa de cancelamento, falhas de pagamento, análises por usuário, retenção e custo médio por análise.
