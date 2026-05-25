 FocusPlay 

Estude com foco. Cultive sua fazenda. Compita com o mundo.

O FocusPlay Arena é um aplicativo web gamificado de produtividade que une a técnica Pomodoro com um sistema de fazenda virtual interativa. O objetivo da plataforma é transformar sessões de estudo em uma experiência divertida, motivadora e competitiva, incentivando os usuários a manterem o foco através de recompensas, progressão de níveis e desafios diários.

Durante cada sessão de foco, o usuário cultiva plantas virtuais que evoluem conforme o tempo de estudo é concluído. Caso o usuário abandone a aplicação durante uma sessão ativa, penalidades são aplicadas às plantações, criando um sistema de responsabilidade e comprometimento com os estudos.

Além disso, o sistema contará com integração com a API do Spotify, permitindo que os estudantes possam ouvir músicas, playlists e sons ambientes enquanto estudam, tornando a experiência mais agradável e personalizada.

✨ Funcionalidades
⏱️ Sistema Pomodoro

O sistema de produtividade utiliza a técnica Pomodoro, permitindo sessões configuráveis de:

25 minutos
45 minutos
60 minutos

O aplicativo possui:

Pausas curtas automáticas de 5 minutos
Pausas longas automáticas de 15 minutos
Controle de início, pausa e encerramento das sessões

Também existem dois modos de estudo:

☕ Solo

Modo individual focado apenas na produtividade pessoal.

⚔️ Arena

Modo competitivo onde o jogador recebe bônus de +25% de XP ao estudar competindo com outros usuários.

🌾 Fazenda Virtual

A fazenda virtual representa visualmente o progresso do usuário durante os estudos.

O jogador pode:

Plantar sementes
Acompanhar o crescimento das plantas
Colher plantações concluídas
Ganhar moedas virtuais
Expandir sua fazenda

O sistema possui:

9 tipos de plantas
Sistema de raridade
Qualidade influenciada pelo comportamento do usuário
Slots expansíveis de fazenda

O jogador inicia com 3 espaços de plantio e pode expandir até 6 slots.

⚠️ Sistema de Penalidades

O FocusPlay Arena possui um sistema de penalidades para incentivar o foco contínuo.

Caso o usuário saia da aplicação durante uma sessão ativa, as plantas sofrem consequências de acordo com sua raridade:

Raridade	Penalidade
Comum	❄️ Congela o crescimento
Raro	📉 Perde qualidade
Épico	⏪ Regride progresso
Lendário	💀 Morre e perde a semente

A detecção ocorre através da utilização da Page Visibility API.

🏆 Progressão do Jogador

O sistema possui progressão baseada em experiência (XP) e níveis.

O jogador ganha XP ao:

Completar sessões
Cumprir desafios
Manter streaks diários
Participar da Arena

Também existem:

🔥 Sistema de sequência diária (streak)
🏅 Ranking global
📊 Placar semanal
🎯 Desafios diários
🎯 Desafios Diários

Os desafios incentivam a constância nos estudos e oferecem recompensas adicionais.

Desafio	Objetivo	Recompensa
Maratonista	Completar 3 sessões	+50 XP e +30 moedas
Sem parar	Não sair do app durante uma sessão	+40 XP e +20 moedas
Colheita	Colher 2 plantas	+60 XP e +40 moedas
Foco longo	Completar sessão de 45 minutos	+80 XP e +50 moedas
📊 Sistema de Níveis
Nível	Nome	XP Necessário
1	Sementinha 🌱	0
2	Brotinho 🌿	100
3	Agricultor 🧑‍🌾	250
4	Fazendeiro 🌾	500
5	Mestre Foco 🎯	900
6	Cultivador 🪴	1.500
7	Guardião 🌳	2.500
8	Lendário 💫	4.000
9	Mítico 🌌	6.000
10	Arquimago 💎	9.000
🏪 Loja Virtual

