# MANUAL OPERACIONAL - SCHLOSSER PRO (sercarne.com)

- Versao: `V8.4.2` (OFICIAL - PRODUCAO)
- Plataforma: `https://sercarne.com`
- Status: ATIVA / PRODUCAO
- Fonte base: Google Sheets
- Planilha oficial: `Precificacao Mix Frigo Schlosser / Zaleski 2026 (IA APP)`
- ID da planilha: `12wPGal_n7PKYFGz9W__bXgK4mly2NbrEEGwTrIDCzcI`

Este documento e a constituicao do sistema.
O sistema executa este manual.
O manual nao se adapta ao sistema.

---

## Changelog

### V8.2
- Base funcional validada.

### V8.3
- Galeria de imagens por produto.
- Overlay de marca no card.
- Padronizacao oficial das colunas `AE/AF/BE/BF/BG/BH/AG/AH/AI`.

### V8.4
- Integracao oficial `ENTRADAS_ESTOQUE (Sheets)` -> `entradas_estoque (Supabase)`.
- Formalizacao do fluxo de importacao via Apps Script.
- Padronizacao do campo `qtd_und`.
- Regra oficial de UPSERT (`codigo + data_entrada`).
- Documentacao completa do calculo de estoque por data.

### V8.4.1
- Nova regra comercial para produtos vendidos por `PCT`.
- Quando `AC = PCT`, o preco exibido nas tabelas (`V/W/X/Y/Z/AA`) deve ser por pacote (`/pct`) e nao por kg.
- Inclusao da regra de peso fixo por pacote para calculo de peso estimado.
- Regra comercial de transferencia: `TAB2` (coluna `Z`) exclusiva para usuario de nivel `3`, aplicada direto ao logar.
- Exibicao de "Tabela aplicada" somente para usuarios de nivel `5` ou superior.

### V8.4.2
- Regra oficial de `ADMIN LIBERADO`: usuario admin (`Nivel 10`) pode aplicar menor preco valido entre `TAB0..TAB5`, com autonomia para negociar abaixo de `TAB5`.
- Gestor comercial deixa de ser tratado como admin no controle de acesso.
- Dashboard de vendedor formalizado como `PREVISAO DE COMISSAO`, nao como apuracao financeira final.

---

## CAPITULO 0 - PRINCIPIO FUNDAMENTAL (INALTERAVEL)

O Schlosser PRO existe para servir o Modelo de Negocio Schlosser.

- Ferramentas sao descartaveis.
- Regras de negocio nao sao.

Se houver divergencia entre sistema e este manual:
- e erro de implementacao
- nao e melhoria
- deve ser corrigido

## CAPITULO 1 - OBJETIVO

Definir de forma inequivoca:
- Catalogo
- Visibilidade
- Precificacao
- Regras de volume
- Estoque por data
- Entradas futuras
- Rotas e cutoff
- Pedidos e status
- Permissoes
- Piso e ajustes
- Imagens e marca
- Governanca

Permitir:
- Troca de desenvolvedor
- Troca de IA
- Escalabilidade
- Zero regressao

## CAPITULO 2 - FONTES DA VERDADE (REGRA ABSOLUTA)

### 2.1 Google Sheets

Unica fonte da verdade para:
- Produtos
- Precos
- Peso medio / peso padrao
- Visibilidade
- Imagens
- Marca
- Rotas

### 2.2 Supabase

Banco operacional para:
- Login
- Pedidos
- Entradas futuras
- Calculo de estoque

Supabase nao define regra de negocio.

### 2.3 Principios imutaveis

- `UND` != `KG`
- `PCT` != `KG`
- Preco sempre vem das tabelas oficiais da planilha
- Peso e estimativo
- Cliente nunca ve tabela interna
- Carrinho nao compromete estoque
- Pedido e o primeiro compromisso real

## CAPITULO 3 - ARQUITETURA OFICIAL

### 3.1 Frontend
- React + Vite + Tailwind
- ProductCard
- Carrinho com UND / peso estimado / subtotal

### 3.2 Leitura de dados
- Google Sheets via GVIZ/Query
- Cache leve para performance

### 3.3 Supabase
- Auth
- pedidos
- entradas_estoque

## CAPITULO 4 - ABA OFICIAL DO CATALOGO

Aba obrigatoria:
- `2026 Base Catalogo Precifica V2`

Toda leitura deve vir dela.

## CAPITULO 5 - VISIBILIDADE

