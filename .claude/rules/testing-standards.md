# Padroes de Teste

Estas regras sao carregadas automaticamente em toda sessao.

## TDD Obrigatorio

Todo codigo de producao DEVE ser escrito seguindo TDD:
1. RED: Escrever teste que falha
2. GREEN: Implementar codigo minimo
3. REFACTOR: Melhorar mantendo testes passando

## Coverage Minimo

- Statements: >= 80%
- Branches: >= 75%
- Functions: >= 85%
- Lines: >= 80%

## Estrutura de Teste

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    describe('when condition', () => {
      it('should expected behavior', () => {
        // Arrange
        // Act
        // Assert
      });
    });
  });
});
```

## Nomenclatura

- Describe: nome do componente/funcao
- It: `should [behavior] when [condition]`

## Mocking

- Mock apenas dependencias externas
- Prefira injecao de dependencia
- Limpe mocks apos cada teste

## Proibido

- Testes que dependem de ordem de execucao
- Testes que modificam estado global
- Testes sem assertions
- Testes flaky (que falham aleatoriamente)
