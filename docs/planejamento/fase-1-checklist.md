# Fase 1 - Checklist Supabase

Use este checklist para revisar e aplicar manualmente a base do MVP 1. Nao execute migrations automaticamente em producao sem revisao.

## Antes de aplicar

- [ ] Confirmar que o projeto Supabase correto esta selecionado.
- [ ] Confirmar que `.env.local` existe apenas localmente e nao foi commitado.
- [ ] Revisar `supabase/migrations/0001_initial_schema.sql`.
- [ ] Confirmar que nenhuma chave real, telefone real, token real ou dado sensivel aparece em arquivos versionados.
- [ ] Fazer backup ou snapshot se o projeto Supabase ja tiver dados importantes.

## Aplicar migration

- [ ] Abrir o SQL Editor do Supabase.
- [ ] Colar o conteudo de `supabase/migrations/0001_initial_schema.sql`.
- [ ] Executar a migration manualmente.
- [ ] Verificar se os enums foram criados.
- [ ] Verificar se as tabelas foram criadas em `public`.
- [ ] Verificar se RLS esta ativado em todas as tabelas da Fase 1.

## Aplicar seed

- [ ] Revisar `supabase/seed.sql`.
- [ ] Confirmar que ja existe pelo menos uma organizacao se quiser criar templates padrao automaticamente.
- [ ] Executar o seed apenas se fizer sentido para o ambiente.
- [ ] Conferir se `message_templates` recebeu os templates por organizacao.

## Testes manuais no SQL Editor

- [ ] Criar uma organizacao de teste sem dados reais.
- [ ] Criar um usuario via Supabase Auth para teste.
- [ ] Inserir um `profile` para o usuario de teste.
- [ ] Inserir um registro em `organization_members` vinculando usuario e organizacao.
- [ ] Inserir um cliente com telefone ficticio e `phone_normalized`.
- [ ] Inserir um aparelho vinculado ao cliente.
- [ ] Inserir uma ordem de manutencao vinculada ao cliente e aparelho.
- [ ] Inserir um evento de manutencao para a ordem.
- [ ] Inserir um token ficticio de quiosque, nunca um token real de producao.

## Validacoes de RLS

- [ ] Com usuario autenticado membro da organizacao, consultar clientes da propria organizacao.
- [ ] Com usuario autenticado membro da organizacao, inserir e atualizar clientes da propria organizacao.
- [ ] Com outro usuario que nao e membro, confirmar que os mesmos registros nao aparecem.
- [ ] Tentar inserir cliente com `organization_id` de outra organizacao e confirmar bloqueio.
- [ ] Tentar consultar `kiosk_tokens` sem ser membro e confirmar bloqueio.
- [ ] Testar acesso anonimo e confirmar que tabelas protegidas nao retornam dados.

## Alertas de seguranca

- [ ] Nao usar `service_role` no frontend.
- [ ] Nao expor `kiosk_tokens.token` em paginas publicas.
- [ ] Nao salvar conversas completas de WhatsApp sem finalidade clara.
- [ ] Nao usar mensagens promocionais sem consentimento adequado.
- [ ] Revisar policies sempre que adicionar telas, APIs ou funcoes backend.
