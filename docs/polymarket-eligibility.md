# Elegibilidade Polymarket

`get-polymarket-capabilities` é uma função autenticada que retorna as
capabilities da conta para o domínio Polymarket. Neste estágio, ela é
intencionalmente somente leitura: `canView` é verdadeiro e trading/fiat são
sempre falsos.

A função falha fechada porque ainda não existe uma integração de IP confiável
do usuário. Uma chamada feita da Edge Function ao endpoint de geoblock avaliaria
o IP da infraestrutura, e não necessariamente o IP do usuário. Antes de criar
qualquer endpoint de ordem, a implementação deve receber o endereço do cliente
de uma infraestrutura confiável, consultar o geoblock no contexto correto,
registrar uma evidência de elegibilidade com expiração e repetir a validação no
servidor para cada ação de trading ou fiat.

Nenhuma UI, endpoint ou função de trading deve interpretar uma conta autenticada
como conta elegível. Trading e fiat permanecem desligados até essa política e as
aprovações comerciais/jurídicas serem concluídas.
