# Orbita. — CRM de Vendas para Agência de Sites

Sistema completo de prospecção, leads, funil, vendas e faturamento, focado na meta de
**R$ 50.000/mês** (R$ 2.000/dia) com venda de sites.

Construído com **Next.js 14 + TypeScript + Tailwind CSS + Prisma 7 + NextAuth + Recharts + Zod**.

---

## 🚀 Como rodar localmente (SQLite, zero configuração)

```bash
npm install
npm run setup     # gera o cliente Prisma, cria o banco ZERADO com o admin master
npm run dev       # http://localhost:3000
```

> Sem internet para o `prisma db push`? Use `npm run setup:offline`
> (cria o banco a partir de `prisma/init.sql`, equivalente ao schema).

### Acesso inicial (administrador master)

| Perfil        | E-mail            | Senha    |
| ------------- | ----------------- | -------- |
| Administrador | admin@agencia.com | admin123 |

⚠️ **Importante:** este é o acesso padrão de instalação. Para personalizar,
defina no `.env` **antes** de rodar `npm run setup`:

```env
ADMIN_NAME="Seu Nome"
ADMIN_EMAIL="voce@suaempresa.com"
ADMIN_PASSWORD="uma-senha-forte"
```

Depois de entrar, vá em **Equipe e metas → ＋ Novo vendedor** para criar os
usuários da sua equipe, com metas individuais de cada um.

> Quer ver o sistema cheio de dados de exemplo antes? Rode `npm run setup:demo`
> (cria 3 vendedores fictícios, 70 leads, vendas etc. — senha dos vendedores: vendas123).

---

## 🗂 O que está incluído

- **Login real** (NextAuth + bcrypt), sessão JWT, rotas protegidas por middleware.
- **Dois perfis**: ADMIN vê tudo; SELLER vê apenas os próprios leads (regra aplicada no servidor).
- **Dashboard executivo**: 12 KPIs com comparação vs. período anterior, filtros
  (hoje/ontem/7 dias/mês/mês anterior/personalizado + vendedor), alertas inteligentes.
- **Barra da meta de R$ 50 mil**: percentual, restante, dias úteis, valor necessário/dia,
  projeção e cor pelo *ritmo esperado do mês* (vermelho/amarelo/verde/comemoração aos 100%).
- **Card da meta diária de R$ 2 mil** com mensagens dinâmicas.
- **Leads**: CRUD completo com todos os campos da spec, busca, filtros, exclusão lógica.
- **Funil Kanban** com 12 etapas e arrastar-e-soltar; mover para **Venda fechada** abre o
  formulário obrigatório de venda; mover para **Perdido** exige motivo; todo movimento gera histórico.
- **Contatos diários** (canal, tipo, resultado, próxima ação) com contagem automática.
- **Vendas e propostas**: valor total/entrada/recebido/pendente, parcelas, status de pagamento;
  critério de faturamento alternável (vendido × recebido).
- **Equipe (admin)**: CRUD de vendedores, metas individuais, bloqueio, 5 rankings com medalhas,
  status do fechamento diário e log de auditoria.
- **Minha rotina**: fechamento diário com números pré-calculados das atividades.
- **Relatórios**: financeiro, conversões (com as fórmulas da spec), por origem/serviço,
  leads perdidos; exportação **CSV/Excel** e **PDF** (impressão).
- **Gráficos**: faturamento acumulado (realizado × linha ideal), atividade diária,
  funil por etapa, origem, serviço, motivos de perda, faturamento por vendedor.
- **Modo claro/escuro**, layout responsivo, estados de carregamento/vazio/erro.
- **Auditoria** de logins, criações, edições, exclusões e mudanças de etapa.

## 🔐 Regras de permissão

- Vendedor nunca enxerga leads, contatos, propostas ou vendas de outro vendedor
  (filtrado em todas as queries do servidor, não apenas na interface).
- `/equipe` e `/relatorios` são exclusivas do administrador (middleware + verificação na página).
- Exclusões são lógicas (`deletedAt`) — nada some do banco.

---


---

## ☁️ Publicar na internet em 4 passos (Vercel + Neon — grátis)

Este pacote já está configurado para PostgreSQL. A cada deploy, o build cria/atualiza
as tabelas e garante o admin master automaticamente (`prisma db push` + seed idempotente).

1. **Banco:** crie uma conta em https://neon.tech → New Project → copie a
   *connection string* (começa com `postgresql://`).
2. **Código no GitHub:** instale o app **GitHub Desktop** (https://desktop.github.com),
   crie um repositório e arraste os arquivos desta pasta para ele → *Commit* → *Publish*.
3. **Vercel:** em https://vercel.com entre com o GitHub → *Add New → Project* →
   importe o repositório → em **Environment Variables** adicione:
   - `DATABASE_URL` = a connection string do Neon
   - `NEXTAUTH_SECRET` = um texto longo e aleatório (ex.: gere em https://generate-secret.vercel.app/32)
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` = seu acesso master
   → clique em **Deploy**.
4. **Endereço final:** após o deploy, adicione a variável `NEXTAUTH_URL` =
   `https://SEU-PROJETO.vercel.app` e faça *Redeploy*. Pronto: mande o link para a
   equipe e crie os vendedores em **Equipe e metas**.

## 🐘 Produção com PostgreSQL — detalhes

1. Crie um banco PostgreSQL (Supabase, Neon, Railway...).
2. Em `prisma/schema.prisma`, troque o provider:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
3. No `.env` (e nas variáveis da Vercel):
   ```env
   DATABASE_URL="postgresql://usuario:senha@host:5432/banco"
   NEXTAUTH_SECRET="gere-um-segredo-forte"
   NEXTAUTH_URL="https://seu-dominio.vercel.app"
   ```
4. Rode as migrações e o seed:
   ```bash
   npx prisma db push
   npm run db:seed   # opcional (dados demo)
   ```
5. Deploy na Vercel — o build já executa `prisma generate`.

O código detecta automaticamente o banco: `file:` usa o adapter SQLite
(better-sqlite3) e URLs `postgresql://` usam o adapter oficial `pg`.
Troque as senhas demo antes de usar em produção.

---

## 🧱 Estrutura

```
prisma/schema.prisma      # 11 modelos (User, Lead, Contact, Sale, Goal, AuditLog...)
prisma/seed.ts            # dados demonstrativos realistas
src/lib/                  # prisma, auth, métricas, datas, constantes
src/app/api/              # REST: leads, contatos, propostas, vendas, etapa, usuários...
src/app/(app)/            # dashboard, leads, funil, contatos, vendas, equipe, relatórios, rotina
src/components/           # cards, gráficos, formulários, kanban, tabelas
```

Bom fechamento! 🎯 *"Um site vendido por dia. R$ 50 mil por mês."*
