# Fase 14A — Confiabilidade e usabilidade

## Escopo implementado

1. Manutenção rápida continua exigindo apenas modelo e defeito. Nome e telefone são opcionais; telefone informado é validado. A estrutura mantém cliente obrigatório no banco, com cliente exclusivo sem telefone por OS quando necessário.
2. Criação rápida e completa usam `create_maintenance_intake`: cliente, aparelho, OS e evento são gravados na mesma transação. O código não recorre a inserts separados quando a RPC está ausente.
3. Um UUID de tentativa é gerado no servidor e preservado no formulário após erros. A RPC serializa a criação por organização e retorna a OS existente no reenvio do mesmo identificador. O UUID fica em `maintenance_orders.intake_request_id`, com índice único por organização.
4. Nova manutenção oferece Cliente existente / Novo cliente. A alternância mantém os campos da OS montados. O cliente novo é criado junto com a OS; telefone já existente reaproveita o cadastro ativo sem sobrescrever nome.
5. WhatsApp abre uma janela durante a ação do usuário, prepara a mensagem e direciona essa janela. A mesma mensagem pode ser aberta novamente. Há link alternativo, cópia e seleção manual do texto se o clipboard falhar. Bloqueio ou fechamento da janela gera orientação.
6. Prévia personalizada e envio compartilham o mesmo gerador de variáveis com dados reais da OS e da organização. Datas de calendário são formatadas sem deslocamento de fuso.
7. Dashboard apresenta indisponibilidade por bloco afetado. Não renderiza os números substitutos de uma consulta com erro. Reposição com erro não renderiza totais nem lista copiável.
8. Garantia mensal mantém o dia quando possível; caso contrário usa o último dia do mês de destino, incluindo ano bissexto.
9. Vendas possuem edição em `/saidas/[id]/editar`, acessível nos cards e na tabela. Quantidade, preço, cliente, observação, modelo e data podem ser corrigidos. O total é mostrado antes de salvar e recalculado no servidor. Preços decimais vindos do banco mantêm os centavos.

## Banco e publicação

Aplicar todas as migrations anteriores e, em ordem:

- `0009_allow_customers_without_phone.sql`, se ainda estiver pendente.
- `0010_atomic_maintenance_intake.sql`.

A nova migration mantém os dados existentes, adiciona uma coluna de tentativa e seu índice, permite telefones nulos e cria a RPC transacional. Usa `security invoker`, verifica autenticação e participação na organização e deriva o criador de `auth.uid()`. Mantém as policies existentes. Execução da nova função é concedida a `authenticated`, não a `anon`/PUBLIC.

A migration NÃO foi aplicada ao Supabase nesta execução. O schema remoto não foi consultado. O envio/publicação de código não substitui aplicação de SQL.

Verificação somente de leitura após aplicar:

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'customers'
  and column_name in ('phone', 'phone_normalized');

