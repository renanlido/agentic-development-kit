# Project Name

Projeto inicializado com [Agentic Development Kit](https://github.com/renanlido/agentic-development-kit)

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development
npm run dev

# Run tests
npm test

# Build
npm run build

# Start production
npm start
```

## 📁 Project Structure

```
.
├── .claude/              # CADD framework files
│   ├── memory/          # Project context and memory
│   ├── plans/           # Feature plans and PRDs
│   ├── agents/          # Specialized agents
│   ├── skills/          # Reusable skills
│   └── commands/        # Custom commands
├── src/                 # Source code
├── tests/               # Tests
└── docs/                # Documentation
```

## 🛠️ Development Workflow

### Creating a Feature

```bash
# 1. Create feature
adk feature new <feature-name>

# 2. Edit PRD
# Edit .claude/plans/features/<feature-name>/prd.md

# 3. Research
adk feature research <feature-name>

# 4. Plan
adk feature plan <feature-name>

# 5. Implement
adk feature implement <feature-name>

# 6. QA
adk workflow qa <feature-name>

# 7. Deploy
adk deploy staging <feature-name>
adk deploy production <feature-name>
```

### Daily Workflow

```bash
# Morning setup
adk workflow daily

# Before commit
adk workflow pre-commit

# Before deploy
adk workflow pre-deploy <feature-name>
```

## 📝 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 🧹 Code Quality

```bash
# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

## 📚 Documentation

- [API Docs](./docs/api/)
- [Developer Guide](./docs/developer/)
- [Runbooks](./docs/runbooks/)

## 🔧 CADD Framework

Este projeto usa o framework CADD (Context-Agentic Development & Delivery):

- **Context First**: Sempre forneça contexto antes de codificar
- **Agent Isolation**: Use sub-agents para tarefas independentes
- **Development TDD**: Testes antes de implementação
- **Document Always**: Documente decisões e mudanças
- **Verification**: Valide cada etapa antes de avançar

Veja `.claude/README.md` para mais detalhes.

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/nome`
2. Follow TDD: Write tests first
3. Commit: `type(scope): description`
4. Push and create PR

## 📄 License

MIT
