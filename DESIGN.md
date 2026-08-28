# Identidade visual — GrADyS Ground Station

Criada em 2026-08-16 · Projeto: `gradys-gs-ng` (LAC) · Público: operador de drone em campo e pesquisador em bancada, em sessão longa, em notebook (campo) e monitor grande (lab)

> A verdade **executável** são os tokens em [`static/connections/css/connection.css`](static/connections/css/connection.css).
> Este arquivo é a verdade **editorial**: o porquê, e quais valores são intocáveis.
> Ao mudar a identidade, atualize os dois. Identidade registrada e desatualizada mente com autoridade.

## Personalidade

Preciso, sóbrio, inequívoco. **Não é** empolgado.

A negação corta o que existia antes: a paleta anterior (`#ff4655` sobre `#0f1923`) é o registro de jogo competitivo. Esta estação arma e faz decolar aeronave real — o vocabulário é o de instrumento de cabine, não o de HUD de jogo.

## Densidade

**Densa.** Ferramenta de trabalho: muitos números atualizando ao mesmo tempo, sessão de horas, a frota inteira visível sem rolar.

## A regra central — cor é informação

Nenhum elemento decorativo tem cor. Todo o chrome é acromático: grafite e tinta. As únicas cores saturadas são os três estados de voo, o realce de sintaxe do log (exceção registrada abaixo) e os marcadores no mapa.

Seleção, hover e foco são feitos com **superfície, peso e filete lateral** — nunca com cor de marca.

Isso corrige o defeito estrutural da versão anterior, onde `#ff4655` era ao mesmo tempo cor de marca, cor de log enviado, cor de foco e cor de status "inativo". Um vermelho que significa quatro coisas não significa nenhuma.

**Consequência aceita:** a interface não tem "a cor do GrADyS". Vermelho quer dizer uma coisa só — algo está errado.

**Corolário operacional:** só a condição *excepcional* ganha cor. É a lógica do anunciador de cabine — a luz acende quando algo **não** está nominal, não para dizer que está tudo bem. Por isso `not ready` é âmbar e `ready` é tinta fraca.

## Paleta

| Token | Valor | Papel | De onde veio |
|---|---|---|---|
| `--surface-0` | `#14171A` | fundo do app e do rail | Grafite **neutro** — carcaça de instrumento. Não azulado de propósito: azul-marinho + vermelho é o registro gamer do qual estamos saindo |
| `--surface-1` | `#1B1F23` | painel | Um degrau acima do fundo; separa sem precisar de borda |
| `--surface-2` | `#23282D` | hover, chips, controles | Terceiro degrau |
| `--surface-3` | `#2E353B` | linha selecionada | Quarto degrau. Existe porque a seleção decide para onde vai o `Arm` — é o estado de maior consequência da tela e precisava do passo acromático mais alto disponível |
| `--line` | `#333A40` | filete separador, 1px | Único uso de borda no sistema |
| `--ink` | `#E6E9EC` | texto principal | Off-white levemente frio |
| `--ink-dim` | `#9AA4AD` | rótulos, unidades, secundário | |
| `--nominal` | `#3FBF6F` | ok · armado · conectado | Tríade de *caution* padronizada de cockpit. Não é escolha estética: é a convenção que o operador já lê sem aprender |
| `--caution` | `#E8A317` | atenção · on hold · bateria baixa · conectando · toggle engatado | idem |
| `--critical` | `#F0554B` | falha · offline · inativo · log com erro | idem |

Tons derivados, usados só em estado de interação: `#2C3238` (hover de botão), `#454D55` (borda de hover), `#363E45` (hover na linha selecionada), `#D19314` (hover no toggle engatado).

### Onde a tríade pode aparecer

**Cor de estado em texto só sobre `--surface-1` ou mais escuro.** Em superfície elevada, a cor vive num elemento gráfico, não numa letra.

Descoberto no QA visual: `--critical` em 11px sobre a linha selecionada dava **3.62:1**. A correção não foi clarear o vermelho — foi notar que a cor estava dita duas vezes (a régua de status *e* a palavra do status). A palavra ficou acromática; a cor vive só na régua.

Consequência prática: na linha da frota, bateria e prontidão usam **âmbar**, nunca vermelho. Vermelho ali só existe na régua de 3px, que é elemento gráfico e não tem requisito de 4.5:1.