Coluna:
- `AX -> EXIBIR NA PLATAFORMA`

Regra:
- `TRUE` -> aparece
- `FALSE` -> nao aparece

Nenhuma logica pode ignorar `AX`.

## CAPITULO 6 - ORDEM DE EXIBICAO

Ordem padrao:
- Maior estoque disponivel -> menor

Objetivo:
- Vender o que tem
- Evitar ruptura

## CAPITULO 7 - LOGICA DE PRECO (IMUTAVEL)

### 7.1 Unidade comercial e base de exibicao de preco

Coluna de unidade:
- `AC` (coluna 29)

Valores suportados:
- `UND`
- `CX`
- `PCT`

Regras oficiais:
- `UND`: preco de tabela continua por kg; peso por unidade vem da coluna `I`.
- `CX`: preco de tabela continua por kg; peso fixo por caixa = `10kg`.
- `PCT`: preco de tabela deve ser tratado e exibido por pacote (`/pct`), com peso padrao do pacote na coluna `I`.

### 7.2 Formula base de valor estimado

Para itens por kg (`UND` e `CX`):
- `VALOR ESTIMADO = QTD * PESO_ESTIMADO * PRECO_TABELA`

Para itens por pacote (`PCT`):
- `VALOR ESTIMADO = QTD_PCT * PRECO_PCT`

Peso estimado total para `PCT`:
- `PESO_ESTIMADO_TOTAL = QTD_PCT * PESO_PCT`

### 7.3 Tabelas de preco

Colunas oficiais de preco:
- `V (TAB0)`, `W`, `X`, `Y`, `Z`, `AA`

Regra de perfil:
- Usuario nivel `3`: usa `TAB2` (coluna `Z`) como tabela exclusiva de transferencia.

Regra de exibicao:
- Exibir `/kg` para `UND` e `CX`
- Exibir `/pct` para `PCT`

Regra de sigilo:
- Nunca exibir nome interno da tabela
- Nunca exibir regra interna de desconto em R$

Piso absoluto:
- `TAB5`

Excecao oficial:
- `ADMIN LIBERADO (Nivel 10)`: pode operar com menor preco valido entre tabelas e nao fica bloqueado pelo piso `TAB5`.

## CAPITULO 8 - TABELAS E VOLUME

Modelo de referencia:
- `1 UND -> TAB1`
- `2-9 UND -> TAB0`
- `>=10 UND -> TAB4`

Cliente ve:
- preco final por unidade comercial (`kg` ou `pct`)
- badge percentual (quando aplicavel)

Cliente nao ve:
- nome da tabela
- desconto em R$
- regra interna

Excecao controlada de exibicao:
- Indicador de "Tabela aplicada" so pode aparecer para usuarios nivel `5+`.

Piso absoluto:
- `TAB5`

## CAPITULO 9 - ROTAS E CUTOFF

Fonte:
- Aba `Rotas Dias De Entrega`

Regras:
- Cidade define rota
- Rota define dias
- Rota define cutoff
- Usuario nao pode forcar data invalida

## CAPITULO 10 - ESTOQUE POR DATA (V8.4 OFICIAL)

Formula:

`Disponivel(D) = Estoque_Base + Entradas(<=D) - Pedidos_Comprometidos(<=D)`

### 10.1 Estoque Base
- Vem do Sheets (coluna oficial do catalogo)

### 10.2 Entradas Futuras
- Vem do Supabase
- Tabela: `entradas_estoque`
- Origem operacional: `Sheets -> ENTRADAS_ESTOQUE`

### 10.3 Pedidos Comprometidos

Comprometem:
- `PEDIDO ENVIADO`
- `PEDIDO CONFIRMADO`
- `SEU PEDIDO SAIU PARA ENTREGA`

Nao comprometem:
- `CANCELADO`
- `PEDIDO ENTREGUE`

Carrinho nao compromete.

## CAPITULO 11 - ENTRADAS FUTURAS (V8.4)

### 11.1 Aba oficial no Sheets
- `ENTRADAS_ESTOQUE`

Estrutura:
- `A -> data_entrada`
- `B -> codigo`
- `C -> qtd_und`
- `D -> obs`
- `E/F` apenas visuais

### 11.2 Processo oficial
- Sheets e operacional
- Supabase e calculo
- Importacao via Apps Script:
  `importEntradasEstoqueToSupabase()`

