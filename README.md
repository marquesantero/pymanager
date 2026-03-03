# PyManager Orchestrator

Aplicacao desktop para gerenciar ambientes virtuais Python com foco em produtividade: descoberta de venvs, manutencao de pacotes, diagnostico, automacao e higiene global de workspaces.

Stack principal:
- Tauri v2 (Rust)
- React 19 + TypeScript
- Tailwind CSS v4
- SQLite (`tauri-plugin-sql`)

## O que o app faz
- Descobre venvs em workspaces com cache local no SQLite.
- Cria ambientes usando `pip` ou `uv`.
- Instala templates de pacotes na criacao do ambiente.
- Abre terminal e VS Code diretamente no contexto do ambiente.
- Oferece um Studio por venv com:
  - gestao de pacotes (upgrade/uninstall/export)
  - arvore e grafo de dependencias
  - scripts de automacao
  - edicao de `.env` e leitura de `pyvenv.cfg`
  - diagnostico de saude e seguranca (`pip-audit`)
  - geracao de Dockerfile e `docker-compose.yml` (preview/copia)
- Executa higiene global (prune/adopt) para sincronizar DB e disco.

## Requisitos
- Node.js 20+
- Rust 1.85+
- Python 3.x

Opcional (recomendado):
- `uv`
- `pipdeptree` (para arvore em venv pip)
- `pip-audit` (para security audit)
- CLI `code` do VS Code

## Como rodar localmente
```bash
npm install
npm run tauri dev
```

Build de producao:
```bash
npm run tauri build
```

## Scripts disponiveis
- `npm run dev`: frontend Vite
- `npm run build`: build frontend (TypeScript + Vite)
- `npm run tauri dev`: app desktop em desenvolvimento
- `npm run tauri build`: bundle desktop

## Estrutura do projeto
```text
src/
  App.tsx
  components/
  services/
src-tauri/
  src/lib.rs
  Cargo.toml
DOCUMENTATION.md
```

## Banco local (SQLite)
Arquivo: `py-manager.db`

Tabelas principais:
- `workspaces`
- `venvs`
- `scripts`
- `custom_templates`

## Observacoes tecnicas
- A engine (`pip`/`uv`) e detectada por ambiente e respeitada nas operacoes de pacote.
- `search_pypi` ja existe no backend, mas nao esta conectado na UI atual.
- O modulo de deploy gera manifests em memoria para copia; nao persiste arquivos automaticamente.

## Documentacao detalhada
A analise tecnica completa da aplicacao esta em:
- [DOCUMENTATION.md](./DOCUMENTATION.md)
