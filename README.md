# RepoScope — GitHub Engineering Intelligence

RepoScope transforma repositórios públicos do GitHub em sinais objetivos de arquitetura, stack, qualidade e maturidade de engenharia. O produto foi desenhado para recrutadores técnicos, Tech Leads, empresas de recrutamento e times de tecnologia.

## Casos de uso

- **Repositório** — informe `owner/repository` ou uma URL completa do GitHub;
- **Owner / profissional** — informe apenas o owner ou a URL do perfil para analisar o portfólio público em lote;
- **Só o projeto** — informe apenas o nome de um projeto e o RepoScope busca a melhor correspondência pública antes de analisar.

## O que entrega

- análise heurística de arquitetura;
- descoberta de tecnologias por dependências e estrutura;
- composição de linguagens;
- mapa de camadas arquiteturais;
- sinais de qualidade como CI, testes, lint, type checking, Docker, lockfile e licença;
- estrutura de arquivos com busca;
- inventário de dependências;
- score agregado de qualidade dos repositórios públicos de um owner;
- links compartilháveis por repositório ou owner;
- cache server-side e análise concorrente em lotes;
- tratamento de rate limit e erros da API do GitHub.

## Público-alvo

- recrutadores e empresas de recrutamento que precisam fazer triagem técnica com mais evidências;
- Tech Leads e Engineering Managers que precisam compreender rapidamente um projeto;
- empresas de tecnologia que desejam padronizar critérios de avaliação de repositórios e portfólios.

O score representa sinais observáveis do repositório. Ele não substitui entrevista técnica, contexto de projeto ou avaliação humana.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- GitHub REST API
- Vercel

## Executar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

O token é opcional, mas recomendado em produção para análises de owner:

```env
GITHUB_TOKEN=
```

O token é utilizado somente no servidor e nunca é enviado ao browser.

## Endpoints

```text
GET /api/health
GET /api/analyze?repo=leoo1992/pulsebi&mode=repository
GET /api/analyze?repo=next.js&mode=project
GET /api/owner-quality?owner=leoo1992&offset=0&limit=6
```

## Estratégia comercial

Veja [docs/COMMERCIALIZATION.md](docs/COMMERCIALIZATION.md).

## Arquitetura

Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Segurança

O projeto analisa somente repositórios públicos. Nenhum segredo ou token é retornado ao cliente.
