# Regras de Estilo de Codigo

Estas regras sao carregadas automaticamente em toda sessao.

## Formatacao

- Indentacao: 2 espacos
- Largura maxima: 100 caracteres
- Aspas: simples para JS/TS, duplas para JSX
- Ponto e virgula: conforme padrao do projeto

## Nomenclatura

### Arquivos
- Componentes: `PascalCase.tsx`
- Utilitarios: `kebab-case.ts`
- Testes: `*.test.ts` ou `*.spec.ts`

### Codigo
- Classes: `PascalCase`
- Funcoes: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Variaveis: `camelCase`
- Tipos/Interfaces: `PascalCase` com prefixo `I` opcional

## Estrutura de Arquivos

```typescript
// 1. Imports externos
import React from 'react'

// 2. Imports internos
import { utils } from '../utils'

// 3. Types/Interfaces
interface Props {
  // ...
}

// 4. Constantes
const DEFAULT_VALUE = 10

// 5. Componente/Funcao principal
export function Component(props: Props) {
  // ...
}

// 6. Helpers privados (se necessario)
function helperFunction() {
  // ...
}
