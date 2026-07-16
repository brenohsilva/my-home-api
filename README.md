# Minha Morada API

Backend do **Minha Morada**, sistema para acompanhar imóveis comprados na planta: dados do imóvel, financiamento, pagamentos, despesas, evolução da obra, taxa de obra e índices de reajuste.

## Stack

- Node.js 22
- NestJS 11 e TypeScript 5
- PostgreSQL 17
- Prisma ORM 6
- JWT + Passport e bcrypt
- Swagger/OpenAPI
- Jest, ESLint e Prettier
- Docker e Docker Compose

As versões exatas estão fixadas em `package.json` e `package-lock.json`. O Prisma 6 foi mantido por ser uma linha estável e madura, compatível com o client baseado em engine e com Node.js 22; uma migração futura para Prisma 7 deve seguir o guia de breaking changes da ferramenta.

## Requisitos

Para execução local:

- Node.js 22+
- npm 10+
- PostgreSQL 15+ (ou Docker)

Para execução conteinerizada, basta Docker com o plugin Compose.

## Configuração

Copie o exemplo e troque os segredos:

```bash
cp .env.example .env
```

Variáveis:

| Variável | Finalidade |
| --- | --- |
| `PORT` | Porta HTTP da API |
| `DATABASE_URL` | URL PostgreSQL usada pelo Prisma na execução local |
| `POSTGRES_USER` | Usuário criado pelo container PostgreSQL |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL |
| `POSTGRES_DB` | Banco criado pelo container |
| `JWT_ACCESS_SECRET` | Segredo do access token, mínimo de 32 caracteres |
| `JWT_ACCESS_EXPIRES_IN` | Validade do access token, por exemplo `15m` |
| `JWT_REFRESH_SECRET` | Segredo independente do refresh token, mínimo de 32 caracteres |
| `JWT_REFRESH_EXPIRES_IN` | Validade do refresh token, por exemplo `7d` |
| `BCRYPT_ROUNDS` | Custo do bcrypt, de 10 a 15 |

Nunca use os valores do exemplo em produção. Gere segredos aleatórios fortes e não versione o arquivo `.env`.

## Execução local

Com um PostgreSQL acessível pela `DATABASE_URL`:

```bash
npm install
npx prisma generate
npm run prisma:migrate:deploy
npm run start:dev
```

A API fica em `http://localhost:3000` por padrão.

## Execução com Docker

Depois de configurar `.env`:

```bash
docker compose up --build
```

O PostgreSQL usa volume persistente, possui healthcheck e a API só inicia após o banco estar saudável. O container da API executa `prisma migrate deploy` antes de iniciar o servidor.

Para encerrar:

```bash
docker compose down
```

Use `docker compose down -v` somente se quiser apagar também todos os dados locais.

## Migrations e Prisma

Criar uma migration durante desenvolvimento:

```bash
npm run prisma:migrate -- --name nome_da_alteracao
```

Aplicar migrations já versionadas:

```bash
npm run prisma:migrate:deploy
```

Gerar novamente o client ou abrir o Prisma Studio:

```bash
npm run prisma:generate
npm run prisma:studio
```

As migrations versionadas estão em `prisma/migrations`. A migration
`202607140001_align_property_financial_models` converte os registros do modelo
financeiro anterior para a estrutura atual antes de remover as colunas legadas.

## Autenticação

Endpoints públicos:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

Endpoint protegido:

- `GET /auth/me`

O login emite um access token curto e um refresh token rotativo. Refresh tokens são armazenados somente como hash e são invalidados no primeiro uso. Envie o access token em `Authorization: Bearer <token>`.

O campo `googleAuthId` opcional deixa o usuário preparado para associação com Google OAuth. O fluxo OAuth não integra esta entrega inicial porque não faz parte dos endpoints solicitados.

## Imóveis

Todos os endpoints exigem JWT:

- `POST /properties`
- `GET /properties`
- `GET /properties/:id`
- `PATCH /properties/:id`
- `DELETE /properties/:id`

A listagem aceita:

- paginação: `page`, `limit` (máximo 100);
- filtros: `builderName`, `city`, `state`, `address`;
- ordenação: `sortBy=purchaseDate|createdAt` e `order=asc|desc`.

Exemplo:

```text
GET /properties?page=1&limit=20&city=Recife&sortBy=purchaseDate&order=desc
```

Todas as consultas incluem o ID do usuário autenticado. Um imóvel de outro usuário responde como não encontrado, sem revelar sua existência. Valores monetários e percentuais são enviados como strings decimais, por exemplo `"420000.00"`, para preservar precisão.

## Swagger

Com a aplicação em execução, acesse:

```text
http://localhost:3000/docs
```

Use o botão **Authorize** para informar o access token.

## Qualidade e testes

```bash
npm run lint
npm run build
npm test
npm run test:cov
npm run format
```

Os testes unitários cobrem as regras centrais de autenticação, proteção do hash de senha, escopo por proprietário, paginação/filtros e uso de `Prisma.Decimal`.

## Estrutura

```text
prisma/
  migrations/              migration SQL inicial
  schema.prisma            entidades, relações e índices
src/
  adjustment-indexes/
  auth/                    cadastro, login, refresh, JWT strategy e guard
  common/filters/          formato global de erros
  config/                  validação das variáveis de ambiente
  construction-fees/
  construction-progress/
  expenses/
  financing/
  payments/
  prisma/                  client e lifecycle do Prisma
  properties/              CRUD, DTOs, busca, paginação e ownership
  users/
  app.module.ts
  main.ts                  pipes, filtro e Swagger globais
```

## Decisões técnicas

- Controllers apenas traduzem HTTP; regras e acesso ao banco ficam nos services.
- `ValidationPipe` usa whitelist, rejeita campos desconhecidos e transforma query params.
- O filtro global padroniza erros com `statusCode`, `error`, `message`, `path` e `timestamp`, sem expor detalhes internos em erros 500.
- Senhas usam bcrypt e nunca são selecionadas/retornadas no perfil público.
- Access e refresh tokens possuem segredos distintos. A rotação faz revogação atômica para impedir uso concorrente do mesmo refresh token.
- Propriedade é o agregado de financiamento, pagamentos, despesas, progresso, taxas e índices; relações dependentes usam exclusão em cascata.
- Valores monetários usam `Decimal` no Prisma/PostgreSQL e strings na fronteira HTTP.
- Campos de relacionamentos, filtros e ordenação possuem índices. Buscas textuais são case-insensitive.
- Os módulos financeiros complementares já estão registrados e integrados ao Prisma; seus controllers/DTOs serão adicionados quando os respectivos endpoints entrarem no escopo funcional.

## Pontos de produção

- Coloque a API atrás de HTTPS e de um proxy com rate limiting, especialmente nas rotas de autenticação.
- Configure rotação/armazenamento seguro de segredos e observabilidade centralizada.
- Defina política de retenção dos refresh tokens expirados e job periódico de limpeza.
- Faça backup e teste restauração do volume PostgreSQL.
