# Ícones 1More

32 ícones de traço de caneta: grade de 24 px, linha de 2 px, pontas retas (`square`), cantos vivos (`miter`), sem preenchimento.

## Pastas

| Pasta | O que é | Quando usar |
| --- | --- | --- |
| `Icon.tsx` | Componente React Native (`react-native-svg`) com todos os paths embutidos | **Recomendado.** `<Icon name="check" color={colors[theme].ink} />` |
| `svg/` | SVG com `stroke="currentColor"` | Web, ou RN com `react-native-svg-transformer` (a cor vem da prop `color`) |
| `svg-claro/` | SVG com a tinta do tema Papel (`#1a1917`) | Design, documentação, ferramentas que não entendem `currentColor` |
| `svg-escuro/` | SVG com a tinta do tema Noite (`#f1e8d6`) | Idem, fundo escuro |
| `png-claro/@1x @2x @3x` | PNG transparente 24/48/72 px, tinta clara | Onde SVG não serve (notificação, widget, splash) |
| `png-escuro/@1x @2x @3x` | PNG transparente, tinta do tema escuro | Idem, fundo escuro |
| `icons.json` | `{ nome: path }` | Gerar ícones em outra plataforma |

## Regras

- Cor sempre do tema: `ink` em ações, `ink-muted` em metadados. Nunca colorir ícone por categoria.
- Tamanho 24 (`size-icon`); 18 (`size-icon-sm`) dentro de botões compactos e status. Área de toque mínima 48 dp mesmo com ícone menor.
- Ícone sozinho num botão precisa de `accessibilityLabel`.
- A sequência semanal usa `tally` (risquinhos), não chama nem troféu. Nada de emoji.
- Ícone novo: mesmo grid, só retas e arcos, traço 2 px.

## Lista

alert · arrow-up · calendar · chart · check · chevron-down · chevron-left · chevron-right · close · download · drag · dumbbell · filter · flag · minus · more · note · notebook · offline · pause · plate · play · plus · search · skip · sliders · swap · sync · tally · timer · trash · user

Onde cada um aparece: `notebook` aba Treinar · `calendar` aba Histórico · `chart` aba Progresso · `user` aba Perfil · `check` série concluída/sincronizado · `play` começar/retomar · `plus` adicionar · `more` opções do exercício · `swap` trocar exercício · `timer` descanso · `skip` pular descanso · `flag` finalizar · `sync` sync pendente · `offline` sem rede · `alert` erro de sync · `note` notas · `tally` sequência semanal · `plate` calculadora de anilhas · `dumbbell` exercício/equipamento · `drag` reordenar · `download` exportar · `sliders` ajustes · `search`/`filter` catálogo · `trash` excluir · `chevron-*` navegação · `close`/`minus`/`pause`/`arrow-up` utilitários.
