# settings.py
"""
Central configuration for the Mood-O-Meter backend (NeuroNest DemoApp template).

Values below are the credentials provided by the NeuroNest team for this sandbox.
Everything can be overridden via a `.env` file (see Config.env_file) or real
environment variables — never hardcode secrets outside of this sandbox context.
"""

from pydantic_settings import BaseSettings
from urllib.parse import quote_plus


class Settings(BaseSettings):
    ENV: str = "dev"
    APP_NAME: str = "DemoApp"

    # ------------------------------------------------------------------
    # LLM configuration (NeuroVerse — OpenAI-compatible chat completions)
    # ------------------------------------------------------------------
    # Used to generate the natural-language "AI Insights" narrative on the
    # admin dashboard (Executive Summary + attrition commentary). All calls
    # gracefully fall back to rule-based text if the LLM is unreachable.
    openai_api_base: str = "https://neuroverse.tatamotors.com/monitoring_v2/v1"
    openai_api_key: str = "sk-Ev4x7K370ieEsT-dJ6pDJg"
    model_name_llm: str = "neuroverse-meta-llama--Llama-3.1-8B-Instruct"
    llm_request_timeout_seconds: float = 20.0

    # ------------------------------------------------------------------
    # MongoDB — primary datastore (users, departments, check-ins, events)
    # ------------------------------------------------------------------
    mongo_host: str = "172.22.95.31"
    mongo_port: int = 27017
    mongo_username: str = "IDP_Platform_DB_Admin"
    mongo_password: str = "srujan-S6L9Q4-mongo@neuroverse"
    mongo_db_name: str = "IDP_Platform_DB"

    # Collections within mongo_db_name, namespaced per-app so multiple
    # NeuroNest apps can safely share one physical database.
    users_collection: str = "moodometer_users"
    departments_collection: str = "moodometer_departments"
    checkins_collection: str = "moodometer_checkins"
    events_collection: str = "moodometer_events"

    # ------------------------------------------------------------------
    # Milvus — reserved for future semantic search over HR policy /
    # engagement-survey documents. Mood-O-Meter's core features (pulse
    # checks, dashboards, attrition scoring) are fully structured-data
    # driven and do not require vector search, so this is unused today
    # but kept wired up per the NeuroNest template convention.
    # ------------------------------------------------------------------
    milvus_base: str = "http://172.22.95.31"
    milvus_port: str = "19530"
    milvus_user: str = "IDP_Platform_Admin"
    milvus_password: str = "Srujan-S6L9Q4-milvus@neuroverse"
    vector_db_name: str = "IDP_Platform_DB"
    collection_name: str = "moodometer_hr_docs"

    class Config:
        env_file = ".env"  # pydantic-settings will read the env-file passed by docker compose
        env_file_encoding = "utf-8"
        protected_namespaces = ("settings_",)

    @property
    def MONGO_URI(self) -> str:
        """Build the Mongo connection string dynamically."""
        pwd = quote_plus(self.mongo_password or "")
        user = quote_plus(self.mongo_username or "")
        host_port = f"{self.mongo_host}:{self.mongo_port}"
        return f"mongodb://{user}:{pwd}@{host_port}/{self.mongo_db_name}?authSource={self.mongo_db_name}"


# single shared settings instance
settings = Settings()