### 11.3 Script Properties obrigatorias
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TABLE = entradas_estoque`

### 11.4 Estrutura Supabase

Tabela: `entradas_estoque`

Campos minimos:
- `id (uuid)`
- `codigo (text)`
- `data_entrada (date)`
- `qtd_und (numeric)`
- `obs (text)`
- `created_at (timestamp)`

Campo oficial usado:
- `qtd_und`

### 11.5 Regra anti-duplicacao

UPSERT por:
- `(codigo, data_entrada)`

Se existir:
- atualiza

Se nao existir:
- cria

Nunca duplicar.

## CAPITULO 12 - PEDIDOS E STATUS

Status oficiais:
- `PEDIDO ENVIADO`
- `PEDIDO CONFIRMADO`
- `SEU PEDIDO SAIU PARA ENTREGA`
- `PEDIDO ENTREGUE`
- `CANCELADO`

Permissoes:
- Niveis `1-5`: cria; cancela apenas se `ENVIADO`
- Niveis `6-10`: confirma; avanca status; cancela com motivo

Perfis de acesso:
- `Admin`: acesso administrativo completo (`/admin`) e dashboard de pedidos.
- `Gestor Comercial`: acesso em `/vendedor` (separado de admin), sem poderes exclusivos de admin.
- `Vendedor/Supervisor/Producao`: acesso em `/vendedor` conforme nivel.

## CAPITULO 13 - PISO E AJUSTES

Piso absoluto:
- `TAB5`

Regra:
- Nunca vender abaixo do piso.

Excecao oficial:
- `ADMIN LIBERADO (Nivel 10)` pode negociar abaixo de `TAB5`.

Ajustes exigem:
- motivo
- usuario
- data/hora

Cliente nunca ve regra interna.

## CAPITULO 14 - IMAGENS E MARCA (OFICIAL)

Aba:
- `2026 Base Catalogo Precifica V2`

Colunas oficiais:
- `AE -> 1a foto limpa`
- `AF -> 1a foto bruta`
- `BE -> 2a foto limpa`
- `BF -> 2a foto bruta`
- `BG -> 3a foto limpa`
- `BH -> 3a foto bruta`
- `AG -> marca limpa`
- `AH -> marca bruta`
- `AI -> codigo + nome marca`

Regras:
- Prioridade sempre link limpo
- Bolinhas apenas se 2+ fotos
- Marca e somente visual

## CAPITULO 15 - WHATSAPP (CIENCIA)

Pedido gera WhatsApp automatico.

WhatsApp:
- nao confirma pedido
- nao altera status
- nao escreve no banco

E apenas ciencia.

## CAPITULO 16 - GOVERNANCA (ANTI-REGRESSAO)

O sistema executa o manual.

Durante estabilidade:
- nao refatorar o que funciona
- nao otimizar regra validada
- nao alterar estrutura de colunas

Mudanca so com:
- validacao
- changelog
- nova versao

## CAPITULO 17 - MAPA DAS ABAS OFICIAIS

- `2026 Base Catalogo Precifica V2` -> catalogo
- `Relacao Clientes Sysmo` -> clientes
- `Rotas Dias De Entrega` -> logistica
- `ENTRADAS_ESTOQUE` -> entradas futuras
- `Legenda/Objetivos` -> arquitetura

## CAPITULO 18 - REGRA ESPECIAL DE PCT (V8.4.1)

Nova unidade comercial:
- `PCT` na coluna `AC`

Regras obrigatorias:
- Quando `AC = PCT`, o preco mostrado ao usuario deve ser `/pct`.
- O valor do pacote e fixo na tabela ativa (`V/W/X/Y/Z/AA`).
- O peso do pacote e fixo e vem da coluna `I`.
- O sistema pode derivar `R$/kg` internamente para analise, sem exibir como base comercial do item.

Exemplo oficial atual:
- Codigo `497320` - Hamburguer (2undx150gr) 300gr - cod barra.

## CAPITULO 19 - COMISSAO (PREVISAO OPERACIONAL)

Regra de dashboard:
- O valor exibido em "Previsao de Comissao" e apenas indicador comercial.
- Nao representa valor liquido final a pagar ao representante.

Regra de fechamento:
- Comissao real so e apurada apos emissao da NF e recebimento financeiro do cliente.
- A base final considera regras contratuais (tributos, frete/logistica, inadimplencia, cancelamentos e devolucoes).

## DECLARACAO FINAL

Este documento define integralmente a operacao do Schlosser PRO `V8.4.2`.
Qualquer divergencia entre sistema e este manual e erro de implementacao.
O manual e soberano.
