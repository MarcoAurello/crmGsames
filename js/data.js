/* Conteúdo do playbook: etapas, roteiros e objeções.
   Variáveis entre chaves são preenchidas com os dados do lead; as que faltarem
   aparecem como [colchetes] para você completar antes de enviar. */

const ETAPAS = [
  { id: 0, nome: 'Aquecimento', curto: 'Aquec.', cor: 'amber' },
  { id: 1, nome: '1ª mensagem', curto: '1ª msg', cor: 'blue' },
  { id: 2, nome: 'Resposta', curto: 'Resp.', cor: 'indigo' },
  { id: 3, nome: 'Convite demo', curto: 'Convite', cor: 'violet' },
  { id: 4, nome: 'Demonstração', curto: 'Demo', cor: 'emerald' },
  { id: 5, nome: 'Follow-up', curto: 'Follow', cor: 'pink' },
  { id: 6, nome: 'Piloto 14 dias', curto: 'Piloto', cor: 'teal' },
  { id: 7, nome: 'Cliente', curto: 'Cliente', cor: 'green' }
];

const STATUS = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  ganho: 'Cliente',
  perdido: 'Perdido'
};

const CANAIS = {
  instagram: 'Instagram',
  wpp_indicacao: 'WhatsApp (indicação)',
  wpp_frio: 'WhatsApp (frio)'
};

const AQUECIMENTO = [
  { key: 'seguir', txt: 'Seguir o perfil da escola ou clínica' },
  { key: 'curtir', txt: 'Curtir 3 posts recentes' },
  { key: 'comentar', txt: 'Comentar 1 ou 2 posts de forma genuína', ex: '“Que atividade linda! As crianças aprendem muito brincando assim.”' },
  { key: 'story', txt: 'Responder 1 story com uma reação ou elogio curto' },
  { key: 'detalhe', txt: 'Anotar um detalhe real do perfil (projeto, evento, conquista)' }
];

const MSG = {
  primeira: {
    instagram_Escola: {
      titulo: 'Escola (Direct)',
      texto: 'Oi, {nome}! Tudo bem? Acompanho o perfil da {instituicao} e adorei {detalhe} que vocês postaram. Fiquei curioso: vocês já usam algum jogo digital próprio, com a marca da escola, para reforçar os conteúdos?'
    },
    instagram_Clínica: {
      titulo: 'Clínica de psicopedagogia (Direct)',
      texto: 'Oi, {nome}! Vi o seu trabalho com {detalhe} e achei muito cuidadoso. Uma pergunta rápida: você já usa jogos digitais nas sessões? Se sim, eles levam a sua marca ou a de outra empresa?'
    },
    wpp_indicacao: {
      titulo: 'WhatsApp (indicação)',
      texto: 'Oi, {nome}! Aqui é {meuNome}, {indicadoPor} me passou seu contato. Trabalho com uma plataforma de jogos educativos que fica com a marca da {instituicao}. Posso te mandar um vídeo de 1 minuto mostrando como funciona?'
    },
    wpp_frio: {
      titulo: 'WhatsApp (contato frio)',
      texto: 'Oi, {nome}! Sou {meuNome}, da {empresa}. Ajudo escolas e clínicas a terem o próprio aplicativo de jogos educativos, com marca e voz da instituição. Faz sentido eu te mostrar em um vídeo rápido?'
    }
  },
  reacao: {
    nao_usa: {
      titulo: '“Não usamos”',
      texto: 'Que legal, então vocês podem sair na frente! Fiz uma simulação rápida de como ficaria o app com a marca da {instituicao}, olha só: [vídeo]. Dá até para colocar a sua voz nas instruções dos jogos. O que achou?'
    },
    outra: {
      titulo: '“Já usamos outra plataforma”',
      texto: 'Ótimo, então você já sabe o quanto os jogos engajam! A diferença aqui é que o app fica com a marca e a voz da {instituicao}, e o professor monta questionários pelo Excel em minutos. Posso te mostrar a diferença em um vídeo rápido?'
    },
    preco: {
      titulo: '“Quanto custa?”',
      texto: 'Depende do número de {publico} e do nível de personalização. Para eu te passar um valor justo: quantos {publico} usariam hoje?',
      dica: 'Depois da resposta, vá para o convite (Etapa 3) e apresente o preço na demonstração, já com o valor percebido.'
    },
    info: {
      titulo: '“Me manda mais informações”',
      texto: 'Claro! Para não te mandar um material genérico: o maior desafio hoje é engajar os {publico}, acompanhar a evolução deles ou mostrar resultado para os pais?',
      dica: 'A resposta indica qual argumento usar no convite. Registre no campo “Maior desafio”.'
    }
  },
  convite: {
    Escola: 'Posso te mostrar em 15 minutos, por chamada de vídeo, como o professor cria um questionário pelo Excel, monta uma competição entre as turmas e recebe o relatório no e-mail. Fica melhor {horario1} ou {horario2}?',
    Clínica: 'Posso te mostrar em 15 minutos como ficaria o app com a sua marca e a sua voz, e como os relatórios ajudam a mostrar a evolução para os pais. Prefere {horario1} ou {horario2}?',
    aceite: 'Combinado! Te mando o link da chamada aqui. Se puder, me envie o logo da {instituicao}, que eu já levo o app personalizado para você ver.',
    vespera: 'Amanhã às {horaDemo} está de pé? Já deixei o app com a sua marca pronto.'
  },
  followups: [
    { key: 'd2', dia: 2, titulo: 'Dia 2', texto: 'Oi, {nome}! Separei um vídeo de 40 segundos de uma competição entre alunos na plataforma. Posso te mandar?' },
    { key: 'd5', dia: 5, titulo: 'Dia 5', texto: '{nome}, olha como chega o relatório no e-mail do professor: [print]. Imagina mostrar isso na reunião de pais.' },
    { key: 'd9', dia: 9, titulo: 'Dia 9 (áudio curto)', texto: 'Oi, {nome}, tudo bem? Só queria saber se faz sentido para a {instituicao} ter um app próprio de jogos. Se não for o momento, sem problema, me avisa.' },
    { key: 'd14', dia: 14, titulo: 'Dia 14 (despedida)', texto: '{nome}, não quero ser chato, então essa é minha última mensagem por agora. Se um dia quiser ver o app com a sua marca, é só me chamar aqui.' }
  ],
  posDemo: [
    { key: 'p0', dia: 0, titulo: 'No mesmo dia', texto: 'Obrigado pelo tempo, {nome}! Como combinamos, segue o resumo: [3 benefícios + condição do piloto].' },
    { key: 'p2', dia: 2, titulo: '2 dias depois', texto: 'Conseguiu conversar com [sócio / direção]? Posso ajudar com alguma dúvida que surgiu?' },
    { key: 'p5', dia: 5, titulo: '5 dias depois', texto: 'Consigo reservar a configuração do piloto para começar na próxima segunda. Seguimos?' }
  ],
  piloto: 'Vamos fazer assim: eu configuro o app com a marca da {instituicao} e vocês usam por 14 dias com {grupoPiloto}. No fim, olhamos juntos o relatório. Se os {publico} engajarem, seguimos com o plano completo. Combinado?',
  fechamento: '{nome}, nesses 14 dias {pilotoQtd} {publico} jogaram e a média de acertos subiu de {acertoAntes}% para {acertoDepois}%. Para manter isso no ano todo, o plano fica em {valor}. Posso já gerar o contrato?',
  indicacao: 'Você conhece outra escola ou clínica que gostaria de ter um app assim?'
};

