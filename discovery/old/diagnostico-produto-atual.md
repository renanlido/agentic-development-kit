# Diagnóstico do Produto Atual

## 1. Problema Central Resolvido

O Agentic Development Kit (ADK) aborda a **fragmentação e ineficiência na orquestração de desenvolvimento de software assistido por IA**. Especificamente, resolve:

- A dificuldade de manter contexto coerente em tarefas de longa duração.
- O trabalho manual de "colar" etapas do ciclo de desenvolvimento (especificação, implementação, memória) ao usar LLMs.
- A falta de ferramental estruturado para agentes autônomos operarem sobre bases de código locais.

## 2. Proposta de Valor Atual

Oferecer um **framework CLI-first (Command Line Interface)** para desenvolvedores que automaiza o ciclo de vida do desenvolvimento de software ("CADD" Framework) utilizando Claude Code.

- **Automação Agêntica:** Transforma intenções de alto nível em execução de código via comandos CLI.
- **Gestão de Contexto:** Ferramentas dedicadas para otimização e injeção de memória/contexto para reduzir alucinações e perda de foco.
- **Fluxo Estruturado:** Padronização de Features, Tasks e Specs para guiar a IA.

## 3. Mapa de Funcionalidades Existentes

Baseado na estrutura atual do CLI (`adk` / `adk3`):

### Gestão do Ciclo de Vida

- **Feature/Feature-v3:** Gerenciamento de funcionalidades (criação, ciclo de vida).
- **Task:** Rastreamento e quebra de tarefas de desenvolvimento.
- **Spec:** Geração e gestão de especificações técnicas.
- **Deploy:** Automação de processos de implantação.

### Orquestração de Inteligência

- **Agent:** Execução de personas ou agentes específicos.
- **Workflow:** Encadeamento de múltiplos agentes/passos.
- **Memory:** Gestão de memória de longo prazo/indexação.
- **Context:** Manipulação e preparação do contexto para o LLM.

### Utilitários e Integração

- **Init/Config:** Inicialização e configuração do ambiente.
- **Sync/Import:** Sincronização de estado e importação de dados externos.
- **Report:** Geração de relatórios de progresso/estado.
- **Tool:** Gerenciamento de ferramentas disponíveis para os agentes.

## 4. Hipóteses Embutidas no MVP

1. **Interface CLI é Preferencial:** Desenvolvedores alvo preferem interagir via terminal e arquivos de configuração (ex: Markdown, JSON) do que via GUIs.
2. **Orquestração Local:** É possível gerenciar estado complexo e memória de agentes eficazmente usando apenas o sistema de arquivos local e processos Node.js.
3. **Estrutura CADD:** A divisão explícita em Contexto, Agente, Dados e Desenvolvimento é a abstração correta para maximizar a eficácia do Claude.
4. **Modelo Único (Claude):** O acoplamento forte com o SDK da Anthropic é aceitável em troca de maior qualidade de código neste estágio.

## 5. Principais Riscos

### Tecnologia

- **Fragilidade da Execução:** O "Autopilot" atual é funcional mas instável, indicando falhas na recuperação de erros ou na manutenção do estado de execução.
- **Gerenciamento de Processos:** O "spawn excessivo de processos" aponta para problemas de arquitetura na concorrência do Node.js ou vazamento de recursos, ameaçando a estabilidade da máquina do desenvolvedor.
- **Dívida Técnica de Versão:** A coexistência de `cli.ts` (v1/v2) e `cli-v3.ts` sugere uma migração incompleta ou arquitetura bifurcada que pode dificultar manutenção.

### Negócio (Custos)

- **Alto Consumo de Tokens:** A ineficiência na gestão de contexto torna o custo de operação proibitivo para tarefas triviais, limitando o ROI da ferramenta.
- **Dependência de Plataforma:** Risco de bloqueio (vendor lock-in) com a Anthropic; mudanças de API ou preços impactam diretamente a viabilidade.

### Produto

- **Complexidade Cognitiva:** A grande quantidade de comandos (`sync`, `workflow`, `agent`, `feature`, `task`) pode ter uma curva de aprendizado alta, afastando usuários que buscam "mágica" simples.

