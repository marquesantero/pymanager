# Documentacao Tecnica - PyManager Orchestrator

## Visao Geral
PyManager e um aplicativo desktop (Tauri v2) para descoberta, criacao, auditoria e manutencao de ambientes virtuais Python. A aplicacao combina:
- Frontend: React 19 + TypeScript + Tailwind CSS v4
- Backend: Rust (comandos Tauri)
- Persistencia local: SQLite via `tauri-plugin-sql`

Objetivo principal: centralizar o ciclo de vida de venvs (pip/uv), com cache local, diagnostico e ferramentas visuais de dependencias.

## Arquitetura

### Camada Frontend (`src/`)
- `App.tsx`: estado global, fluxo principal, abertura de modais e orquestracao de chamadas `invoke`.
- `components/Sidebar.tsx`: workspaces, tema, higiene global.
- `components/HygieneOverlay.tsx`: auditoria entre DB e disco (prune/adopt).
- `components/CommandPalette.tsx`: busca global (`Ctrl/Cmd + K`).
- `components/Studio/*`: modulo por ambiente (pacotes, automacao, config, diagnostico e deploy).
- `services/db.ts`: acesso SQLite no frontend (cache e metadados).
- `services/packageManager.ts`: facade de operacoes de pacote orientadas ao `manager_type`.

### Camada Backend (`src-tauri/src/lib.rs`)
Responsavel por:
- Descobrir venvs no filesystem (WalkDir com filtros)
- Executar comandos de pacote (`pip`, `uv`, `pipdeptree`, `pip-audit`)
- Coletar dados de diagnostico (health, outdated, security)
- Operacoes utilitarias (abrir terminal, VS Code, gerar Dockerfile, exportar requirements)
- Migracoes do banco local

### Persistencia (SQLite)
Banco: `py-manager.db`.

Tabelas criadas por migracao:
1. `workspaces` (`path`, `is_default`)
2. `venvs` (`workspace_path`, `name`, `path`, `version`, `status`, `issue`, `last_modified`, `manager_type`, `pyproject_path`)
3. `scripts` (`venv_path`, `name`, `command`)
4. `custom_templates` (`name`, `packages` JSON serializado)

## Fluxo de Inicializacao
No boot da aplicacao (`App.tsx`):
1. Carrega workspaces salvos e define o workspace padrao.
2. Carrega cache de venvs do SQLite.
3. Descobre interpretes Python disponiveis no PATH.
4. Carrega templates customizados.
5. Detecta managers instalados (`uv`, `poetry`, `pdm`) e prioriza `uv` quando disponivel.

## Funcionalidades Implementadas

### 1. Workspaces e descoberta
- Adicionar/remover workspace.
- Definir workspace padrao.
- Scan recursivo de venvs via `list_venvs`.
- Cache local por workspace para carregamento rapido.

### 2. Criacao de ambientes
- Escolha de engine: `pip` ou `uv` (quando detectado).
- Escolha do binario Python.
- Aplicacao automatica de template de pacotes apos criar o ambiente.

### 3. Cards de ambiente
Acoes por ambiente:
- Sync individual (`scan_venv`)
- Abrir no VS Code
- Abrir terminal no diretorio
- Abrir Studio
- Excluir ambiente fisicamente (`delete_venv`)

### 4. Studio (overlay por ambiente)
#### Packages
- Coleta de `pip freeze` + tamanho total
- Estimativa de tamanho por pacote
- Atualizar/desinstalar pacote
- Exportar `requirements.txt` no diretorio pai do venv
- Visualizacoes: lista, arvore de dependencias, grafo interativo (React Flow)

#### Automation
- Persistir scripts Python por ambiente
- Executar script com `python -c` do proprio venv

#### Config
- Edicao de `.env` no diretorio pai do venv
- Leitura de `pyvenv.cfg` (somente leitura)

#### Diagnostics
- Consistencia via `pip check`
- Pacotes desatualizados via `pip list --outdated --format=json`
- Security audit via `python -m pip_audit --format json`

#### Deploy
- Gera `Dockerfile` e `docker-compose.yml` em memoria para copia

### 5. Higiene global
Auditoria cruzada DB x disco:
- `broken_links`: entradas no banco sem pasta fisica
- `untracked_venvs`: venvs no disco sem registro no banco

Acoes:
- `Prune`: remove entrada morta no DB
- `Adopt`: adiciona venv orfa ao workspace correspondente

## Comandos Tauri Disponiveis
Principais comandos expostos:
- Descoberta/gestao: `list_venvs`, `scan_venv`, `create_venv`, `delete_venv`
- Pacotes: `install_dependency`, `uninstall_package`, `update_package`, `get_dependency_tree`, `get_package_sizes`
- Diagnostico: `check_venv_health`, `list_outdated_packages`, `audit_security`
- Config/arquivos: `read_env_file`, `save_env_file`, `get_pyvenv_cfg`, `export_requirements`
- Integracoes locais: `open_terminal`, `open_in_vscode`
- Suporte: `list_system_pythons`, `check_managers`, `audit_environments`, `generate_docker_files`, `search_pypi`

## Dependencias Externas Relevantes
- Obrigatorias para uso base:
  - Python 3.x
  - Node.js 20+
  - Rust 1.85+
- Recomendadas/condicionais:
  - `uv` para criacao/instalacao acelerada
  - `pipdeptree` para arvore de dependencia de ambientes `pip`
  - `pip-audit` para auditoria de seguranca
  - VS Code CLI (`code`) para acao "Open in VS Code"

## Limitacoes Observadas
1. `search_pypi` existe no backend, mas nao esta ligado a UI atual.
2. O resultado da seguranca depende de `pip-audit` instalado dentro do ambiente analisado.
3. O grafo de dependencia profundo pode ficar pesado em ambientes grandes (ha controle de profundidade para mitigar).
4. Geracao Docker e preview/copia em UI; nao grava arquivos automaticamente no projeto.

## Mapa de Arquivos
- Frontend:
  - `src/App.tsx`
  - `src/components/**`
  - `src/services/db.ts`
  - `src/services/packageManager.ts`
- Backend:
  - `src-tauri/src/lib.rs`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`

## Sugestoes Tecnicas (proximos passos)
1. Conectar `search_pypi` a uma UX de busca/instalacao de pacote.
2. Permitir salvar Docker manifests diretamente no projeto.
3. Adicionar suite de testes (unitarios Rust + testes de componentes React).
4. Normalizar nomenclatura de produto em `tauri.conf.json` (`productName`, `title`) para refletir "PyManager".
