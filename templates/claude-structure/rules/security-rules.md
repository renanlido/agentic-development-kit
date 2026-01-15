# Regras de Seguranca

Estas regras sao carregadas automaticamente em toda sessao.

## Input Validation

SEMPRE valide input de usuarios:
- Sanitize strings
- Valide tipos
- Limite tamanhos
- Escape caracteres especiais

## SQL Injection

NUNCA concatene strings em queries. Use parametros:

```typescript
// Use queries parametrizadas
const query = `SELECT * FROM users WHERE id = $1`
const result = await db.query(query, [userId])
```

## XSS (Cross-Site Scripting)

SEMPRE escape output em HTML:
- Use textContent em vez de innerHTML
- Use bibliotecas de sanitizacao como DOMPurify
- Valide e escape todo input do usuario

## Autenticacao

- NUNCA armazene senhas em texto plano
- Use bcrypt ou argon2 para hash
- Implemente rate limiting
- Use tokens com expiracao

## Secrets

NUNCA commite:
- Senhas
- API keys
- Tokens
- Certificados
- Arquivos .env

Use variaveis de ambiente:
```typescript
const apiKey = process.env.API_KEY
```

## HTTPS

- SEMPRE use HTTPS em producao
- Valide certificados SSL
- Use headers de seguranca (HSTS, CSP, etc)

## Dependencias

- Mantenha dependencias atualizadas
- Execute `npm audit` regularmente
- Nao use pacotes abandonados
