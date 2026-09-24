# Arquitetura

```text
Browser
  │
  ├─ UI / tabs / filtros
  │
  └─ GET /api/analyze?repo=owner/repository
         │
         ├─ GitHub Repository API
         ├─ GitHub Languages API
         ├─ Git Tree API
         └─ package.json discovery
                 │
                 └─ Analyzer Engine
                      ├─ stack detection
                      ├─ architecture layers
                      ├─ quality signals
                      └─ dependency inventory
```

## Decisões

- **Next.js Route Handler** mantém a chamada ao GitHub no servidor e permite usar `GITHUB_TOKEN` sem expô-lo.
- **Sem banco**: o projeto é stateless e pode funcionar gratuitamente na Vercel.
- **Sem biblioteca de gráficos**: as visualizações usam CSS e componentes nativos.
- **Cache HTTP de 10 minutos** reduz chamadas à API do GitHub.
- **Análise heurística**: o produto mostra evidências detectadas; não tenta afirmar arquitetura com certeza absoluta.

## Limites intencionais

- Apenas repositórios públicos.
- Até seis `package.json` com profundidade moderada são analisados.
- A árvore visual é resumida em repositórios muito grandes.
- A detecção privilegia stacks web modernas e sinais comuns de engenharia.
