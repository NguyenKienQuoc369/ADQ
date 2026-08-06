# Contributing to ADQ Enterprise DAST/ASM Platform 🛡️

Thank you for your interest in contributing to **ADQ**! We welcome bug hunters, security researchers, and software engineers from all around the world to help build the ultimate open-source Application Security Testing & Continuous Threat Exposure Management platform.

---

## 🚀 How to Contribute

### 1. Reporting Security Bugs or Issues
- If you find a bug in the scanner, core engines, or web dashboard, please open a **GitHub Issue**.
- Provide a clear description, reproducible steps, and logs if available.

### 2. Developing New Scanning Rules & Logic Modules
- Logic vulnerability scanners reside in `modules/logic/`.
- Core scanning engines reside in `core/`.
- Ensure new scanners follow our modular architecture:
  - Implement a dedicated class (e.g., `MyCustomScanner`).
  - Return standardized JSON payloads with severity tags (`critical`, `high`, `medium`, `low`).
  - Include an offline dry-run test script (e.g., `my_scanner_dry_run.py`).

### 3. Enhancing AI Security Agent Prompts & Heuristics
- AI prompts and heuristic triage rules are located in `core/ai_agent.py`.
- Feel free to submit PRs that improve false-positive filtering or add support for new LLM providers.

---

## 🛠️ Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/ADQ.git
   cd ADQ
   ```

2. **Set up Python Virtual Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Set up Web Dashboard:**
   ```bash
   cd web
   npm install
   npx prisma generate
   npm run dev
   ```

4. **Run System Verification Suite:**
   ```bash
   python3 core_engine_dry_run.py
   python3 enterprise_dry_run.py
   python3 scan_profiles_dry_run.py
   python3 graph_protocol_dry_run.py
   ```

---

## 📜 Pull Request Guidelines

1. Fork the repo and create a new feature branch (`git checkout -b feature/awesome-feature`).
2. Make sure all dry-run verification tests pass locally (`python3 core_engine_dry_run.py`).
3. Ensure clean code structure and add comments where necessary.
4. Open a Pull Request against the `main` branch with a concise summary of changes.

Thank you for making ADQ stronger! 🚀
