# Fase 6 - Manutenção Rápida

## Objetivo

Implementar um fluxo curto para abrir uma ordem de serviço no balcão com poucos campos, sem passar pela seleção manual de cliente e pelo formulário completo da Fase 5.

## Rota Criada

- `/manutencoes/rapida`: formulário protegido para criar uma OS rápida.

Usuário sem login é redirecionado para `/login`. Usuário logado sem organização é redirecionado para `/onboarding/organizacao`.

## Manutenção Completa x Rápida

A manutenção completa em `/manutencoes/nova` exige selecionar um cliente existente e permite preencher mais dados do aparelho.

A manutenção rápida em `/manutencoes/rapida` recebe apenas:

- nome do cliente;
- telefone/WhatsApp;
- modelo do aparelho;
- defeito informado;
- previsão de entrega opcional;
- observação rápida opcional.

A OS criada pelo fluxo rápido pode ser completada depois em `/manutencoes/[id]/editar`.

## Fluxo de Criação

1. A equipe acessa `/manutencoes/rapida`.
2. Preenche nome, telefone, modelo e defeito.
3. A action valida os dados com Zod.
4. O telefone é normalizado com `normalizePhoneBR`.
5. O sistema procura cliente ativo por `organization_id + phone_normalized`.
6. Se existir cliente ativo, ele é reaproveitado sem alterar `source` nem sobrescrever nome.
7. Se não existir, o sistema cria cliente com `source = manual` e `whatsapp_opt_in = false`.
8. O sistema cria `devices`.
9. O sistema cria `maintenance_orders` com status inicial `recebido`.
10. O sistema cria `maintenance_events` com `event_type = created`.
11. A tela redireciona para `/manutencoes/[id]`.

## Cliente Existente

O telefone normalizado é o identificador operacional principal. Quando já existe cliente ativo com o mesmo telefone na organização atual, o fluxo rápido usa esse cliente.

Se o nome digitado for diferente do nome já salvo, o cadastro existente é preservado. A decisão evita sobrescrever dados importantes durante atendimento rápido.

## Cliente Novo

Quando o telefone ainda não existe, o cliente é criado com:

- `organization_id` da sessão;
- `name` informado;
- `phone` informado;
- `phone_normalized`;
- `whatsapp_opt_in = false`;
- `whatsapp_opt_in_at = null`;
- `source = manual`;
- `notes = null`.

## Segurança

- A action exige autenticação e organização atual.
- `organization_id` nunca vem do formulário.
- `customer_id` não é aceito no formulário rápido.
- A busca e a criação usam apenas dados da organização atual.
- RLS segue protegendo `customers`, `devices`, `maintenance_orders` e `maintenance_events`.
- `SUPABASE_SECRET_KEY` não é usada em componentes client-side.
- Erros técnicos são logados no servidor com `console.error`, sem expor chaves ou variáveis de ambiente.

## Testes Manuais

1. Entrar no sistema com usuário autenticado.
2. Abrir `/manutencoes/rapida`.
3. Enviar sem campos obrigatórios e confirmar validação.
4. Criar OS com telefone novo e confirmar criação de cliente, aparelho, OS e evento.
5. Criar outra OS com o mesmo telefone e confirmar que o cliente foi reaproveitado.
6. Confirmar redirecionamento para `/manutencoes/[id]`.
7. Confirmar que a OS aparece em `/manutencoes`.
8. Editar a OS e completar os dados faltantes.
