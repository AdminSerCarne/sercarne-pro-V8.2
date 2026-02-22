# Checklist Contratual - Representacao Comercial 2026

- Fonte analisada:
  `docs/ORIGENS/CONTRATOS_REPRESENTACAO_COMERCIAL_PJ_2026.txt`
- Data de analise: 2026-02-20
- Escopo: aderencia entre clausulas contratuais e comportamento da plataforma.

## Resultado por clausula

### OK (aderente)

- Clausula 1.1 / 4.1(c): representante nao altera preco/tabela/piso livremente.
  Evidencia tecnica:
  - `src/domain/schlosserRules.js` (aplicacao de tabela + piso TAB5 com excecao documentada para admin nivel 10)
  - `src/services/schlosserApi.js` (preco a partir de tabelas oficiais do Sheets)
- Clausula 9.1/9.2: plataforma executa regras documentadas.
  Evidencia documental:
  - `docs/VERSAO_ATUAL.md`
  - `docs/MANUAL_OPERACIONAL_SCHLOSSER_PRO_V8.4.1.md`

### Parcial (existe base, falta trava total)

- Clausula 7.1/7.3: vinculacao de cliente por representante.
  Situacao atual:
  - app seleciona clientes em lista unica.
  - nao existe bloqueio hard de "cliente pertencente a outro representante" no frontend.
  Evidencia tecnica:
  - `src/components/ClientSelector.jsx`
  - `src/services/schlosserApi.js` (`getClients`)

### Pendente (nao implementado como modulo de negocio)

- Clausula 6.x: comissionamento por faturado/recebido.
  Situacao:
  - plataforma registra pedidos e exibe previsao operacional de comissao.
  - nao possui motor formal de apuracao final por faturado/recebido.
- Clausula 3.x: exclusividade reciproca por termo.
  Situacao:
  - nao existe regra sistemica de exclusividade por marca/territorio no fluxo do pedido.

## Acoes recomendadas para fechar aderencia

1. Implementar vinculacao formal de cliente -> representante no fluxo de pedidos.
2. Criar modulo de comissionamento (baseado em faturamento/recebimento).
3. Criar regra de exclusividade opcional por termo (admin), com auditoria.
