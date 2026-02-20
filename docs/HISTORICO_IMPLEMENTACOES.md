# Historico de Implementacoes - Schlosser PRO

- Ultima atualizacao: 2026-02-20
- Objetivo: registrar evolucao funcional por versao, sem perder rastreabilidade.

## Fontes de referencia

- Fonte historica original (Google Docs):
  `https://docs.google.com/document/d/15BaR0jG2a-gDE76eiQ5J0JY7jzzZ0pRqdFDTkEIyuaI/edit`
- Export versionado no repositorio:
  `docs/ORIGENS/MANUAL_V8.4_GOOGLE_DOC_EXPORT_2026-02-20.txt`
- Manual vigente:
  `docs/MANUAL_OPERACIONAL_SCHLOSSER_PRO_V8.4.1.md`

## Linha do tempo

### V8.2

- Base funcional validada.

### V8.3

- Galeria de imagens por produto.
- Overlay de marca no card.
- Padronizacao oficial das colunas `AE/AF/BE/BF/BG/BH/AG/AH/AI`.

### V8.4

- Integracao oficial `ENTRADAS_ESTOQUE (Sheets) -> entradas_estoque (Supabase)`.
- Formalizacao do fluxo de importacao via Apps Script.
- Padronizacao do campo `qtd_und`.
- Regra oficial de UPSERT por `(codigo, data_entrada)`.
- Documentacao do calculo de estoque por data.

### V8.4.1 (vigente)

- Inclusao da regra comercial para unidade `PCT` (coluna `AC`):
  - `UND`: preco por `kg`, peso na coluna `I`.
  - `CX`: preco por `kg`, peso fixo de `10kg`.
  - `PCT`: preco por `pct`, peso fixo por pacote na coluna `I`.
- Documentacao versionada de governanca:
  - `docs/VERSAO_ATUAL.md`
  - `docs/CHECKLIST_VALIDACAO_SCHLOSSER_PRO_V8.4.1.md`
  - `AGENTS.md`

## Regras de uso deste historico

- Toda mudanca de negocio deve atualizar:
  1. Changelog do manual vigente.
  2. Entrada de versao neste historico.
  3. Checklist oficial da versao ativa (quando houver novo criterio de validacao).
- Nao substituir registros antigos; apenas adicionar novas versoes.

## Template para nova versao

Copiar e preencher no final do arquivo:

```md
### VX.Y

- Mudanca 1.
- Mudanca 2.
- Risco/regra impactada.
```
