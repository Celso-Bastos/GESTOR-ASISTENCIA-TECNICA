# Seguranca e LGPD

## Dados pessoais

Nome e telefone de clientes sao dados pessoais. O MVP 1 deve coletar apenas o necessario para atendimento, evitar observacoes sensiveis e manter historico somente quando houver finalidade operacional clara.

## Consentimento de WhatsApp

O campo `customers.whatsapp_opt_in` registra se o cliente aceitou receber mensagens pelo WhatsApp. O campo `whatsapp_opt_in_at` registra quando esse aceite aconteceu. O tablet/quiosque deve apresentar texto claro de consentimento antes de marcar esse aceite.

Mensagens operacionais sao mensagens ligadas ao atendimento solicitado pelo cliente, como recebimento do aparelho, aviso de manutencao pronta, lembrete de retirada e entrega prevista. Mensagens promocionais divulgam ofertas, campanhas ou vendas futuras e exigem cuidado maior: devem ser usadas apenas com consentimento adequado e mecanismo de descadastro quando esse modulo existir.

## Variaveis e chaves

- Nunca commitar `.env`, `.env.local` ou chaves reais.
- `SUPABASE_SECRET_KEY` nao deve ser usada no frontend.
- A service role deve ficar apenas em ambiente seguro de servidor, scripts administrativos controlados ou funcoes backend.
- A chave anonima publica pode existir no frontend, mas deve depender de RLS e permissoes minimas.

## Tablet/quiosque

O tablet nao deve acessar diretamente o banco com credenciais privilegiadas. O fluxo correto e passar por uma rota backend ou funcao controlada que valide o token do quiosque, normalize o telefone, aplique regras de consentimento e grave apenas os dados permitidos. Isso reduz exposicao de chaves, evita alteracoes indevidas e facilita auditoria.

## Row Level Security

RLS e obrigatorio porque o banco guarda dados de clientes e de operacao por organizacao. As policies usam `organization_id` e a funcao `is_org_member(org_id)` para garantir que um usuario autenticado veja e altere apenas dados da propria organizacao.

Antes do piloto, validar manualmente:

- usuario de uma organizacao nao enxerga clientes de outra;
- usuario nao autenticado nao acessa tabelas protegidas;
- atualizacoes com `organization_id` diferente sao bloqueadas;
- tokens de quiosque nao aparecem no frontend publico.

## Operacao

No MVP 1, WhatsApp e manual: o sistema apenas prepara o texto e registra a abertura/envio manual quando aplicavel. Nao armazenar conversas completas sem necessidade. Permissoes por papel podem ser refinadas nas proximas fases, mas a primeira protecao deve ser isolamento por organizacao e RLS ativo.
