# Regras Operacionais do Repositorio (Schlosser PRO)

Estas regras valem para qualquer agente/assistente que fizer mudancas neste repositorio.

1. Fonte soberana de negocio:
- Sempre ler `docs/VERSAO_ATUAL.md` antes de implementar qualquer ajuste.
- O manual oficial apontado em `docs/VERSAO_ATUAL.md` e soberano.
- Divergencia entre codigo e manual e erro de implementacao.

2. Checklist obrigatorio:
- Validar mudancas pelo checklist oficial apontado em `docs/VERSAO_ATUAL.md`.
- Nao marcar tarefa como concluida sem revisar itens criticos de regressao.

3. Politica anti-regressao:
- Nao refatorar regras estaveis sem pedido explicito.
- Nao alterar mapeamento de colunas do Sheets sem changelog de manual.
- Mudancas devem ser pequenas, rastreaveis e com diff claro.

4. Publicacao:
- Alteracao so vai para producao apos commit + push + deploy do projeto.
- Sempre registrar no changelog do manual quando houver nova regra de negocio.
