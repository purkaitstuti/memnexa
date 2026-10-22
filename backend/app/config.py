from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    secret_key: str = "dev-only-change-me"
    database_url: str = "sqlite:///./memnexa.db"
    frontend_origin: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    cookie_secure: bool = False
    google_client_id: str = ""
    google_client_secret: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4:e2b"
    session_days: int = 14
    max_upload_mb: int = 10
    tesseract_cmd: str = ""


settings = Settings()
