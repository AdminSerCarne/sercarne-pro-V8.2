# CHECKLIST DE VALIDACAO - SCHLOSSER PRO

- Versao: `V8.4.1`
- Base: `docs/MANUAL_OPERACIONAL_SCHLOSSER_PRO_V8.4.1.md`
- Uso: pre-release, homologacao e anti-regressao

## 1. Fontes e Estrutura

- [ ] Aba do catalogo lida apenas de `2026 Base Catalogo Precifica V2`.
- [ ] Visibilidade respeita `AX` (`TRUE` exibe, `FALSE` oculta).
- [ ] Rotas e cutoff lidos da aba `Rotas Dias De Entrega`.
- [ ] Entradas futuras usam `ENTRADAS_ESTOQUE -> entradas_estoque`.
- [ ] Nao existe regra de negocio critica definida apenas no Supabase.

## 2. Preco e Unidade Comercial

- [ ] Colunas de preco `V/W/X/Y/Z/AA` aplicadas corretamente conforme volume.
- [ ] Piso absoluto `TAB5` bloqueia qualquer venda abaixo do minimo.
- [ ] Usuario nivel `3` recebe preco da `TAB2` (coluna `Z`) ao logar.
- [ ] `AC = UND`: preco exibido como `/kg`, peso da coluna `I`.
- [ ] `AC = CX`: preco exibido como `/kg`, peso fixo `10kg` por caixa.
- [ ] `AC = PCT`: preco exibido como `/pct`, com valor fixo por pacote.
- [ ] `PCT` calcula peso estimado com base na coluna `I`.
- [ ] Nome interno da tabela nao e exibido para cliente.
- [ ] Texto "Tabela aplicada" aparece somente para usuarios nivel `5+`.

## 3. Estoque por Data

- [ ] Formula implementada: `Disponivel(D) = Base + Entradas(<=D) - Comprometidos(<=D)`.
- [ ] Carrinho nao compromete estoque.
- [ ] Status que comprometem: `PEDIDO ENVIADO`, `PEDIDO CONFIRMADO`, `SEU PEDIDO SAIU PARA ENTREGA`.
- [ ] Status que nao comprometem: `PEDIDO ENTREGUE`, `CANCELADO`.

## 4. Pedidos, Status e Permissoes

- [ ] Status oficiais usados sem variantes fora do padrao.
- [ ] Niveis `1-5` cancelam apenas pedido enviado.
- [ ] Niveis `6-10` podem confirmar/avancar status/cancelar com motivo.
- [ ] Cancelamentos administrativos registram motivo.

## 5. Imagens e Marca

- [ ] Colunas `AE/AF/BE/BF/BG/BH/AG/AH/AI` mapeadas como oficial.
- [ ] Prioridade sempre para link limpo.
- [ ] Bolinhas da galeria aparecem apenas com 2 ou mais fotos.
- [ ] Marca usada apenas como elemento visual.

## 6. WhatsApp e Integracoes

- [ ] WhatsApp apenas notifica (ciencia), sem confirmar pedido.
- [ ] WhatsApp nao altera status no banco.
- [ ] WhatsApp nao grava dados de pedido.

## 7. ENTRADAS_ESTOQUE (Apps Script + Supabase)

- [ ] Apps Script usa `importEntradasEstoqueToSupabase()`.
- [ ] Properties configuradas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TABLE`.
- [ ] Campo oficial de quantidade: `qtd_und`.
- [ ] UPSERT por `(codigo, data_entrada)` sem duplicacao.

## 8. Anti-regressao e Governanca

- [ ] Mudanca validada no ambiente de homologacao antes de producao.
- [ ] Changelog do manual atualizado para cada nova regra de negocio.
- [ ] Nao houve refatoracao de regra estavel sem aprovacao.
- [ ] Codigo e manual estao coerentes na mesma versao.

## 9. Evidencias (preencher a cada release)

- [ ] Hash/commit validado: `________________________`
- [ ] Responsavel tecnico: `________________________`
- [ ] Data/hora validacao: `________________________`
- [ ] Ambiente validado (dev/hml/prod): `________________________`
- [ ] Observacoes de risco: `________________________`