**Contraste verificado** (sobre `--surface-1` `#1B1F23`):

| Par | Razão | AA texto normal |
|---|---|---|
| `--ink` | 13.6:1 | ✅ |
| `--ink-dim` | 6.5:1 | ✅ |
| `--nominal` | 7.0:1 | ✅ |
| `--caution` | 7.6:1 | ✅ |
| `--critical` | 4.8:1 | ✅ |
| ~~`#E2453C`~~ (descartado) | 4.1:1 | ❌ reprovava |
| `#14171A` sobre `--caution` (toggle engatado) | 8.3:1 | ✅ |
| `#14171A` sobre `#D19314` (toggle engatado + hover) | 6.8:1 | ✅ |

### Exceção registrada — realce de sintaxe no log

O painel de Logs é a única superfície com matizes fora da tríade:

| Token | Valor | Papel |
|---|---|---|
| `.j-str` | `#8FBCE6` | valores string — 8.3:1 |
| `.j-num` | `#C6A0F6` | valores numéricos — 7.7:1 |
| `.j-key` | `--ink-dim` | chaves e pontuação, que recuam |
| `.j-bool` | `--ink` | `true` / `false` / `null` |

A exceção é deliberada e escopada: o log é superfície de código, e realce de sintaxe é **informação**, não enfeite — a mesma regra, aplicada. Azul e violeta foram escolhidos exatamente por **não existirem na tríade de voo**: ninguém confunde um valor de string com um estado de aeronave.

Direção (`TX`/`RX`) **não** usa matiz — é filete acromático mais texto, para sobreviver a daltonismo e a impressão em cinza. Vermelho no filete significa o de sempre: a mensagem contém erro.

Fora do painel de Logs, essas cores não existem.

## Tema

**Chrome escuro, decidido — não default.** Dark + acento é clichê de interface gerada por IA; a justificativa aqui é concreta: o mapa ocupa a maior parte da tela e é claro, então o chrome escuro cria a separação que chrome claro não criaria. O painel é o instrumento; o mapa é o mundo.

Isto vale para o **chrome**. A base do mapa é clara — ver "Base de mapa" abaixo, inclusive por que a tentativa de deixá-la escura falhou.

Não existe tema claro. Se for pedido (sol em campo), é decisão nova, não variante gratuita.

## Base de mapa

**Leaflet + OpenStreetMap, base clara dessaturada (CARTO Positron).** Sem chave, sem cartão, auto-hospedável.

A escolha é contraintuitiva e vale o registro. A primeira tentativa foi base **escura**, no raciocínio de que combinaria com o chrome grafite e faria os pinos brilharem. Deu errado por dois motivos:

1. O mapa virou uma folha preta — não dava para separar rio de terra, e ler o terreno é a função do mapa numa estação de controle.
2. Os pinos se destacavam por **brilho**, não por cor. Sobre a base clara eles se destacam por **saturação**, que é mais robusto e é o que a regra central manda.

O mapa Positron é cinza-esverdeado quase sem croma. Isso faz dele a maior superfície da tela **sem cor** — então os pinos verde/âmbar/vermelho ficam sendo a única coisa saturada em toda a interface. A base clara honra "cor é informação" melhor que a escura honrava.

Como composição: chrome escuro emoldurando mapa claro dá figura/fundo imediato — **o painel é o instrumento, o mapa é o mundo**.

Há um seletor de camadas no mapa (Claro · Voyager · Escuro · OSM). É controle, não preferência: qual base lê melhor depende de onde se está voando. Satélite, se um dia for preciso, é mais uma entrada no mesmo objeto `BASEMAPS`.

**Atribuição do OSM é obrigatória por licença** — fica no rodapé direito, estilizada nos tokens para não gritar nem sumir.

## Tipografia

- **Interface:** IBM Plex Sans — desenhada para produto técnico/industrial. Escolhida também *contra* Inter/Geist, o default de todo layout gerado por IA.
- **Dados e logs:** IBM Plex Mono com `font-variant-numeric: tabular-nums`. Funcional, não estético: telemetria atualizando a cada segundo com dígitos de largura variável faz o número tremer no lugar.
- **Carregamento:** self-hosted em `static/connections/fonts/` (woff2, ~89 KB). **Nunca CDN** — a estação roda em campo, possivelmente sem internet.
- Base `14px` (a versão anterior usava `20px` no `:root`). Escala: `--t-xs 11` / `--t-sm 12` / `--t-md 14` / `--t-lg 16`.

