"""Text extraction from uploads. Files are read in memory, never saved to disk and never executed."""
import io, os, shutil
from .config import settings

ALLOWED = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".md"}
IMAGES = {".png", ".jpg", ".jpeg", ".webp"}
WIN_TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


class ExtractError(Exception):
    pass


def sniff(ext: str, data: bytes) -> bool:
    """Check the real content matches the extension (the extension alone is not trusted)."""
    if ext == ".png":
        return data[:8] == b"\x89PNG\r\n\x1a\n"
    if ext in (".jpg", ".jpeg"):
        return data[:3] == b"\xff\xd8\xff"
    if ext == ".webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if ext == ".pdf":
        return data[:5] == b"%PDF-"
    return b"\x00" not in data[:4096]  # text / markdown


def _tesseract():
    import pytesseract
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
    elif not shutil.which("tesseract") and os.path.exists(WIN_TESSERACT):
        pytesseract.pytesseract.tesseract_cmd = WIN_TESSERACT
    return pytesseract


def extract_text(ext: str, data: bytes) -> str:
    if ext in (".txt", ".md"):
        return data.decode("utf-8", errors="replace").strip()
    if ext == ".pdf":
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise ExtractError("This PDF is password-protected. Remove the password and try again.")
            text = "\n".join((p.extract_text() or "") for p in reader.pages[:30]).strip()
        except ExtractError:
            raise
        except Exception:
            raise ExtractError("We couldn't read this PDF. It may be damaged.")
        if not text:
            raise ExtractError("This PDF has no selectable text (it may be scanned). Upload screenshots of its pages instead.")
        return text
    # images -> OCR
    try:
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = 50_000_000
        pt = _tesseract()
        from PIL import ImageOps
        img = Image.open(io.BytesIO(data))
        img.load()
        img = ImageOps.autocontrast(ImageOps.grayscale(img))  # helps tinted or low-contrast scans
        if img.width < 1600:
            f = min(3, 1600 / img.width)
            img = img.resize((int(img.width * f), int(img.height * f)), Image.LANCZOS)
        return pt.image_to_string(img, config="--psm 6").strip()
    except ExtractError:
        raise
    except Exception as e:
        if e.__class__.__name__ == "TesseractNotFoundError":
            raise ExtractError("Text recognition isn't set up: install Tesseract OCR (see the README) and restart the backend.")
        raise ExtractError("We couldn't read text from this image. Try a clearer or larger screenshot.")