select to_regprocedure('public.create_maintenance_intake(uuid,uuid,uuid,text,text,jsonb,boolean)');
```

Resultado esperado: ambos os telefones permitem NULL e a função é encontrada.

## Limites da proteção contra duplicação

A mesma tentativa retorna a primeira OS confirmada, mesmo se a resposta anterior tiver sido perdida. Uma falha SQL dentro da RPC desfaz também cliente/aparelho/evento criados nessa transação. Cadastros anteriores permanecem intactos.

A proteção usa o identificador do formulário: abrir outro formulário ou recarregar a página inicia outra tentativa. Não é uma detecção geral de atendimentos semelhantes. Se perder a página após um envio incerto, conferir a listagem antes de abrir outro atendimento.

## Testes automatizados executados

Comando: `pnpm --filter web test:14a`.

Dez testes agrupados cobrem: schemas dos modos de cliente; actions rápidas e completas; envio de UUID e organização confiável à RPC; orientação sobre migration ausente; WhatsApp com/sem telefone; reabertura e bloqueio simulado; variáveis reais da prévia; calendário mensal; dashboard vazio versus falha com verificação do HTML; reposição sem lista em erro; edição de venda e cálculo de centavos.

As fronteiras de Supabase, navegador e sessão são simuladas. Esses testes NÃO comprovam execução da migration, rollback e concorrência em PostgreSQL, abertura no WhatsApp real nem comportamento visual dos formulários. Logs com `SIMULATED_FAILURE` e `PGRST202` durante os testes são falhas intencionais.

Verificações executadas: `pnpm lint`, `pnpm typecheck`, `pnpm build` — aprovadas.

## Roteiro obrigatório no ambiente de teste

| Nº | Ação | Resultado esperado |
|---|---|---|
| 1 | Rápida com Samsung A14 e Não carrega | Uma OS, cliente sem telefone, aparelho e evento; abre detalhe |
| 2 | Rápida com João e sem telefone | Nome preservado, telefone nulo, WhatsApp bloqueado |
| 3 | Rápida com telefone e sem nome | Reaproveita cliente ativo ou usa Cliente sem nome |
| 4 | Completa com cliente existente | Mantém vínculo correto e abre uma OS |
| 5 | Completa: preencher aparelho, alternar Novo cliente, informar nome e salvar | Dados da OS preservados; cliente e atendimento criados juntos |
| 6 | OS com telefone: abrir mensagem | WhatsApp abre e permite envio manual |
| 7 | OS sem telefone | Botões bloqueados e aviso para completar telefone |
| 8 | Abrir a mesma mensagem duas vezes, bloquear popups e testar cópia | Duas aberturas possíveis; alternativa e feedback funcionam |
| 9 | Selecionar mensagem personalizada | Prévia corresponde ao cliente, aparelho, loja, número e datas reais |
| 10 | Garantia 31/01/2026 + 1 mês e 31/08/2026 + 1 mês | 28/02/2026 e 30/09/2026 |
| 11 | Simular falha de consulta em ambiente isolado | Bloco indisponível; nenhum falso zero ou lista vazia copiável |
| 12 | Editar venda: 3 unidades a 25,50, modelo, cliente e observação | Total 76,50, mesmo registro atualizado e relatórios atualizados |

Complementos de confiabilidade: repetir requisição com o mesmo UUID; executar duas solicitações concorrentes; provocar falha na inserção do evento em banco descartável e confirmar rollback; confirmar que usuário de outra organização não acessa a OS. Não provocar falhas deliberadas no banco de produção.

## Pendências fora desta entrega

- Executar roteiro autenticado no Supabase após aplicar migrations; verificar RLS, rollback e concorrência.
- Validar desktop/celular, clipboard e WhatsApp real.
- Vinculação posterior de um cliente temporário a outro cliente existente.
- Edição transacional dos dados de uma OS já existente (esta fase torna transacional a criação).
- Paginação/aggregação completa de relatórios e listas; os limites anteriores continuam existentes.
- Identificação estruturada de clientes temporários e ajuste dos indicadores de clientes.
- Uniformização das regras de mensagens personalizadas de garantia com o botão operacional.
- Histórico do cliente, rascunhos e atalhos de atendimento.

## Passagem para Fase 14B — Deploy

Código implementado e verificações locais aprovadas. Pode iniciar preparação do deploy, mas a liberação do piloto depende de migrations aplicadas e aprovação do roteiro real. Não houve commit nem envio ao GitHub.

## Arquivos alterados

- `apps/web/package.json`
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/actions.ts`
- `apps/web/src/app/(dashboard)/manutencoes/customer-select.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/nova/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/rapida/page.tsx`
- `apps/web/src/app/(dashboard)/manutencoes/rapida/quick-maintenance-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/actions.ts`
- `apps/web/src/app/(dashboard)/mensagens/custom-whatsapp-message-form.tsx`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-button.tsx`
- `apps/web/src/app/(dashboard)/relatorios/reposicao/page.tsx`
- `apps/web/src/app/(dashboard)/saidas/actions.ts`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-form.tsx`
- `apps/web/src/app/(dashboard)/saidas/product-outflow-table.tsx`
- `apps/web/src/lib/dashboard/metrics.ts`
- `apps/web/src/lib/maintenance/warranty.ts`
- `apps/web/src/lib/products/format.ts`
- `apps/web/src/lib/validations/maintenance.schema.ts`

## Arquivos criados

- `supabase/migrations/0010_atomic_maintenance_intake.sql`
- `apps/web/src/lib/messages/order-variables.ts`
- `apps/web/src/app/(dashboard)/mensagens/whatsapp-controls.tsx`
- `apps/web/src/app/(dashboard)/saidas/[id]/editar/page.tsx`
- `apps/web/tests/fase-14a.test.cjs`
- `docs/planejamento/fase-14a-confiabilidade-usabilidade.md`
- `docs/planejamento/fase-14a-checklist.md`