**Ícones:** SVG inline, sem font de ícone. Mesmo motivo (offline) — e a versão anterior carregava Material Symbols de `fonts.sandbox.google.com`, host de sandbox que provavelmente já não servia nada.

## Forma

- **Raio:** `2px`. Um valor só. (`50%` em pontos de status e `9px` no switch são formas, não escala.)
- **Borda:** `1px solid var(--line)`, só onde separa superfície. As bordas de `2–3px` em cada elemento da versão anterior sumiram: hierarquia vem de fundo e peso.
- **Sombra:** só em tooltip e dropdown — coisas que de fato flutuam acima do plano.

## Grid

Três colunas de altura total, **nada em `vw`** (a versão anterior dimensionava botões em `16vw`, que estica em monitor grande e espreme em notebook):

| Coluna | Largura |
|---|---|
| Rail | `64px` fixo |
| Painel | `360px` · `320px` abaixo de 1440 |
| Mapa | `1fr`, nunca coberto |

Em 1920+ só o mapa cresce. Espaço em base 4: `4 / 8 / 12 / 16 / 24 / 32` — apertado dentro do grupo, `24` entre grupos.

O painel Frota é ancorado: lista (rola) → telemetria (fixa) → comandos (fixos). Telemetria em duas colunas a partir de 1440.

## Movimento

`120ms` em cor e fundo na mudança de estado. Nenhuma animação de layout.

Um único momento orquestrado: a linha do drone pulsa **uma vez** em âmbar ao entrar em *caution*. Sob `prefers-reduced-motion: reduce`, não pulsa.

## Elemento-assinatura

**A régua de status.** Cada linha da frota carrega um filete vertical de `3px` na borda esquerda, na cor do estado. Empilhadas, formam uma coluna contínua: um olhar na beirada do painel dá a saúde da frota inteira sem ler um número.

É o único lugar com cor saturada fora do mapa e do log — é o que torna visível a regra "cor é informação".

## Decisões fechadas — não reabrir sem motivo

- **Cor de marca não existe na interface.** Vermelho = crítico, e só.
- **Tema escuro.** Justificado pelo mapa.
- **Fontes e ícones self-hosted.** Campo pode estar offline.
- **Sem `vw` em componente.** Larguras fixas + mapa flexível.
- **Sem biblioteca de UI e sem build step.** Django servindo estático; uma tela só.
- **Cor de estado em texto só sobre `--surface-1` ou mais escuro.**
- **A palavra de status é acromática.** A cor do estado vive na régua, uma vez só.
- **Só a condição excepcional ganha cor.** `not ready` em âmbar; `ready` quieto.
- **Land e RTL são toggle de estado**, não checkbox — o `sendCommand` por baixo (28/29 e 30/31) não muda. Engatado = preenchido em `--caution` com texto `#14171A`.
  - O `:hover` do estado engatado **tem regra própria e é obrigatório**: `.btn:hover:not(:disabled)` tem especificidade (0,3,0) e vence `.btn-toggle[aria-pressed="true"]` (0,2,0). Sem ela, o botão engatado perde o preenchimento com o cursor em cima — falha justamente no controle mais perigoso da tela.
- **Os comandos declaram o alvo** (`TARGET · UAV-2`) acima dos botões. É a pergunta que o operador faz com o cursor sobre `Arm`.
- **O `Stop` de um script mira o drone daquela linha**, nunca a seleção da frota.
- **O ícone de Logs tem contador de não-lidas.** Não é enfeite: ao mover o log para trás de um ícone, toda ação ficou sem feedback visível. O contador é o que devolve o "aconteceu alguma coisa".
- **Poll de scripts em execução só com o painel aberto** (5 s), e as respostas (type 50) **não** vão para o log — inundariam o painel como os pings de posição (type 102), que já eram omitidos antes deste redesign.

## Em aberto

- Tema claro para uso sob sol direto — não decidido, seria trabalho novo.
- Nenhum requisito de tablet/celular até aqui.
- Timestamp por linha de log — não implementado; hoje a ordem é a única referência temporal.
