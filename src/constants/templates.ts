import { Template } from "../types";

export const PYTHON_TEMPLATES: Template[] = [
  { id: "none", name: "Empty Environment", pkgs: [] },
  { 
    id: "fastapi", 
    name: "Web: FastAPI (Modern)", 
    pkgs: ["fastapi", "uvicorn[standard]", "pydantic-settings", "sqlalchemy"] 
  },
  { 
    id: "django", 
    name: "Web: Django (Complete)", 
    pkgs: ["django", "djangorestframework", "django-cors-headers"] 
  },
  { 
    id: "flask", 
    name: "Web: Flask (Minimal)", 
    pkgs: ["flask", "flask-sqlalchemy", "flask-cors", "python-dotenv"] 
  },
  { 
    id: "data", 
    name: "Data: Analysis & Science", 
    pkgs: ["numpy", "pandas", "matplotlib", "seaborn", "scipy", "jupyter"] 
  },
  { 
    id: "llm", 
    name: "AI: Generative AI & LLMs", 
    pkgs: ["langchain", "openai", "anthropic", "chromadb", "tiktoken"] 
  },
  { 
    id: "scraping", 
    name: "Automation: Web Scraping", 
    pkgs: ["beautifulsoup4", "playwright", "requests"] 
  },
  { 
    id: "testing", 
    name: "Quality: Testing & QA", 
    pkgs: ["pytest", "pytest-cov", "black", "flake8", "mypy"] 
  },
];
