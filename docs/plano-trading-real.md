# Estrutura para negociação real

## Objetivo e estado atual

Adicionar negociação real Polymarket e depósito por PIX, mantendo o Paper Trading como modo separado. O saldo virtual, posições, histórico, Copy Trading e comissões simuladas não são dinheiro, não migram e não financiam operações reais. As capabilities atuais bloqueiam abertura e fechamento de posições reais e entrada ou saída fiat até que cada integração esteja pronta e a elegibilidade seja validada.

## Carteira: integrada

O usuário escolheu iniciar com **carteira integrada**. A escolha do provedor continua pendente e será baseada em compatibilidade com a Polymarket, custos, segurança, recuperação e portabilidade.

| Critério | Carteira externa | Carteira integrada |
| --- | --- | --- |
| Experiência | Usuário conecta e confirma na carteira; exige familiaridade e aplicativo ou extensão. | Entrada por conta do site; experiência mais simples conforme o provedor. |
| Segurança e recuperação | Usuário administra a carteira e a recuperação; o site não guarda chaves. | Depende do modelo de MPC/custódia e dos procedimentos de recuperação do provedor. |
| Dependência | Depende da carteira escolhida e de compatibilidade de assinatura e rede. | Depende do provedor, disponibilidade, regras de saída e portabilidade. |
| Custos | Rede e eventuais serviços; confirmar caso a caso. | Cotar por usuário, assinatura, transação, recuperação e serviços adicionais. |

Implementar primeiro apenas a modalidade integrada. Validar o tipo de carteira aceito pela versão atual do CLOB e os fluxos de assinatura. Chaves privadas dos usuários não devem ser armazenadas no servidor nem em tabelas da aplicação; credenciais administrativas do provedor devem permanecer em um gerenciador de segredos.

## Fases de implementação

1. **Fundação:** comparar provedores de carteira integrada, incluindo custos, MFA, recuperação, portabilidade, compatibilidade com Polygon e assinatura Polymarket; registrar a escolha antes da integração. Documentar autenticação, disponibilidade geográfica e condições de uso. A consulta de capacidades deve validar no servidor cada ação com dados confiáveis; trading e fiat permanecem desabilitados por padrão.
2. **Carteira:** vincular endereço individual com prova de controle e proteção contra replay; mostrar rede e saldo reais confirmados pela fonte. Tratar troca de carteira, rede e recuperação.
3. **Ordens reais:** criar adaptador próprio para a versão vigente da Polymarket. Buscar livro e limites, apresentar prévia com taxas e spread, obter assinatura explícita e incluir Builder Code antes de assinar. Registrar idempotência e estados; reconciliar ordens, execuções parciais, cancelamentos, posições e resolução a partir das fontes oficiais. Um timeout nunca equivale a rejeição ou execução confirmada.
4. **Depósito opcional:** integrar Pods somente após habilitação e confirmação dos corredores, taxas, identidade e destino aceitos. Gerar cotação PIX com prazo, valor líquido e instruções; conferir pagamento e entrega do USDC por eventos autenticados e conciliação independente. Obter endereço individual e consultar ativos/mínimos da Bridge; acompanhar a conversão até crédito de pUSD confirmado. Em caso de falha, informar o estado e preservar rastreabilidade; não reenviar pagamentos ou ordens automaticamente.
5. **Experiência:** diferenciar carteira e histórico reais dos simulados. Após depósito, atualizar preço e pedir nova confirmação para comprar; venda e saque devem ter fluxos explícitos e estados próprios. Regras de indicação e Copy Trading existentes continuam virtuais até haver projeto próprio para valores reais.
6. **Operação:** monitorar cotações expiradas, webhooks duplicados ou atrasados, depósitos sem crédito, ordens incertas e divergências; definir atendimento, reversão quando aplicável e procedimento de incidentes. Creditar apenas após confirmação autoritativa.

## Testes e liberação

- Testar em ambiente isolado com provedores simulados, relógio controlado e respostas contratuais: assinaturas, rejeições, execução parcial, falhas de rede, concorrência, duplicidade, reconciliação, expiração e reset. Não usar endpoints de produção como se fossem sandbox.
- Conforme informado pelo usuário, a Pods ainda não oferece sandbox para este fluxo. Confirmar com a Pods o ambiente, as capacidades e uma modalidade de teste autorizada; sem isso, testes de ponta a ponta de PIX e conversão permanecem pendentes.
- Fazer testes reais somente em contexto elegível e autorizado, com conta e limite financeiro específicos, após verificar manualmente todas as etapas, observabilidade e recuperação. O valor máximo e responsável pelo teste devem ser definidos antes da operação.
- Manter flags desligadas para os demais usuários até comprovar permissões por ação, segurança, conciliação e disponibilidade do parceiro. A localização e outras exigências devem seguir os critérios atuais do provedor e da Polymarket.

## Referências

- [Primeira ordem na Polymarket](https://docs.polymarket.com/trading/quickstart)
- [Bridge e depósito](https://docs.polymarket.com/trading/bridge/deposit)
- [Restrições geográficas](https://docs.polymarket.com/api-reference/geoblock)
- [Documentação Pods](https://docs.pods.finance/)
