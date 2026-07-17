## Projeto

Backend Minha Morada desenvolvido com NestJS, Prisma e PostgreSQL.

## Convenções

- Código, nomes de arquivos e variáveis em inglês.
- Utilização do swagger para todos os endpoints.
- Documentação e mensagens de erro podem ser em português.
- Controllers não devem conter regras de negócio.
- Valores monetários devem utilizar Prisma Decimal.
- Nunca utilizar `any` sem justificativa.
- Nunca expor passwordHash ou refresh tokens.
- Todas as rotas privadas devem validar a propriedade do recurso.
- Antes de finalizar uma tarefa, executar lint, build e testes.

## Estrutura dos módulos

Cada módulo deve preferencialmente conter:

- controller
- service
- DTOs
- types ou entities
- use cases ( para regras de negocios complexas e/ou que necessitem do uso de services de outro modulo)

Siga os padrões já existentes no repositório antes de criar novas abstrações.

## Regras de autorização

Todas as rotas relacionadas ao imóvel devem verificar se:
property.userId === authenticatedUser.id
O usuário não poderá acessar ou modificar:
    • imóveis de outro usuário;
    • pagamentos de outro imóvel;
    • despesas de outro imóvel;
    • informações financeiras de outro usuário.
Apenas validar o propertyId na URL não é suficiente.

## Regras inportantes de negócio

No backend, evitar cálculos financeiros diretamente com number quando houver necessidade de precisão.
É recomendável usar:
Prisma.Decimal
ou uma biblioteca de precisão decimal.
Percentuais
Definir uma convenção única para toda a API.
Exemplo recomendado:
7.66 representa 7,66%
0.48 representa 0,48%
Datas mensais
Para campos como referenceMonth, salvar preferencialmente o primeiro dia do mês:
2026-07-01

Valores pagos:
Quando o status for PAID, validar:
paidDate obrigatório
paidAmount obrigatório, quando aplicável
Parcelas vencidas
Uma parcela será considerada vencida quando:
status = PENDING
dueDate < data atual
Não é necessário executar uma rotina diária apenas para alterar o status.