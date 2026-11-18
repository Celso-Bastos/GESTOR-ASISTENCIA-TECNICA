# Valor estimado na rápida e valor final na entrega

`maintenance_orders.estimated_price` e `final_price` já são `numeric(10,2)` na
migration `0001`. O status técnico de Entregue é `entregue`. Não é necessária
migration nem alteração nas assinaturas de `create_maintenance_intake` ou
`create_maintenance_order`: o input existente já transporta o estimado.

## Entrada monetária

O formulário rápido inclui `Valor estimado (opcional)` depois do defeito, com o
mesmo input numérico da manutenção completa (`inputMode=decimal`, mínimo zero,
passo de 0,01). Não há biblioteca ou segunda máscara monetária.

Os schemas compartilham `optionalMoney`: espaços/vazio tornam-se ausência; a
persistência transforma ausência em SQL NULL. Aceita decimal com ponto ou
vírgula (`150.25`, `150,25`) e agrupamento brasileiro com vírgula decimal
(`1.234,56`). Texto inválido, NaN, infinito, negativo, notação científica ou
hexadecimal e strings com mais de duas casas decimais são rejeitados. Limite:
99.999.999,99. O input HTML numérico usa a notação normalizada pelo navegador,
sem separadores de milhares; o servidor também valida independentemente da UI.

Criação rápida ou completa salva o estimado e deixa o final nulo. Cliente
continua opcional na rápida. Nenhuma ação de criação copia o preço para o final.

## Regra de entrega

`resolveMaintenanceFinalPrice` centraliza a regra, chamada pela edição normal
e pela função compartilhada do seletor de status e do botão Marcar como entregue.

- Resultado `entregue`, final ausente e estimado presente: copiar estimado.
- Final preenchido, inclusive `0`: manter final.
- Ambos ausentes: manter NULL e permitir entrega.
- Outros status: não copiar.
- Estimado alterado depois de entregar: não recalcular final já preenchido.

Na edição, campo de preço omitido conserva o valor atual. Campo enviado vazio
representa remoção; se o resultado continuar entregue e houver estimado, o final
vazio recebe esse estimado. A regra usa os valores resultantes da edição, não
apenas os preços anteriores. Não exige passagem por status intermediários.

O UPDATE automático confere o final lido antes da gravação. Nos atalhos também
confere o status e estimado lidos; uma alteração concorrente impede a gravação,
sem sobrescrever o final definido pela outra sessão. Atualize a página e tente
novamente. Os filtros de organização, exclusão lógica, autenticação e RLS são
preservados. A edição continua com a arquitetura existente de gravações de
cliente/aparelho/OS/histórico; esta alteração não cria uma nova transação geral.

Repetir a entrega não duplica histórico se nada mudar. Uma OS legada entregue,
com final nulo e estimado presente, pode ser completada pelo servidor sem trocar
sua data de entrega existente.

O dashboard já soma `final_price` das OS entregues por período de `delivered_at`.
O preço copiado passa a ser considerado nessa soma; não há nova movimentação
financeira nem soma adicional. Dashboard e suas fórmulas não foram alterados.

## Validação

```sh
pnpm --filter web test:maintenance-pricing
pnpm --filter web test:14a
pnpm test:sql:maintenance
pnpm lint
pnpm typecheck
pnpm build
```

A suíte SQL usa PGlite externo por `PGLITE_TEST_MODULE` ou a dependência local,
sem conexão remota. A criação com estimado nulo, zero e decimal é exercitada
na RPC real, para ambos os modos. As actions reais são testadas com fronteiras
externas simuladas, incluindo concorrência e rejeição de outra organização.

Homologação: criar uma rápida sem nome/telefone com estimado 150, conferir final
nulo e depois entregar pelo atalho; esperar final 150. Repetir pela edição e pelo
seletor de status. Conferir final explícito 130, final zero, ambos vazios e entrega
direta a partir de Recebido. Alterar estimado para 170 em OS entregue com final
150 e conferir preservação. Repetir na manutenção completa, verificar garantia,
histórico e a receita já existente do dashboard, sem duplicação.
