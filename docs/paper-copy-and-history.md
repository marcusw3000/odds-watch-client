# Copy Trading e histórico do simulador

O Copy Trading usa exclusivamente a carteira virtual em USD. Compras e vendas são simuladas com o livro público da Polymarket; nenhuma ordem real é enviada.

- Uma venda tenta replicar a proporção da posição do trader de origem, limitada às shares ainda atribuídas à estratégia. O modo manual exige aprovação; no automático o processamento é feito pelo servidor.
- Para traders do simulador, a posição anterior é capturada na transação da venda. Para traders da Polymarket, ela é reconstruída a partir da posição pública e das atividades posteriores. Se os dados estiverem incompletos, houver movimentos não negociados relevantes ou não for possível estabelecer a ordem, a venda não é copiada; o motivo aparece no histórico.
- O preço aceito pode diferir até 3 centavos por share do preço de origem. Não há preenchimento parcial. O limite total contabiliza compras copiadas acumuladas na rodada e não é reabastecido por vendas. O reset pausa as estratégias e impede a execução de sinais antigos.
- O cron de cópia roda a cada minuto e processa estratégias e sinais em lotes. Um sinal recebido com mais de 15 minutos de atraso é ignorado; solicitações manuais expiram após uma hora. Atividade muito intensa ou falhas de API podem causar atrasos, visíveis no painel.

O histórico do portfólio armazena amostras horárias calculadas no servidor com cotações públicas, segregadas por usuário e rodada. O gráfico mostra o resultado **em aberto**; o resultado realizado verificado é exibido separadamente. O histórico não é retroativo. A coleta agendada verifica carteiras a cada cinco minutos em lotes, e o acesso ao portfólio também solicita uma amostra, sujeito ao intervalo mínimo de cinco minutos. Cotações ausentes não são substituídas por zero.

O ranking e os perfis da Polymarket usam a Data API pública. A paginação usa os cursores da fonte; o volume do ranking é mostrado em shares. Os maiores ganhos são posições encerradas, e não o lucro total do trader.