const PILOTO_PASSOS = [
  { key: 'd1', dia: 1, txt: 'Entregar o app personalizado e um modelo de planilha pronto' },
  { key: 'd3', dia: 3, txt: 'Perguntar como foi a primeira competição' },
  { key: 'd7', dia: 7, txt: 'Compartilhar o primeiro relatório e destacar um resultado positivo' },
  { key: 'd12', dia: 12, txt: 'Marcar uma conversa de 10 minutos para avaliar' },
  { key: 'd14', dia: 14, txt: 'Apresentar o plano e fechar' }
];

const ROTEIRO_DEMO = [
  { ate: 2, faz: 'Conexão e diagnóstico', diz: 'Antes de mostrar, me conta: qual é hoje o maior desafio com os {publico}?' },
  { ate: 5, faz: 'Abrir o app com o logo dele', diz: 'Esse é o app da {instituicao}. Os {publico} vão ver a sua marca, e as instruções podem ter a sua voz.' },
  { ate: 8, faz: 'Criar um questionário ao vivo pelo Excel', diz: 'O professor preenche a planilha: pergunta, resposta certa e respostas erradas. Sobe o arquivo e o jogo está pronto.' },
  { ate: 10, faz: 'Mostrar a competição', diz: 'Dá para criar disputas entre alunos ou turmas. É aí que o engajamento dispara.' },
  { ate: 12, faz: 'Mostrar o relatório por e-mail', diz: 'Você recebe no e-mail quem jogou, quanto acertou e onde precisa reforçar. Dá para mostrar isso aos pais.' },
  { ate: 15, faz: 'Proposta e piloto', diz: 'Que tal testar por 14 dias com uma turma? Se fizer sentido, a gente segue.' }
];

const OBJECOES = [
  { obj: 'Está caro.', resp: 'Entendo. Comparado com o quê? Pensa assim: dividido por [número] alunos, fica em [valor] por aluno ao mês, e a escola ganha um app com a própria marca para mostrar aos pais. Faz sentido testar no piloto antes de decidir?' },
  { obj: 'Já usamos outra plataforma.', resp: 'Ótimo, vocês já sabem o valor dos jogos. A diferença é que aqui o app é de vocês, com marca e voz, e o questionário sai do Excel em minutos. O que vocês mais sentem falta na plataforma atual?' },
  { obj: 'Preciso pensar.', resp: 'Claro. Para eu entender: o que ainda está pesando mais, o valor, o tempo dos professores ou a adesão dos alunos?' },
  { obj: 'Preciso falar com a direção / o sócio.', resp: 'Faz todo sentido. Quer que eu faça uma apresentação de 10 minutos com vocês dois juntos? Assim tiro as dúvidas na hora.' },
  { obj: 'Os professores não têm tempo.', resp: 'Justamente por isso: o professor preenche uma planilha que já conhece, sobe o arquivo e o jogo está pronto. E o relatório chega sozinho no e-mail. Quer ver quanto tempo leva ao vivo?' },
  { obj: 'Os alunos não têm celular / tablet.', resp: 'Funciona no navegador, então dá para usar no laboratório, no projetor da sala ou no celular dos pais em casa. Como vocês usam tecnologia hoje?', alerta: 'Confirme quais dispositivos a plataforma suporta antes de usar esta resposta.' },
  { obj: 'Não é o momento.', resp: 'Sem problema. Quando seria um bom momento, no início do próximo semestre? Posso te chamar em [mês]?' }
];
