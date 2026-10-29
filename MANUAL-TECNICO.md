# Manual técnico do ComGestor

Este manual resume as mudanças recentes e indica onde investigar e corrigir problemas no código e na publicação.

## Onde o sistema está publicado

- Endereço do site: `https://ellenfgomes.github.io/`
- Páginas diretas do projeto: `https://ellenfgomes.github.io/index.html` e `https://ellenfgomes.github.io/login.html`
- Repositório do site no GitHub: `ellenfgomes/ellenfgomes.github.io`
- O repositório local ainda pode mostrar `origin` como `ellenfgomes/ComGestor`; o GitHub redireciona o endereço antigo após uma renomeação.

**Atenção:** na última verificação, `index.html` e `login.html` abriram, mas a raiz `https://ellenfgomes.github.io/` ainda respondeu 404. Isso é configuração do GitHub Pages, não erro no JavaScript do login. Confira as instruções em [Problemas comuns](#problemas-comuns).

## O que foi implementado

- Identificação do usuário conectado para autoria e atualização do criador do card.
- Sugestões de menção usando usuários ativos com acesso à organização, em descrições e comentários.
- Lista de menções em **Minhas ações**, com contador e visualização em lista ou grade.
- Espaço **Sugestão** com feed de ideias, curtidas, respostas e pesquisa de satisfação de 0 a 10. Cada pessoa pode atualizar sua própria nota; o painel exibe apenas a média e a distribuição agregadas da organização.
- Menções permanecem até a conclusão: as ligadas a uma ação saem quando ela é concluída; as demais saem quando o card é concluído ou todas as suas ações são concluídas. Abrir o card não as dispensa.
- Ao abrir um card em **A Fazer**, ele muda para **Em Andamento**, respeitando o limite configurado na área.
- Ao concluir todas as ações, o card muda para **Concluídos**. Adicionar uma ação ou reabrir uma ação em um card concluído retorna o card para **Em Andamento**.
- Sincronização do status ativo/inativo dos usuários autorizados pela lista oficial no carregamento de dados do Convex.
- Redirecionamento de login relativo (`./index.html`), compatível com publicação na raiz e em subdiretório.

## Arquivos principais

| Arquivo                                                                    | O que mantém                                                                                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [script.js](./script.js)                                                    | Interface principal, menções, “Minhas ações”, sugestões, pesquisa de satisfação, transições de status e carregamento da sessão.                                                                    |
| [index.html](./index.html) e [style.css](./style.css)                        | Estrutura e aparência do quadro, feed de sugestões, termômetro, modais e visualização das ações.                                                                                                   |
| [login.html](./login.html), [login.js](./login.js) e [login.css](./login.css) | Tela, autenticação e mensagens de erro do login.                                                                                                                       |
| [comgestor-client.js](./comgestor-client.js)                                | Chamadas do navegador ao backend Convex e token de sessão.                                                                                                              |
| [convex/lib/acesso.ts](./convex/lib/acesso.ts)                              | Validação do login, e-mail, usuário ativo e permissões no backend.                                                                                                   |
| [convex/usuarios.ts](./convex/usuarios.ts)                                  | Dados de sessão e usuários disponíveis para menção/compartilhamento.                                                                                                |
| [convex/sugestoes.ts](./convex/sugestoes.ts)                                | Sugestões da organização, comentários, curtidas e respostas agregadas da pesquisa de satisfação. |
| [convex/sugestoes.test.ts](./convex/sugestoes.test.ts)                      | Testes de colaboração no feed, agregação de notas e isolamento entre organizações. |
| [convex/seedData.ts](./convex/seedData.ts)                                  | Lista de usuários autorizados, e-mail, área, perfil e estado ativo esperado.                                                                                           |
| [convex/seed.ts](./convex/seed.ts)                                          | Carga inicial e sincronização de usuários já existentes. Em execuções posteriores sincroniza o status ativo, mas preserva perfil e área dos usuários existentes. |
| [convex/acesso.test.ts](./convex/acesso.test.ts)                            | Testes de autorização, sessão e sincronização do estado ativo.                                                                                                      |
| [.github/workflows/static.yml](./.github/workflows/static.yml)              | Publicação do site estático no GitHub Pages.                                                                                                                          |
| [.github/workflows/convex.yml](./.github/workflows/convex.yml)              | Testes, publicação do backend Convex e execução da seed no push para `main`.                                                                                       |
| [convex/auth.config.ts](./convex/auth.config.ts)                            | Domínio do Clerk confiável pelo Convex.                                                                                                                                |

## Como as partes se conectam

O sistema é uma aplicação web estática com backend Convex e autenticação Clerk:

1. O navegador carrega `login.html` ou `index.html` pelo GitHub Pages.
2. O Clerk autentica a pessoa e fornece um token de sessão.
3. `comgestor-client.js` envia esse token para a instância Convex definida em `CONVEX_URL`.
4. O Convex executa `usuarios:minhaSessao`. A função `usuarioAtual` valida token, e-mail verificado, cadastro ativo, organização, área e perfil.
5. O frontend recebe nome, e-mail, permissões, quadros disponíveis e usuários elegíveis para menção.
6. As consultas e mutações de cards verificam permissões e visibilidade no backend. O navegador atualiza e salva as alterações por meio de `cards:listarPorQuadro` e `cards:persistirDoApp`.
7. O GitHub Actions publica o site estático e, em fluxo separado, testa e publica o backend Convex.

**Importante:** esconder ou desabilitar um controle na página não substitui a autorização no backend. Regras de segurança e acesso precisam ser verificadas em `convex/`, não só em `script.js`.

## Estrutura resumida do código

```text
.
├── index.html, script.js, style.css       # aplicação principal
├── login.html, login.js, login.css        # autenticação e entrada
├── comgestor-client.js                    # integração browser ↔ Convex
├── convex/
│   ├── schema.ts                          # tabelas e índices
│   ├── cards.ts, usuarios.ts              # consultas e mutações
│   ├── lib/acesso.ts                      # autenticação e autorização
│   ├── seedData.ts, seed.ts               # cadastro inicial/autorização
│   └── acesso.test.ts                     # testes de acesso
└── .github/workflows/
    ├── static.yml                         # deploy do GitHub Pages
    └── convex.yml                         # teste/deploy do Convex
```

Os dados relacionais de organização, quadros, áreas, perfis, usuários, cards, ações e comentários ficam no Convex. Parte da interface de card é preservada em `dados_interface`. O navegador mantém também cópia local para apoio da interface, mas o backend é a fonte de dados remotos após a sessão autenticada.

## Preparação para desenvolvimento

Requisitos:

- Node.js 20 ou mais recente (o workflow usa Node.js 22).
- Git configurado e acesso ao repositório.
- Acesso administrativo ao projeto Clerk e à instância Convex para mudanças de autenticação/publicação.
- Dependências instaladas via npm.

No PowerShell, dentro da pasta do projeto:

```powershell
npm ci
npm test
git status -sb
```

`npm ci` instala exatamente as versões travadas em `package-lock.json`. Use `npm install` quando estiver atualizando dependências intencionalmente. Não edite arquivos gerados dentro de `convex/_generated/` manualmente; use o codegen.

Comandos disponíveis em `package.json`:

| Comando                    | Uso                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`               | Executa os testes Vitest dentro de `convex/`.                                                                                |
| `npm run convex:codegen` | Regenera os tipos do Convex.                                                                                                   |
| `npm run convex:dev`     | Vincula/inicia o ambiente de desenvolvimento Convex; pode solicitar configuração interativa.                                 |
| `npm run convex:deploy`  | Publica as funções Convex na implantação configurada.                                                                      |
| `npm run convex:seed`    | Executa `seed:carregar` na implantação configurada. Use com atenção: sincroniza o status ativo conforme a lista oficial. |

Antes de executar comandos de deploy ou seed localmente, confirme qual implantação Convex está vinculada. O workflow de produção é a forma automatizada padrão de publicar alterações na branch `main`.

## Configuração de autenticação Clerk

1. O Clerk usado pelo frontend é definido nas tags de script em `login.html` e `index.html` (chave publicável e host).
2. O domínio autenticador aceito pelo Convex é definido em `convex/auth.config.ts`. Ele deve corresponder ao Frontend API URL da mesma instância Clerk.
3. A integração Clerk ↔ Convex deve estar habilitada para essa instância e emitir a audiência `convex`.
4. O token deve incluir:

   ```json
   {
     "email": "{{user.primary_email_address}}",
     "email_verified": "{{user.email_verified}}"
   }
   ```
5. `email_verified` deve ser booleano JSON, e não texto entre aspas.
6. Não use uma chave secreta `sk_...` no cliente. A chave publicável `pk_...` não é segredo; deploy keys, tokens administrativos e outros segredos pertencem aos secrets do GitHub/serviços.

O site foi observado carregando chave de desenvolvimento do Clerk. O aviso do Clerk não é um erro do GitHub Pages: para produção, é necessária a configuração de uma instância Clerk de produção, domínio permitido, chaves correspondentes no site e domínio autorizado no Convex. Planeje a troca em conjunto para não deixar frontend e backend apontando para instâncias diferentes.

## Usuários, perfis e permissões

- `convex/seedData.ts` é a lista versionada que informa e-mail, nome, área, perfil e valor esperado para `ativo`.
- `convex/seed.ts` insere a estrutura inicial numa implantação vazia. Em implantação já inicializada, adiciona usuários ausentes e atualiza somente o campo `ativo` de usuários presentes na lista; preserva perfil, área e nome de registros existentes.
- `convex/lib/acesso.ts` associa a identidade do Clerk ao usuário por e-mail normalizado e exige que organização, área e usuário estejam ativos.
- `convex/usuarios.ts` monta a sessão, permissões/quadros da pessoa e a lista de usuários elegíveis a menções.
- `convex/schema.ts` documenta os campos obrigatórios e índices usados nas consultas.

Para autorizar uma pessoa:

1. Obtenha aprovação interna para o acesso e confirme o e-mail corporativo exato.
2. Inclua o usuário na lista correta de `convex/seedData.ts`, com organização, área e perfil existentes e `ativo: true`.
3. Revise as permissões do perfil na seção `perfilPermissoes` de `seedData.ts`; conceda apenas o necessário.
4. Rode `npm test` e revise o diff.
5. Publique pelo fluxo `Convex backend` (push para `main` ou execução manual autorizada).
6. Confirme no log da etapa de seed que a implantação recebeu as alterações esperadas; depois teste a sessão com a conta do usuário.

Para revogar o acesso, ajuste o usuário aprovado para `ativo: false` e publique. A seed sincroniza esse campo nas execuções futuras. Uma alteração de perfil ou área de alguém que já existe **não** é aplicada automaticamente pela seed: faça essa mudança por um processo administrativo controlado no cadastro Convex e registre/aprove a alteração. Não crie permissões diretamente no cliente.

## Menções e “Minhas ações”

- As sugestões usam usuários válidos enviados junto com a sessão e são normalizadas no frontend, pois o backend expõe `nome` enquanto a caixa de sugestões trabalha com `name`.
- O detector considera nome e e-mail do usuário atual e os registros de menção nos comentários.
- A lista reúne menções no título/descrição do card, comentários do card, títulos de ações e comentários de ações.
- Ações atribuídas ao usuário e ainda não concluídas aparecem na seção de pendências; menções são apresentadas separadamente.
- O contador da navegação reflete as menções pendentes. Há atualização periódica de cards, aproximadamente a cada 30 segundos, evitando substituir dados quando há edição aberta ou alterações locais ainda não sincronizadas.
- Lista/grade altera a apresentação de “Minhas ações”, não as regras de autorização.
- Abrir o card não marca a menção como lida. Menções associadas a ação concluída deixam a lista; menções gerais deixam quando o card está em “Concluídos” ou todas as ações existentes estão concluídas.

**Limitação atual:** a regra de menções pendentes está no frontend e deriva dos cards carregados. Ela não é uma caixa de notificações persistida e sincronizada em tabela própria no servidor. Modificar o comportamento entre dispositivos exige projetar e implementar um estado de notificação no Convex.

## Status, conclusão e limite de andamento

- `ACTIVE_CARD_LIMIT` em `script.js` define o limite de cards em andamento por área.
- Abrir card em “A Fazer” tenta mover para “Em Andamento”; se o limite estiver cheio, o card abre sem a movimentação e a interface avisa.
- O evento de abertura registra movimentação no histórico e persiste o card.
- `syncCardStatusWithActions` sincroniza cards normais em “A Fazer”, “Em Andamento” ou “Concluídos”: todas as ações concluídas move o card para “Concluídos”; adicionar/reabrir ação num card concluído o retorna para “Em Andamento”.
- Cards espelhados recebem as alterações de status e ações nos fluxos correspondentes.
- Cards suspensos e cancelados são excluídos da sincronização automática entre ações e status.
- A restrição de quem pode concluir cards também é aplicada nos fluxos de interface; valide sempre no backend se for alterar segurança de conclusão.

## Problemas comuns

### A raiz do endereço mostra 404

**Estado observado em 14/10/2026:** `https://ellenfgomes.github.io/` retornou 404, mas `/index.html` e `/login.html` abriram. O repositório público `ellenfgomes/ellenfgomes.github.io` existe e a execução do workflow estático concluiu com sucesso. Se isso acontecer novamente, a causa provável é a configuração de Pages ou o artefato publicado, não o redirecionamento JavaScript.

Verifique nesta ordem:

1. Confirme o endereço exato e o repositório. O site de usuário só usa a raiz quando o repositório está nomeado exatamente `ellenfgomes.github.io`.
2. Abra [Settings → Pages do repositório](https://github.com/ellenfgomes/ellenfgomes.github.io/settings/pages).
3. Em **Build and deployment**, selecione **GitHub Actions** como fonte de publicação.
4. Abra **Actions → Deploy static content to Pages**. Confira a execução mais recente da branch `main`, o job `deploy` e o passo **Deploy to GitHub Pages**.
5. Se a execução não estiver verde, abra o log do primeiro passo com erro. Se estiver verde, confirme que o artefato contém `index.html` na raiz e que o arquivo não foi enviado para uma subpasta.
6. Teste as três URLs separadamente:
   - `https://ellenfgomes.github.io/`
   - `https://ellenfgomes.github.io/index.html`
   - `https://ellenfgomes.github.io/login.html`
7. Se somente a raiz falhar, deixe o Pages configurado para GitHub Actions e publique novamente; confirme no conteúdo publicado que existe um `index.html` na raiz. Aguarde a propagação e teste em janela anônima.
8. Enquanto a raiz não responder, use `/index.html` para o quadro ou `/login.html` para o login.

Renomear o repositório e publicar o Pages são operações distintas: o nome correto possibilita o domínio de usuário, mas ainda é necessário habilitar e completar a publicação do Pages. O workflow em [`.github/workflows/static.yml`](./.github/workflows/static.yml) publica o conteúdo da raiz do repositório em cada push para `main`.

### A página abre, mas fica em “Verificando seu perfil e suas permissões”

Isso indica que o frontend começou a carregar, mas ainda não terminou a validação de sessão e a consulta ao Convex.

1. Abra as ferramentas do navegador (`F12`) → **Console** e **Network**.
2. Procure erros em `clerk`, `comgestor-client.js`, `usuarios:minhaSessao` e nas requisições para `convex.cloud`.
3. Se `ClerkJS não foi carregado`, confira conexão de rede, host Clerk e scripts em `login.html`/`index.html`.
4. Se `Sessão não autenticada`, termine o login em `/login.html` antes de abrir o quadro; a página principal exige uma sessão válida.
5. Se houver erro de token ou issuer/audience, confira integração Clerk–Convex, host de autenticação em `convex/auth.config.ts` e claims do token.
6. Se aparecer `Could not find public function`, publique o backend e confirme que `usuarios:minhaSessao` existe.
7. Se a resposta Convex for um erro HTTP, anote código, endpoint e mensagem. Evite compartilhar tokens, cabeçalhos `Authorization`, cookies ou capturas com dados pessoais.

O `index.html` é uma página protegida: sem sessão ele redireciona para `login.html`. O login verifica novamente a sessão no Convex antes de retornar ao quadro. O redirecionamento relativo `./index.html` permite hospedar o projeto tanto na raiz do Pages como num subdiretório.

### O login diz que a conta não está autorizada

1. Confirme que o e-mail recebido no token do Clerk é o e-mail corporativo esperado. A comparação no backend ignora maiúsculas/minúsculas.
2. Confirme que o e-mail está listado em [convex/seedData.ts](./convex/seedData.ts), com `ativo: true`.
3. Confirme em [convex/lib/acesso.ts](./convex/lib/acesso.ts) que o usuário existe e está ativo no Convex, e que sua organização, área e perfil também estão ativos.
4. Se o usuário autorizado já existe mas está inativo, a seed pode reativá-lo. Faça push da alteração aprovada para `main` ou execute o workflow **Convex backend** em **Actions**; o workflow publica o backend, roda os testes e chama a seed.
5. Consulte o log da execução **Convex backend**. A seed atualiza o estado ativo, mas não troca perfil nem área de registros existentes.

Não inclua contas na lista de autorização sem aprovação do administrador.

### O login fica em “Verificando acesso” ou informa sessão não autenticada

- Confira se o usuário concluiu o login e se o e-mail está verificado.
- Em Clerk, verifique a integração Convex e as claims `email` e `email_verified` do token de sessão.
- Confira se o domínio em [convex/auth.config.ts](./convex/auth.config.ts) corresponde ao Frontend API URL da instância Clerk usada pelo site.
- Confira o URL da instância Convex configurado em [comgestor-client.js](./comgestor-client.js).
- O frontend precisa chamar a consulta `usuarios:minhaSessao`; ela deve estar publicada no Convex.
- Use o console do navegador e os logs da execução de **Convex backend** para encontrar a mensagem original. Não trate “e-mail não verificado”, “sem acesso” e token inválido como o mesmo problema.

### O site mostra aviso de chaves de desenvolvimento do Clerk

O site foi observado carregando uma instância de desenvolvimento do Clerk. Para uso em produção, configure uma instância de produção no Clerk e substitua a chave publicável nos arquivos [login.html](./login.html) e [index.html](./index.html), além do domínio Clerk relacionado. Atualize também [convex/auth.config.ts](./convex/auth.config.ts) para confiar no domínio de produção e confira a integração do Convex antes de publicar. Não coloque chaves secretas no JavaScript ou no repositório.

### O login do Clerk funciona, mas o retorno ao sistema não

- Confirme que o domínio GitHub Pages está permitido nas configurações da instância Clerk e nos redirects/callbacks usados pelo login.
- Confirme que o Clerk persiste a sessão no mesmo domínio em que a aplicação foi aberta. Evite alternar entre domínio raiz, subdiretório, endereço antigo do Pages e novo endereço durante o teste.
- O handler em `login.js` chama `verificarUsuario()` quando há uma sessão. Essa função chama `ComGestorConvex.minhaSessao()`; só então redireciona para `./index.html`.
- Se o usuário autenticou mas voltou à tela de login, investigue a exceção real registrada pelo Console; o login trata e-mails não autorizados, e-mails não verificados, token inválido e função Convex ausente com mensagens diferentes.
- Se trocar o domínio público ou Clerk de desenvolvimento para produção, revise redirects, hosts de script, chave publicável, `auth.config.ts` e integração Convex em conjunto.

### Menções ou contador não atualizam

- Digitar `@` sem sugestões: confira se `usuarios:minhaSessao` devolve usuários ativos e se `script.js` normaliza `nome` para `name` ao receber a sessão.
- Menção ausente: confira o texto e se a pessoa mencionada corresponde ao nome ou e-mail do usuário conectado.
- Contador desatualizado: recarregue a página e confira a sessão e os cards retornados pelo Convex. A atualização automática ocorre periodicamente.
- Para mudar quando uma menção deixa a lista, investigue `isCardConclusionReached` e `getCurrentUserMentions` em [script.js](./script.js).
- Uma menção no comentário pode ser encontrada pelos objetos `mentions` registrados ou pelo texto que contém `@nome`/`@e-mail`; confira ambas as partes ao diagnosticar dados antigos.
- Uma menção em ação concluída é filtrada; a conclusão de todas as ações ou o status “Concluídos” pode ocultar as menções do card conforme a regra atual.

### Card não muda para “Em Andamento” ou “Concluídos”

As regras ficam em [script.js](./script.js), nas funções `openCardDetailModal`, `toggleModalAction`, `syncCardStatusWithActions` e `saveActionFromModal`.

- A abertura só muda cards em **A Fazer**; cards suspensos, cancelados ou concluídos não são movidos pela abertura.
- O limite por área é `ACTIVE_CARD_LIMIT`. Quando atingido, o card abre sem mudança de status e aparece um aviso.
- Apenas cards em **A Fazer**, **Em Andamento** e **Concluídos** participam da sincronização automática com as ações.
- Alterações não persistidas: verifique a chamada a `saveStorage()` e o log de erros do Convex no console.
- Uma ação precisa estar gravada em `card.actions` com `completed: false` para ser considerada pendente. Confira o snapshot do card no Network sem expor dados sensíveis.
- A movimentação automática ao abrir é uma regra do frontend. Se outro cliente ou processo alterar status diretamente, deve aplicar regra equivalente no backend para manter consistência.

### O usuário não vê um card ou não consegue alterá-lo

1. Verifique se a organização, o quadro e a área estão ativos.
2. Confirme se o card está no quadro permitido ao perfil atual ou se existe compartilhamento apropriado.
3. Para visibilidade por pessoas específicas, confirme o usuário criador, responsável, destinatário direto ou responsável por uma ação, conforme as regras em `podeVerCard`.
4. Para edição, verifique a permissão `CARD_EDITAR` e seu escopo (`PROPRIO`, `QUADRO` ou `TODOS`), além das exceções de criador/responsável/compartilhamento de edição.
5. Abra o log da mutação no Convex para distinguir “sem permissão”, “card invisível” e inconsistência de cadastro.

Não corrija um problema de acesso alterando apenas a interface. Uma mutação precisa continuar protegida por `usuarioAtual`, `exigir` e validação da visibilidade/permissão no backend.

### Uma alteração não aparece ou parece ter sumido

- Verifique se o cartão tem conexão de rede e se a ação de salvar terminou.
- Abra Console/Network e procure falhas no endpoint Convex; `saveStorage()` registra erros de persistência.
- A sincronização periódica de menções evita substituir cards enquanto editores ou alterações locais pendentes estão ativos. Feche o editor e atualize após confirmar que o envio terminou.
- Se o card existe no navegador mas não no banco, confirme o retorno de `cards:persistirDoApp` e se o usuário tem permissão no quadro de destino.
- Compare a consulta `cards:listarPorQuadro`, o quadro do card e o escopo do usuário.
- Não limpe `localStorage` como primeira tentativa: ele pode conter dados locais ainda não sincronizados. Antes, confirme que os dados remotos foram salvos ou faça uma cópia controlada para investigação.

### O workflow do Convex falha

O fluxo [`.github/workflows/convex.yml`](./.github/workflows/convex.yml) executa checkout, Node 22, `npm ci`, valida o segredo de deploy, gera tipos, executa `npm test`, publica o backend e chama a seed. Leia o primeiro passo falho:

| Passo                   | Verificação                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Install dependencies    | `package.json` e `package-lock.json` estão sincronizados?                                                 |
| Check deploy credential | O secret `CONVEX_DEPLOY_KEY` está configurado no repositório correto?                                      |
| Generate Convex types   | Schema, funções e tipos gerados estão consistentes?                                                         |
| Run Convex tests        | Leia a asserção/teste que falhou; não desabilite a proteção para fazer deploy passar.                     |
| Deploy Convex backend   | A chave aponta para a implantação correta e tem permissão?                                                  |
| Seed                    | Organização, perfil, quadro e área referenciados existem na implantação inicializada? O e-mail é único? |

Nunca copie o valor do secret para logs, issues, documentação ou código. Se a chave foi exposta, revogue-a e gere outra no serviço Convex.

## Publicar uma alteração de código

1. Faça e revise a alteração localmente.
2. Rode `npm test` para os testes do Convex, quando Node.js 20 ou superior estiver instalado.
3. Rode `git diff --check` para detectar erros simples de formatação.
4. Envie a alteração para a branch `main`.
5. Acompanhe as ações **Deploy static content to Pages** e **Convex backend** até terminarem com sucesso.
6. Se a mudança exigir acesso ao Convex, confirme que o segredo `CONVEX_DEPLOY_KEY` existe nas configurações do repositório.

Para uma falha, abra **GitHub → Actions → execução correspondente → job → passo com erro** antes de alterar arquivos. Não publique credenciais secretas no repositório.

### Fluxo de trabalho sugerido no PowerShell

Execute os comandos a partir da pasta local do projeto. Revise os arquivos antes de adicioná-los ao commit; não use `git add .` sem verificar o que está no diretório.

```powershell
git status -sb
git diff --check
git diff
npm test
git add -- caminho\do\arquivo
git diff --cached --check
git diff --cached
git commit -m "Descreve a alteração"
git push origin main
```

Depois do push, abra as duas execuções em **Actions**:

- **Deploy static content to Pages**: publica o site estático.
- **Convex backend**: executa codegen/testes; se todos passarem, publica as funções Convex e executa a seed.

Um commit enviado não significa automaticamente que ambas as publicações foram concluídas. Aguarde as execuções e confirme a URL/estado dos deployments antes de informar que a alteração está disponível.

### Roteiro de verificação funcional após uma mudança

Adapte os itens à alteração; não use contas reais de usuários sem autorização.

- **Login:** entrar com conta de teste autorizada; testar e-mail não verificado e e-mail não autorizado sem conceder acesso indevido.
- **Permissões:** verificar usuário administrador, gestor e usuário comum em seus quadros permitidos; confirmar que chamadas não autorizadas continuam sendo recusadas no backend.
- **Cards:** criar, editar, abrir, mover, comentar, compartilhar e recarregar; confirmar que dados salvos persistem.
- **Ações:** concluir/reabrir ação; verificar a movimentação do card para “Concluídos” e “Em Andamento” quando cabível.
- **Limite de andamento:** testar tentativa de abrir um card “A Fazer” com espaço disponível e com o limite atingido.
- **Menções:** testar sugestão `@`, lista, contador, lista/grade e remoção somente nas condições de conclusão documentadas.
- **Layout:** testar desktop e viewport móvel, especialmente modal centralizado e rolagem dos painéis.
- **Publicação:** abrir raiz, `index.html` e `login.html`; testar em janela anônima após o deployment para evitar confundir cache/sessão antiga com versão nova.

Os testes automatizados do repositório concentram-se no backend Convex (`convex/acesso.test.ts`); os fluxos de interface e aparência exigem validação no navegador.

## Recuperação e rollback

### Publicação estática errada

1. Confirme qual commit foi publicado pela execução do workflow Pages.
2. Se o site da branch `main` estiver correto, execute novamente **Deploy static content to Pages** para republicar.
3. Se um commit introduziu uma regressão, identifique o commit no GitHub e crie um commit de reversão (`git revert <sha>`); rode verificações e envie a reversão normalmente.
4. Aguarde o deployment e valide as três URLs do Pages.

### Backend Convex com regressão

1. Pare de executar manualmente mutações repetidas enquanto investiga.
2. Confira logs da função Convex e a execução do workflow para identificar se falhou em teste, deploy ou seed.
3. Corrija o código em uma alteração revisável ou reverta o commit responsável com `git revert <sha>`.
4. Rode testes, publique a correção e valide login e consulta de sessão.
5. Se houver alteração indevida em dados, interrompa mudanças adicionais e solicite ao administrador responsável pela base Convex o procedimento de recuperação. Deploy de código não restaura automaticamente dados do banco.

Evite `git reset --hard`, force push, limpeza de banco ou reexecução indiscriminada de migrações/seeds. A seed existente é idempotente para estrutura inicial, novos usuários e status ativo, mas não substitui backup nem ferramenta de restauração.

## Cuidados de segurança e dados

- A chave publicável Clerk que aparece na página é destinada ao cliente; nunca publicar chaves secretas Clerk, deploy keys Convex, tokens de usuário, cookies ou cabeçalhos de autorização.
- O repositório e seus workflows podem ser públicos. Antes de publicar, revise `git diff`, arquivos staged e logs para impedir inclusão de dados pessoais, exportações de produção, `.env` ou credenciais.
- Use somente HTTPS para hospedar o site e mantenha a origem Clerk alinhada ao domínio usado pelos usuários.
- Confirme as regras de acesso em `convex/lib/acesso.ts` e nas funções de `convex/`; uma restrição visual não protege os dados.
- A função de seed atualiza `ativo` de cada usuário já cadastrado para o valor correspondente em `seedData.ts`. Um valor incorreto na lista pode ativar ou desativar acesso na próxima publicação.
- Não adicione informações sensíveis de saúde ou dados pessoais em exemplos, logs, screenshots ou testes versionados.
- Acesso administrativo do perfil `ADMIN` inclui a exceção que permite visualizar cards restritos da organização. Mudanças nessa regra precisam de avaliação de privacidade/LGPD e teste explícito.

## Checklist rápido para quem dá suporte

Ao receber uma ocorrência, registre sem coletar segredo:

1. URL completa usada (raiz, `index.html` ou `login.html`).
2. Horário aproximado e navegador/dispositivo.
3. Etapa onde parou: página 404, tela Clerk, “Verificando acesso”, quadro ou salvamento.
4. Mensagem de erro exibida e código HTTP; remova e-mail/dados pessoais desnecessários.
5. Se ocorre para mais de uma pessoa ou para uma conta específica.
6. SHA do commit publicado e link/estado da execução Pages/Convex.
7. Console/Network sanitizado, sem cookies, tokens ou conteúdo confidencial.

Classifique primeiro a camada:

| Sintoma                                   | Camada inicial a investigar                                |
| ----------------------------------------- | ---------------------------------------------------------- |
| GitHub mostra 404 antes de carregar o app | Repositório/Pages/artefato/URL                            |
| Página abre sem estilo ou scripts        | Arquivos e caminhos do site/cache do browser               |
| Clerk não carrega                        | Instância, domínio, script e rede                        |
| Clerk autentica, mas Convex recusa        | JWT, `auth.config.ts`, claim/e-mail/usuário             |
| Consulta retorna sem acesso/permissão    | Cadastro, perfil, escopo, organização ou visibilidade    |
| Dados não persistem                      | Mutação Convex, permissão, logs e conexão              |
| Interface fica defasada após edição    | fila de persistência, snapshot e atualização periódica |

Resolva o primeiro erro da cadeia e repita o teste; erros posteriores podem ser apenas consequência do primeiro.
