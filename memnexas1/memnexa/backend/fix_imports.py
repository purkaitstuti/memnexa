import pathlib, re

for p in pathlib.Path(".").rglob("*.py"):
    if ".venv" in p.parts or p.name == "fix_imports.py":
        continue
    s = p.read_text(encoding="utf-8")
    n = re.sub(r"memnexas1\.(memnexa\.)?(backend\.)?", "", s)
    n = n.replace("from tests.conftest import", "from .conftest import")
    if n != s:
        p.write_text(n, encoding="utf-8")
        print("fixed", p)