

# Chat Global em Tempo Real (Sem Banco de Dados)

## Resumo

Chat global opcional acessivel por um botao flutuante na lateral direita. Usa Supabase Realtime Broadcast (sem persistencia em banco). Mensagens resetam a cada hora. Apenas texto e emojis. Exibe display_name do usuario. Opcao de reportar mensagens.

## Arquitetura

**Supabase Realtime Broadcast** -- canal `global-chat` com eventos `new-message`. Cada cliente envia e recebe mensagens via broadcast, sem INSERT em tabela. Mensagens ficam apenas em memoria (state local). Um `setInterval` a cada hora limpa o array local.

```text
[User A] --broadcast--> Supabase Realtime Channel <--broadcast-- [User B]
                              (no DB)
```

## Arquivos

### 1. Novo: `src/components/chat/GlobalChat.tsx`
- Botao flutuante fixo na lateral direita (icone `MessageCircle`)
- Ao clicar, abre painel lateral (sheet/drawer) com o chat
- Exibe badge com contagem de mensagens nao lidas quando fechado
- Somente usuarios logados podem enviar (visitantes veem botao desabilitado ou msg "faca login")

### 2. Novo: `src/components/chat/ChatMessage.tsx`
- Componente de mensagem individual
- Exibe: display_name, horario, conteudo (texto + emojis)
- Botao de reportar (icone `Flag`) que abre dialog de confirmacao
- Mensagens proprias alinhadas a direita, dos outros a esquerda

### 3. Novo: `src/components/chat/ChatInput.tsx`
- Input de texto com botao de envio
- Emoji picker (usando um picker leve ou emojis nativos do teclado)
- Sem upload de imagem/gif
- Enter para enviar, Shift+Enter para nova linha
- Rate limit local: max 1 msg a cada 2 segundos

### 4. Novo: `src/hooks/useGlobalChat.ts`
- Conecta ao canal Realtime `global-chat` via `supabase.channel('global-chat')`
- `channel.on('broadcast', { event: 'new-message' }, callback)` para receber
- `channel.send({ type: 'broadcast', event: 'new-message', payload })` para enviar
- State local: `messages[]` com `{ id, user_id, display_name, content, timestamp }`
- `setInterval` que limpa mensagens com mais de 1 hora
- Report: envia broadcast `report-message` (ou apenas toast local confirmando)

### 5. Editar: `src/components/layout/Layout.tsx`
- Adicionar `<GlobalChat />` como ultimo filho do container, ao lado do `<BottomNav />`

## Detalhes de UX

- Botao flutuante: `fixed bottom-20 right-4 z-40` (acima do BottomNav mobile)
- Painel: `Sheet` do shadcn abrindo pela direita, largura ~380px
- Auto-scroll para ultima mensagem
- Indicador "X novas mensagens" quando scroll nao esta no final
- Mobile: sheet ocupa largura total

## Sem Migracoes SQL

Nenhuma tabela ou RLS necessaria -- tudo via Broadcast efemero.

