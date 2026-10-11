import os, shutil, sys
from pathlib import Path

print("Python:", sys.version.split()[0])
for mod in ("PIL", "pytesseract", "pypdf"):
    try:
        __import__(mod); print("OK      import", mod)
    except Exception as e:
        print("MISSING import", mod, "->", e)

env = Path("../.env")
print(".env found:", env.exists())
cmd = ""
if env.exists():
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("TESSERACT_CMD="):
            cmd = line.split("=", 1)[1].strip().strip('"')
print("TESSERACT_CMD in .env:", repr(cmd))

cands = [cmd, shutil.which("tesseract") or "",
         r"C:\Program Files\Tesseract-OCR\tesseract.exe",
         r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
         os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe")]
found = next((c for c in cands if c and os.path.exists(c)), None)
print("tesseract.exe found at:", found)

if found:
    try:
        import pytesseract
        from PIL import Image, ImageDraw
        pytesseract.pytesseract.tesseract_cmd = found
        print("Tesseract version:", pytesseract.get_tesseract_version())
        im = Image.new("RGB", (900, 200), "white")
        ImageDraw.Draw(im).text((20, 80), "HELLO MEMNEXA TEST", fill="black")
        im = im.resize((3600, 800))
        print("OCR result:", repr(pytesseract.image_to_string(im).strip()))
    except Exception as e:
        print("OCR FAILED:", repr(e))