A loja permite utilizar moedas obtidas durante o jogo para adquirir melhorias.

Expansões
Novos slots de fazenda
Estufa com bônus de +50% rendimento
Melhorias
Solo Rico (+20% rendimento)
Solo Fértil (+50% rendimento)
Fertilizantes para acelerar crescimento
Cosméticos
Pets virtuais 🐱🐶🦊
Decorações para a fazenda
🌿 Plantas Disponíveis
Planta	Emoji	Raridade	Sessão Necessária	Rendimento	Custo
Trigo	🌾	Comum	1 min	15 moedas	Grátis
Cenoura	🥕	Comum	2 min	25 moedas	10 moedas
Milho	🌽	Comum	3 min	40 moedas	20 moedas
Tomate	🍅	Raro	5 min	80 moedas	50 moedas
Abóbora	🎃	Raro	7 min	120 moedas	80 moedas
Uva	🍇	Épico	10 min	200 moedas	150 moedas
Melão	🍈	Épico	12 min	280 moedas	200 moedas
Trufa	🍄	Lendário	20 min	500 moedas	400 moedas
Cristal	💎	Lendário	25 min	800 moedas	600 moedas
🎵 Integração com Spotify

O projeto contará com integração da API do Spotify para permitir que os usuários possam ouvir música durante os estudos sem precisar sair da plataforma.

As funcionalidades previstas incluem:

Login com conta Spotify
Reprodução de playlists de estudo
Música ambiente durante sessões Pomodoro
Controle de play/pause dentro do aplicativo
Sugestões automáticas de playlists para foco
Integração opcional com playlists favoritas do usuário

Essa funcionalidade busca aumentar a imersão e melhorar a experiência do estudante durante os períodos de concentração.

🔐 Sistema de Autenticação

O aplicativo possui:

Cadastro com e-mail e senha
Login de usuário
Modo visitante

O progresso pode ser:

Salvo localmente no navegador
Sincronizado em nuvem com Firebase
☁️ Integração com Firebase

Quando habilitado, o Firebase será utilizado para:

Autenticação de usuários
Banco de dados em nuvem com Firestore
Sincronização de progresso
Ranking online
Armazenamento de dados do jogador

Caso o Firebase esteja desativado, o sistema continua funcionando normalmente utilizando LocalStorage.

🛠️ Tecnologias Utilizadas

O projeto será desenvolvido utilizando:

HTML5
CSS3
JavaScript puro
Firebase Auth
Firebase Firestore
Spotify Web API
Web Notifications API
Page Visibility API
PWA (Progressive Web App)

Também serão utilizadas as fontes:

Google Fonts Nunito
Google Fonts Space Mono
📁 Estrutura do Projeto
/
├── index.html      # Estrutura principal da aplicação
├── style.css       # Estilização completa do sistema
├── app.js          # Lógica principal do jogo e sistema Pomodoro
├── spotify.js      # Integração com API do Spotify
└── manifest.json   # Configuração PWA
🚀 Como Utilizar
Abra o arquivo index.html em um navegador moderno
Faça login ou utilize o modo visitante
Escolha uma sessão Pomodoro
Vá até a fazenda e plante sementes
Mantenha o foco durante a sessão
Colha plantas para ganhar moedas
Utilize moedas na loja para expandir sua fazenda
Conecte sua conta Spotify para ouvir músicas durante os estudos
⚙️ Configuração Firebase

Para utilizar sincronização em nuvem, configure as credenciais do Firebase no arquivo app.js.

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
};
🎓 Objetivo do Projeto

O FocusPlay Arena busca transformar o estudo em uma experiência mais divertida, interativa e motivadora, utilizando elementos de gamificação para aumentar o foco, a disciplina e a constância dos usuários.

A combinação entre produtividade, competição, recompensas e personalização musical cria um ambiente moderno capaz de incentivar estudantes a manterem hábitos de estudo mais saudáveis e eficientes.
