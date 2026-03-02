# Documentação Técnica - PyManager 🐍

PyManager é um gerenciador de ambientes virtuais Python de alto nível, projetado para desenvolvedores que lidam com múltiplos projetos e desejam evitar o "inferno dos venvs". Ele combina a performance do **Rust** com a flexibilidade do **React 19** e **Tauri v2**.

---

## 🏗️ Arquitetura do Sistema

### Backend (Rust/Tauri)
- **Descoberta Dinâmica:** Utiliza o `PATH` do sistema para localizar executáveis Python sem caminhos fixos.
- **Segurança:** Comandos isolados para manipulação de arquivos e execução de scripts.
- **Persistência:** Base de dados **SQLite** (`py-manager.db`) integrada via plugin SQL do Tauri.
- **Análise de Disco:** Cálculo de tamanho de diretórios utilizando a crate `fs_extra`.

### Frontend (React/TypeScript)
- **Modularização:** Componentes especializados na pasta `src/components/Studio` para cada funcionalidade.
- **Estilização:** Tailwind CSS v4 com design "Flat" e suporte nativo a Dark Mode.
- **Escala Global:** Sistema de zoom baseado em CSS para acessibilidade total.

---

## 🛠️ Funcionalidades Detalhadas

### 1. Gestão de Workspaces
- **Adição Dinâmica:** Permite selecionar qualquer pasta no disco para monitoramento.
- **Scan Recursivo:** O motor de busca ignora pastas pesadas (`node_modules`, `target`, `.git`) e localiza ambientes `.venv` ou com nomes customizados.
- **Persistência de Cache:** Os resultados do scan são salvos no SQLite para carregamento instantâneo no próximo boot.

### 2. Python Dev Studio (O Core)
Uma interface de sobreposição (Overlay) completa para cada ambiente selecionado:

#### **A. Packages (Gerenciador de Bibliotecas)**
- **Visualização de Versões:** Lista todas as bibliotecas instaladas (`pip freeze`).
- **Explorador de Tamanho:** Mostra o impacto real em **Megabytes (MB)** de cada pacote individual no disco.
- **Ações Rápidas:** Botões para atualizar (`upgrade`) ou desinstalar (`uninstall`) bibliotecas com um clique.
- **Exportação:** Gera o arquivo `requirements.txt` na raiz do projeto automaticamente.

#### **B. Automation (Scripts Customizados)**
- **Runner Interno:** Permite salvar comandos Python frequentes (ex: `import database; database.setup()`).
- **Execução em Contexto:** Os scripts rodam utilizando o interpretador exato do ambiente virtual selecionado.
- **Histórico:** Salva os scripts no banco de dados para uso recorrente entre sessões.

#### **C. Config (Editor de Configuração)**
- **.env Editor:** Interface lado a lado para editar variáveis de ambiente do projeto.
- **pyvenv.cfg Viewer:** Visualizador em modo leitura das configurações nativas do Python (caminho base, versão, etc).

#### **D. Diagnostics (Saúde do Ambiente)**
- **Integridade:** Executa o `pip check` para encontrar conflitos de dependências.
- **Detector de Desatualização:** Compara as versões instaladas com as mais recentes no PyPI e sugere atualizações.

#### **E. Deploy (Docker Engine)**
- **Docker Generator:** Analisa a versão do Python e os pacotes instalados para gerar um `Dockerfile` otimizado (slim) e um `docker-compose.yml` prontos para uso.

### 3. Sistema de Templates Customizados
- **Snapshot de Ambiente:** Salve o estado de qualquer ambiente atual (lista de pacotes) como um template.
- **Bootstrap Rápido:** Ao criar um novo ambiente, selecione um template para que o PyManager instale todas as dependências automaticamente durante o build.

### 4. Interface e Acessibilidade
- **Global Zoom (A+/A-):** Redimensiona proporcionalmente todos os elementos da interface (textos, ícones, inputs) de 70% a 150%.
- **Theming:** Troca rápida entre modo Claro, Escuro ou Sincronização com o Sistema.
- **Loading Premium:** Animação de inicialização que previne o flickering de cores durante a carga dos dados do SQLite.

---

## 🚀 Comandos Rápidos

| Ação | Atalho no Card |
| :--- | :--- |
| **Sync** | Atualiza status e versão do venv individualmente |
| **Terminal** | Abre o terminal nativo do SO já na pasta do projeto |
| **VS Code** | Abre o ambiente diretamente no Visual Studio Code |
| **Studio** | Abre a central de ferramentas avançadas |
| **Delete** | Remove a pasta do ambiente do disco físico |

---

## 📝 Banco de Dados (Schema)

O PyManager utiliza 4 tabelas principais:
1. `workspaces`: Armazena os caminhos das pastas monitoradas.
2. `venvs`: Cache de metadados (nome, caminho, versão, status).
3. `scripts`: Scripts de automação vinculados a cada caminho de venv.
4. `custom_templates`: Nome do template e string serializada de pacotes.

---
*PyManager - Desenvolvido para máxima produtividade em Python.*
