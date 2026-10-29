# CRM Prospecção (Instagram & WhatsApp)

CRM local feito só com HTML, CSS e JavaScript. Funciona no navegador do computador e do celular,
guarda os dados no aparelho (funciona offline) e sincroniza com uma planilha do Google.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | a aplicação (abra no navegador) |
| `css/style.css` | estilos, responsivo e com modo escuro automático |
| `js/data.js` | playbook: etapas, mensagens, roteiro da demo e objeções (edite aqui para mudar os textos) |
| `js/store.js` | cache local + fila de envio para a planilha |
| `js/app.js` | telas e interações |
| `apps-script/Code.gs` | código que vai dentro da planilha do Google |

## Configurar a planilha (uma vez, ~5 minutos)

1. Acesse <https://sheets.new> e dê um nome à planilha, por exemplo **CRM Prospecção**.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do `Código.gs` e cole todo o conteúdo de `apps-script/Code.gs`. Salve (Ctrl+S).
4. No seletor de função (ao lado de “Depurar”), escolha **setup** e clique em **Executar**.
   - Na primeira vez o Google pede autorização: **Revisar permissões → sua conta → Avançado →
     Acessar projeto (não seguro) → Permitir**. É o seu próprio script, por isso o aviso.
   - Ao final, abra o **Registro de execução** e copie o valor depois de `TOKEN (...)`.
   - A aba **Leads** é criada com o cabeçalho.
5. Clique em **Implantar → Nova implantação**.
   - Engrenagem ⚙ ao lado de “Selecionar tipo” → **App da Web**.
   - **Executar como:** Eu.
   - **Quem pode acessar:** Qualquer pessoa.
   - **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
6. Abra o `index.html`, toque na engrenagem ⚙ (Configurações) e cole a **URL** e o **Token**.
   Clique em **Testar conexão**, depois em **Salvar**.

Se você já tinha cadastrado leads antes de conectar, eles são enviados automaticamente.
O botão **Enviar tudo para a planilha** força o reenvio completo.

### Quando alterar o `Code.gs`

Depois de editar o script, vá em **Implantar → Gerenciar implantações → ✏ Editar →
Versão: Nova versão → Implantar**. Assim a URL continua a mesma.

### Segurança

- “Qualquer pessoa” significa qualquer um **com a URL e o token**. Sem o token o script recusa.
- Não publique a URL e o token juntos. Para trocar o token: Apps Script → ⚙ Configurações do projeto →
  Propriedades do script → edite `TOKEN` (ou apague e rode `setup()` de novo) e atualize no CRM.

## Usar no celular

O app é um site estático. Opções:

- **Mais simples:** hospede a pasta em qualquer servidor estático (ex.: a VPS com Dokploy,
  GitHub Pages, Netlify) e abra a URL no celular. No Chrome/Safari use “Adicionar à tela inicial”.
- **No computador:** dê dois cliques em `index.html`.

Cada aparelho tem seu próprio cache; a planilha é a fonte comum. Ao abrir ou voltar para o app,
ele busca a versão mais recente. Se dois aparelhos editarem o mesmo lead, vale a alteração mais nova.

## Como o funil funciona

| Etapa | O que o app faz |
|---|---|
| 0. Aquecimento | checklist (seguir, curtir, comentar, story, anotar detalhe) + qualificação rápida |
| 1. 1ª mensagem | escolhe o modelo pelo canal/tipo, preenche nome, instituição e detalhe; “Marcar como enviada” agenda o alerta de 48h |
| 2. Resposta | escolha a reação (“não usamos”, “outra plataforma”, “quanto custa?”, “mais informações”) e veja a resposta |
| 3. Convite demo | convite com 2 horários (Configurações), data da demo, mensagem de aceite e confirmação na véspera |
| 4. Demonstração | roteiro de 15 min com cronômetro e follow-ups pós-demo (mesmo dia, +2, +5) |
| 5. Follow-up | dias 2, 5, 9 e 14 contados a partir da 1ª mensagem; depois, “Pausar 30 dias” |
| 6. Piloto 14 dias | proposta, passos dos dias 1/3/7/12/14 e mensagem de fechamento com os resultados |
| 7. Cliente | pedido de indicação e botão para cadastrar o indicado já no script de WhatsApp com indicação |

A aba **Hoje** junta as próximas ações de todos os leads (atrasadas, hoje e próximos 7 dias).
Os textos usam `{variáveis}`; o que estiver faltando aparece como `[colchetes]` para completar antes de enviar.
Todas as mensagens podem ser editadas antes de copiar.
