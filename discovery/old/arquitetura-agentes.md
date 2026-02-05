# Arquitetura de Agentes - ADK

Este documento detalha a especialização e as responsabilidades dos agentes que compõem o ecossistema do ADK, garantindo uma divisão clara de tarefas e maior eficiência na orquestração do desenvolvimento.

## 5. Arquitetura de Agentes

Para evitar a sobrecarga de contexto e garantir a precisão em cada etapa do ciclo de vida do software, o ADK utiliza uma abordagem de agentes especializados.

### 5.1 Agent_Discovery
Responsável pela fase inicial de entendimento e mapeamento.
- **Entender o domínio:** Analisa a base de código, documentação existente e entradas do usuário para extrair regras de negócio e restrições técnicas.
- **Produzir perguntas estruturadas:** Identifica lacunas de conhecimento e solicita esclarecimentos ao desenvolvedor de forma organizada, evitando ambiguidades.

### 5.2 Agent_PRD
Responsável por consolidar a visão do produto.
- **Transformar discovery em PRD objetivo:** Processa os outputs do `Agent_Discovery` e as respostas do usuário para gerar um Documento de Requisitos de Produto (PRD) claro, técnico e executável.
- **Manter a fidelidade:** Garante que o PRD reflita exatamente o que foi discutido e validado.

### 5.3 Agent_Planning
Responsável pela estratégia de implementação.
- **Gerar tasks técnicas:** Decompõe o PRD em unidades de trabalho granulares (Tasks), definindo o que deve ser feito em nível de código.
- **Identificar dependências:** Mapeia a ordem de execução e os impactos em outros componentes do sistema, prevenindo conflitos arquiteturais.

### 5.4 Agent_Execution
Responsável por assistir o desenvolvedor na codificação.
- **Assistir implementação:** Sugere trechos de código, cria arquivos de teste e auxilia na resolução de problemas lógicos baseando-se nas tasks planejadas.
- **Segurança primeiro:** **Nunca executa código diretamente** ou realiza alterações destrutivas sem a supervisão e confirmação explícita do desenvolvedor no terminal.

### 5.5 Agent_Review
Responsável pela garantia de qualidade.
- **Code review:** Analisa as alterações propostas contra os padrões de código do projeto e a especificação original.
- **QA automatizado:** Sugere e executa testes unitários/integração para validar se a implementação cumpre os critérios de aceite.

### 5.6 Agent_Cost_Controller
Responsável pela eficiência operacional e financeira.
- **Monitorar tokens:** Acompanha em tempo real o consumo de tokens de cada agente e da sessão como um todo.
- **Bloquear execuções excessivas:** Interrompe fluxos que demonstrem comportamento de loop ou que excedam limites de custo pré-configurados, protegendo o orçamento do usuário.

## 6. Fluxo de Interação entre Agentes
Os agentes operam em um fluxo sequencial e iterativo, onde o output de um serve como input refinado para o próximo, sempre com o desenvolvedor como o validador central de cada transição de fase.
