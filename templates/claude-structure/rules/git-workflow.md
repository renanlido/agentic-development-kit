# Workflow Git

Estas regras sao carregadas automaticamente em toda sessao.

## Commits

### Formato
```
tipo(escopo): descricao curta

Corpo opcional com mais detalhes.

Refs: #123
```

### Tipos
- `feat`: Nova funcionalidade
- `fix`: Correcao de bug
- `refactor`: Refatoracao (sem mudanca de comportamento)
- `test`: Adicionar/modificar testes
- `docs`: Documentacao
- `chore`: Tarefas de manutencao
- `style`: Formatacao (sem mudanca de codigo)

### Regras
- Commits pequenos e atomicos
- Uma mudanca logica por commit
- Mensagem no imperativo ("Add feature" nao "Added feature")
- Maximo 72 caracteres na primeira linha

## Branches

### Nomenclatura
- `feature/nome-da-feature`
- `fix/descricao-do-bug`
- `refactor/o-que-refatorou`
- `chore/tarefa`

### Fluxo
1. Criar branch a partir de main/develop
2. Fazer commits pequenos
3. Abrir PR quando pronto
4. Code review
5. Merge (squash ou merge commit)
6. Deletar branch

## Pull Requests

### Checklist
- [ ] Testes passando
- [ ] Coverage adequado
- [ ] Codigo revisado
- [ ] Documentacao atualizada
- [ ] Sem conflitos

### Descricao
```markdown
## O que mudou
[Descricao das mudancas]

## Como testar
[Passos para testar]

## Screenshots (se aplicavel)
[Imagens]
```

## Proibido

- Push direto em main/master
- Force push em branches compartilhadas
- Commits com "WIP" ou mensagens vagas
- Merge sem review
