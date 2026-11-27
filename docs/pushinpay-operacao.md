# Operação e recuperação PIX Pushin Pay

## Acompanhamento da conciliação

O workflow `Conciliar PIX Pushin Pay` deve executar automaticamente na branch padrão e também aceita execução manual. Uma execução bem-sucedida confirma respostas HTTP aceitas, mas não comprova que havia operações para processar. Verifique o histórico do GitHub Actions, falhas consecutivas e o tempo desde o último disparo automático. O GitHub pode atrasar ou omitir disparos; o fluxo atual consulta no máximo quatro operações por execução e não substitui monitoramento da fila.

O agendamento `pushinpay-reconcile` do pg_cron deve permanecer desativado: a fila do pg_net pode expor cabeçalhos de autenticação. Não coloque o segredo de conciliação em URLs, logs ou chamados de pg_net.

## Resultado desconhecido

Uma operação `unknown` indica que a resposta do provedor não foi confirmada; não indica cancelamento. Não reenvie o PIX, não credite depósitos e não libere reservas de saque por presunção. Verifique se ainda existe uma requisição em andamento antes de qualquer medida.

Quando houver identificador externo já vinculado, solicite a conciliação e confira no painel da Pushin Pay o identificador, valor, direção e estado. O saldo só pode mudar após confirmação autenticada e aplicação idempotente no sistema.

Quando não houver identificador externo, procure a transação no painel da Pushin Pay usando evidências verificáveis, incluindo horário, valor, direção e dados de destino disponíveis ao operador. Valor e horário, isoladamente, não provam correspondência. Preserve a operação e a reserva até obter confirmação inequívoca do provedor. Atualmente não há interface implementada para vincular manualmente o identificador nem procedimento automático seguro para liberar uma reserva desconhecida.

## Preparação para validação

- Depósito: criar cobrança controlada, efetuar pagamento autorizado e verificar notificação, consulta autenticada, valor e crédito único, inclusive em caso de repetição.
- Saque: obter confirmação da Pushin Pay sobre a rota e os campos da consulta de transferência; testar estados e falhas antes de liberar pagamentos.
- Devolução e MED: obter os eventos e estados do provedor e definir o tratamento contábil antes de automatizar qualquer débito de saldo já creditado.
- Não habilitar os fluxos reais até que esses testes e a monitoração da conciliação estejam concluídos.
