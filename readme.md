<img alt="OLX Monitor" src="assets/olx-monitor-banner.png"></img>

# OLX Monitor

Estava procurando um produto específico no OLX, e diariamente acessava minhas buscas salvas no aplicativo à procura de uma boa oportunidade. Um dia encontrei uma ótima oportunidade, mas quando entrei em contato com o vendedor já era tarde, ele já estava indo ao encontro do comprador e caso a a venda não desse certo tinham mais 3 pessoas na espera para comprar.

Vi nessa situação uma oportunidade para aprender um pouco sobre scrapping usando o `nodejs` para tentar não perder uma próxima oportunidade. Espero que você também consiga o mesmo.

## ✨ Novas Funcionalidades (v2.0)

Recentemente o projeto recebeu grandes melhorias para tornar a monitoração ainda mais inteligente:

-   **📊 Análise Estatística Avançada:** O scrapper agora calcula média, mediana, moda e desvio padrão de todos os anúncios encontrados.
-   **📈 Detecção de Tendência (Theil-Sen):** Utiliza algoritmos estatísticos para identificar se os preços de uma busca estão subindo ou descendo nos últimos 30 dias.
-   **🧠 Notificações Inteligentes:** As mensagens no Telegram agora vêm com um resumo do mercado, indicando se o anúncio é um "Excelente Negócio", "Preço Justo" ou "Muito Caro" com base nos dados reais da plataforma.
-   **📉 Histórico de Preços:** Evolução do banco de dados para armazenar métricas detalhadas de cada varredura.
-   **🔄 Atualização Dinâmica:** Configuração com Docker/Nodemon que reinicia o serviço automaticamente ao alterar o arquivo de configurações (`config.js`).

## Instalação e configuração

Para utilizar esse script você precisa ter o `node` e o `npm` devidamente instalados (Node v20 recomendado), ter uma conta no [Telegram](https://telegram.org/), e idealmente um computador que fique ligado 24/7 para executar o script continuamente. Eu usei um Raspberry Pi 2 que consome pouca energia e já uso para outros fins, mas você pode usar um VPS, ou um sevidor gratuito da Oracle.

### Usando Node

1. Clonar ou fazer download do repositório `git clone https://github.com/carmolim/olx-monitor.git`
1. Instalar as dependências na pasta raiz e na pasta `src`: `npm install` e `cd src && npm install`
1. Renomear o arquivo `src/.env.example` para `src/.env` e incluir as informações do seu BOT e do seu grupo que irá receber as notificações
1. Incluir as URLs que você quer que sejam monitoradas no arquivo `src/config.js`
1. Definir qual o intervalo que você quer que as buscas sejam feitas no arquivo `src/config.js`
1. Executar o script usando o comando `node src/index.js` ou `npm start` (dentro de `src`)
1. Acompanhar o andamento do script no Terminal
1. Se correu tudo certo, dois novos arquivos foram criados dentro da pasta `data`: `ads.db` que é o banco de dados e o `scrapper.log` com os logs de execução do script

### Usando docker-compose (Recomendado)

O Docker facilita a execução e garante que o serviço reinicie se você mudar as configurações.

1. Configure o arquivo `src/.env` e `src/config.js`.
2. Na primeira vez, rode `docker-compose up --build -d`.
3. O serviço monitorará o `src/config.js`. Se você adicionar uma nova URL lá, o container reiniciará sozinho para aplicar a mudança.

### Configuração do Telegram

Para você poder receber as notificações pelo Telegram você precisa ter um bot (com um token) e um grupo onde o bot seja participante.

#### Criar seu bot

Para conseguir o seu token você precisa criar o seu próprio bot usando o [@BotFather](https://t.me/botfather). Você pode seguir este [tutorial em vídeo](https://www.youtube.com/watch?v=4u9JQR0-Bgc&feature=youtu.be&t=88) (assista até 3:24 para obter o token).

#### Descobrindo seu CHAT ID

Depois de criar o seu bot, crie um grupo e convide o seu bot e também o bot `@idbot`. Digite `/getgroupid@idbot` no grupo para obter o ID.

#### Editando seu ambiente

Preencha o arquivo `.env`:

| Variável          | Exemplo                                |
| ----------------- | -------------------------------------- |
| TELEGRAM_TOKEN    | Token do seu bot gerado pelo BotFather |
| TELEGRAM_CHAT_ID  | ID do seu chat (ex: -100...)           |

## O que deve ser monitorado?

Entre no site do OLX, faça uma busca com os filtros desejados (preço, região, estado do produto) e copie a URL completa.

**Dica:** Recomendo utilizar filtros bem específicos para não gerar resultados com muitos itens. Como esse script varre todos os resultados encontrados, filtros genéricos podem fazer o OLX perceber uma quantidade alta de chamadas do seu IP e realizar algum bloqueio temporário.

### Exemplos no `src/config.js`

#### Apenas uma `URL`
```javascript
config.urls = ['https://sp.olx.com.br/sao-paulo-e-regiao/centro/celulares/iphone?cond=1&cond=2&pe=1600&ps=600&q=iphone']
```

#### Várias `URLs`
Para usar várias URLs, basta separá-las por vírgula no array.
```javascript
config.urls = [
    'https://sp.olx.com.br/sao-paulo-e-regiao/centro/celulares/iphone?pe=1600&ps=600&q=iphone',
    'https://sp.olx.com.br/sao-paulo-e-regiao/imoveis/venda?bae=2&bas=1&pe=600000&ps=100000',
]
```

**Dica de Ouro:** Quanto mais específica sua busca for, mais eficiente o script será. Buscar por "iPhone" no Brasil todo gerará centenas de notificações irrelevantes por dia.

## Funcionamento e Inteligência

O script não apenas avisa sobre novos anúncios, mas faz uma curadoria em tempo real:
1. **Coleta:** Varre as páginas em busca de anúncios com preço definido.
2. **Estatística:** Filtra outliers e calcula referências de mercado baseadas em dados reais.
3. **Tendência:** Compara a mediana atual com varreduras de dias anteriores para identificar se o mercado está em alta ou baixa.
4. **Alerta Inteligente:** Envia o link com um "selo de qualidade" contextual (Ex: 🟢 PREÇO BOM: 15% abaixo da referência do mercado).

## Considerações

- Esse script só funciona com a versão brasileira do OLX.
- O banco de dados SQLite fica em `data/ads.db`.
