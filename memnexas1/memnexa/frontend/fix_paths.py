import pathlib

src = pathlib.Path("src")
for p in src.rglob("*.ts*"):
    s = p.read_text(encoding="utf-8")
    prefix = "../" if p.parent != src else "./"   # files directly in src use ./
    n = s.replace("../src/", prefix)
    if n != s:
        p.write_text(n, encoding="utf-8")
        print("fixed", p)