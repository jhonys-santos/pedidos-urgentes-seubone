# Pedidos Urgentes — SeuBoné

Sistema pra tirar o controle de pedidos urgentes do grupo de WhatsApp. SAC cadastra, estoque vê a fila em tempo real (com alerta sonoro) e despacha, você acompanha o KPI no histórico.

## Estrutura
Todos os arquivos ficam soltos na raiz do repositório (sem subpastas — evita erro de link quebrado):
- `Code.gs` → backend (Google Apps Script). Banco de dados é a própria planilha.
- `cadastro.html` → tela do SAC pra cadastrar o pedido.
- `painel.html` → tela do estoque, fica aberta o dia todo. Ordena por prazo, pisca vermelho quando atrasa, toca som quando entra pedido novo.
- `historico.html` → filtro por data + os 2 KPIs (% despachado no mesmo dia, tempo médio até despacho).
- `config.js` → único lugar que você edita depois do deploy (a URL do backend).
- `style.css` → estilo compartilhado pelas 3 telas.

## Passo 1 — Backend (Google Apps Script)
1. Crie uma Google Sheet nova, chame de "Pedidos Urgentes - SeuBoné".
2. Menu **Extensões > Apps Script**.
3. Apague o conteúdo de `Code.gs` que abrir e cole o conteúdo do `Code.gs` deste pacote.
4. No topo, selecione a função `configurarPlanilha` e clique em **Executar** (vai pedir autorização — autorize com sua conta Google). Isso cria a aba "Pedidos" com os cabeçalhos certos e a pasta no Drive pra guardar os manifestos.
5. **Implantar > Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
6. Copie a URL gerada (termina em `/exec`).

Toda vez que você editar o `Code.gs` depois disso, precisa ir em **Implantar > Gerenciar implantações > editar (lápis) > Versão: Nova versão > Implantar** — senão o `/exec` continua rodando a versão antiga.

## Passo 2 — Frontend (GitHub Pages)
1. Suba `cadastro.html`, `painel.html`, `historico.html`, `config.js` e `style.css` pro repositório — todos soltos, sem colocar dentro de nenhuma subpasta.
2. Abra `config.js` direto no GitHub (edit) e cole a URL do Passo 1 no lugar de `COLE_AQUI_A_URL_DO_APPS_SCRIPT`.
3. Ative o GitHub Pages no repositório (Settings > Pages > Branch: main).
4. Suas URLs finais:
   - `.../cadastro.html` → manda pro SAC
   - `.../painel.html` → deixa aberto num monitor/tablet fixo no estoque
   - `.../historico.html` → pra você acompanhar o KPI

## Ponto de atenção operacional
O alerta sonoro do painel só funciona com a aba aberta na tela. Se ninguém deixa aberto no estoque o dia todo, o problema de origem (ninguém vendo em tempo real) continua — só muda de canal. Recomendo fixar num monitor ou tablet dedicado no setor.

## Próximas melhorias (fica pra depois, combinado)
- Toast de confirmação ao despachar + aba "Despachados hoje" no painel
- Dark mode (mesmo padrão do Painel SAC)
- Editar/cancelar pedido já cadastrado
- Exportar histórico em CSV
- Autenticação simples (hoje qualquer um com o link acessa)
