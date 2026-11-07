# Manutenção da cache Polymarket

O job `sync-polymarket-catalog` está pausado para evitar que a cache cresça durante a manutenção. A retomada deve ocorrer somente depois de validar o espaço e publicar a versão que não armazena cópias brutas completas; caso contrário, o catálogo pode voltar a lotar o disco.

Os arquivos locais ignorados pelo Git abaixo são backups somente das caches públicas. Eles não são backups de contas, posições, favoritos ou dados financeiros:

- `polymarket-market-cache-final-20261106.sql.gz.local`: 206.083 mercados, SHA-256 `8a4836928249b8b6d287643270cf56018f2be6e398d3b2b69f6f5fc7a432b1f8`.
- `polymarket-event-cache-final-20261106.sql.gz.local`: 6.040 eventos, SHA-256 `8412fd14da6516d349fb7cc06cae43a50537eb90c1bc188c086adc789593aed5`.

Uma cópia anterior dos dois arquivos foi restaurada integralmente em PostgreSQL 17 descartável, incluindo as referências entre eventos e mercados. A cópia definitiva também deve ser restaurada e contada antes de qualquer operação destrutiva. Verifique o job, o lease, as contagens e os mercados com posições ou favoritos novamente antes da limpeza.

O ensaio no banco descartável mostrou que excluir 113.461 mercados e executar `VACUUM` comum não reduziu o tamanho físico da tabela. Uma alternativa em avaliação é esvaziar temporariamente **apenas** `polymarket_market_cache` e restaurar cerca de metade dos mercados ativos, priorizando maior volume e preservando qualquer mercado com favorito ou posição. O subconjunto mantém os campos normalizados usados no catálogo e não conserva a cópia bruta de cada resposta Gamma. O catálogo ficará temporariamente vazio ou parcial durante a restauração. Em caso de falha, o backup integral deve ser restaurado antes de retomar o job.

Em 06/11/2026, o procedimento foi autorizado e executado no projeto `tztqsorbugjhwljbiano`. A restauração confirmou 88.839 mercados, 6.040 eventos preservados e nenhum mercado vinculado a favorito ou posição ausente. O tamanho informado por `pg_total_relation_size` para a cache de mercados passou para 197 MB; `pg_database_size` indicou 245 MB. Estes números não medem o uso total do disco, que também inclui WAL e outros arquivos. O cron permaneceu pausado e a configuração de transação consultada ainda indicava somente leitura após a operação. Não reativar o cron sem verificar o uso de disco e publicar a versão compacta da sincronização.

Correção da verificação: uma consulta posterior sem o parâmetro `--read-only` da CLI retornou `default_transaction_read_only=off`, e as migrations foram aplicadas normalmente. O parâmetro da CLI havia imposto o modo somente leitura à consulta anterior. O agendamento limitado `check-polymarket-closures` foi ativado separadamente e confirmou resposta HTTP 200; a sincronização completa do catálogo continua pausada.

As tabelas de usuários, carteiras, favoritos, posições, operações, eventos e comentários não devem ser truncadas. Não executar `VACUUM FULL` no banco de produção com o disco em 98%: a operação precisa de espaço adicional. O modo de manutenção não deve ser substituído por uma liberação permanente da proteção somente leitura.
