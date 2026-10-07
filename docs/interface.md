# Interface e temas

A interface usa daisyUI 5 com Tailwind CSS 4. Os temas `light` e `dark` estão definidos em `src/app/globals.css`, com cores semânticas de superfície, conteúdo, ação e status. `src/app/theme.css` concentra os aliases usados nos layouts de análise e os ajustes compartilhados de contraste e responsividade.

- Use `btn`, `input`, `select`, `checkbox`, `tabs`, `badge`, `card`, `table` e `progress` do daisyUI nos novos controles. Reserve CSS Modules para layout e detalhes próprios de cada tela.
- Use `--color-base-content` / `--text` para textos e a cor `*-content` correspondente nos botões preenchidos. Não fixe cores de texto claras ou fundos escuros em componentes.
- `--app-border` é a cor das bordas do aplicativo. `--border` pertence ao daisyUI e representa a espessura da borda.
- Não use seletores baseados no nome compilado de CSS Modules. Cada módulo deve consumir os mesmos tokens dos dois temas.
- O seletor global usa `theme-controller`, `swap`, `swap-rotate`, `swap-on` e `swap-off`, com ícones Lucide. A preferência existente `reposcope.theme` é preservada, sincronizada entre abas e carregada antes da hidratação. Se o armazenamento estiver bloqueado, a troca de tema continua disponível na sessão atual.
- Mantenha contraste mínimo de 4,5:1 para textos pequenos, foco visível por teclado e suporte a `prefers-reduced-motion`. Verifique também abas inativas, placeholders, status e tabelas.
- Teste a largura de 320 px. Rolagem horizontal, quando necessária, deve ficar dentro da tabela, sem alargar a página.

A revisão desta migração incluiu os temas claro/escuro, persistência após recarregar, busca e paginação do histórico, painéis de resultado, presets e formulários. As telas protegidas foram inspecionadas com dados demonstrativos locais, sem alterar autenticação, cobrança ou dados reais.
