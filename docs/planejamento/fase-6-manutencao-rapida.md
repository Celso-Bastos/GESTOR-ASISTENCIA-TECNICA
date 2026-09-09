# Fase 6 - Manutencao Rapida

## Objetivo

Implementar um fluxo curto para abrir uma ordem de servico no balcao com poucos campos, sem passar pela selecao manual de cliente e pelo formulario completo da Fase 5.

## Rota

- `/manutencoes/rapida`: formulario protegido para criar uma OS rapida.

Usuario sem login e redirecionado para `/login`. Usuario logado sem organizacao e redirecionado para `/onboarding/organizacao`.

## Manutencao Completa x Rapida

A manutencao completa em `/manutencoes/nova` continua exigindo selecionar um cliente existente e permite preencher mais dados do aparelho.

A manutencao rapida em `/manutencoes/rapida` exige apenas:

- modelo do aparelho;
- defeito informado.

Campos opcionais:

- nome do cliente;
- telefone/WhatsApp;
- previsao de entrega;
- observacao rapida.

A OS criada pelo fluxo rapido pode ser completada depois em `/manutencoes/[id]/editar`, incluindo nome e telefone do cliente vinculado.

## Fluxo de Criacao

1. A equipe acessa `/manutencoes/rapida`.
2. Preenche modelo e defeito; nome, telefone, previsao e observacao sao opcionais.
3. A action valida os dados com Zod.
4. Se telefone for informado, o sistema normaliza com `normalizePhoneBR`.
5. Se telefone for informado, o sistema procura cliente ativo por `organization_id + phone_normalized`.
6. Se existir cliente ativo, ele e reaproveitado sem alterar `source` nem sobrescrever nome.
7. Se nao existir cliente ativo, o sistema cria um cliente com `source = manual` e `whatsapp_opt_in = false`.
8. Se nao houver telefone, o sistema cria um cliente especifico para aquela OS, sem telefone falso.
9. O sistema cria `devices`.
10. O sistema cria `maintenance_orders` com status inicial `recebido`.
11. O sistema cria `maintenance_events` com `event_type = created`.
12. A tela redireciona para `/manutencoes/[id]`.

## Cliente Existente

O telefone normalizado e o identificador operacional principal quando informado. Quando ja existe cliente ativo com o mesmo telefone na organizacao atual, o fluxo rapido usa esse cliente.

Se o nome digitado for diferente do nome ja salvo, o cadastro existente e preservado. A decisao evita sobrescrever dados importantes durante atendimento rapido.

## Cliente Novo ou Ausente

Quando o telefone ainda nao existe, o cliente e criado com:

- `organization_id` da sessao;
- `name` informado ou `Cliente sem nome` quando so houver telefone;
- `phone` informado ou `null`;
- `phone_normalized` normalizado ou `null`;
- `whatsapp_opt_in = false`;
- `whatsapp_opt_in_at = null`;
- `source = manual`;
- `notes = null`, exceto quando nenhum dado de cliente foi informado.

Quando nome e telefone nao sao informados, o sistema cria um cliente placeholder exclusivo para a OS:

- `name = Cliente nao informado`;
- `phone = null`;
- `phone_normalized = null`;
- `notes = Cliente criado automaticamente pelo fluxo de manutencao rapida sem dados informados.`

Nao usar telefone falso como `00000000000`. Clientes sem telefone podem existir mais de uma vez; clientes com telefone continuam sem duplicidade por organizacao.

## WhatsApp

WhatsApp manual depende de telefone informado. Quando a OS nao tem telefone, os botoes ficam bloqueados e a interface orienta a equipe a informar um telefone do cliente.

## Seguranca

- A action exige autenticacao e organizacao atual.
- `organization_id` nunca vem do formulario.
- `customer_id` nao e aceito no formulario rapido.
- A busca e a criacao usam apenas dados da organizacao atual.
- RLS segue protegendo `customers`, `devices`, `maintenance_orders` e `maintenance_events`.
- `SUPABASE_SECRET_KEY` nao e usada em componentes client-side.
- Erros tecnicos sao logados no servidor com `console.error`, sem expor chaves ou variaveis de ambiente.

## Banco e publicacao

As migrations do projeto exigem cliente em `devices` e `maintenance_orders`,
por isso o fluxo cria um cliente exclusivo por OS quando faltam os dados.
Aplicar `supabase/migrations/0009_allow_customers_without_phone.sql` no Supabase
antes de usar o fluxo sem telefone. O SQL permite telefone nulo, preserva os
dados existentes e mantem a unicidade de telefones preenchidos por organizacao.
Enviar o codigo ao GitHub nao aplica essa migration automaticamente.

Vincular a OS a outro cliente existente fica como melhoria futura; por enquanto,
e possivel completar o cliente vinculado pela edicao da OS. Se o telefone ja
pertencer a outro cliente ativo, a edicao informa a duplicidade.

## Roteiro de validacao

1. Criar OS rapida somente com modelo e defeito.
2. Criar OS rapida com nome e sem telefone.
3. Criar OS rapida com telefone e sem nome.
4. Criar OS rapida com nome e telefone ja existente e confirmar reaproveitamento.
5. Abrir detalhe de OS sem telefone e confirmar que WhatsApp nao quebra.
6. Editar a OS e completar nome/telefone do cliente.
