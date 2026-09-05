# Plano no Azul

Aplicativo de controle financeiro pessoal com cadastro próprio e dados separados por usuário.

## Recursos

- receitas e despesas manuais;
- importação de extratos CSV e OFX;
- contas, dívidas e compras parceladas;
- cartões virtuais com limite e estimativa da fatura;
- metas financeiras;
- controle de ganhos e custos da 99 Motorista;
- cadastro e login por e-mail e senha;
- proteção dos dados com Row Level Security do Supabase.

## Configuração do Supabase

1. Abra o **SQL Editor** do seu projeto Supabase.
2. Execute todo o conteúdo de `supabase/schema.sql`.
3. Em **Authentication > Providers > Email**, mantenha o provedor de e-mail ativado.
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública do projeto.

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
```

Nunca coloque a senha do banco, uma chave `secret` ou `service_role` no projeto.

## Executar no computador

```bash
npm install
npm run dev
```

## Publicar na Vercel

1. Importe este repositório na Vercel.
2. Cadastre as duas variáveis de ambiente mostradas acima.
3. Clique em **Deploy**.

O projeto usa Next.js e o comando de produção é `npm run build`.
