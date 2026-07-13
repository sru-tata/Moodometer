"""vector_database_creation.py

Reserved for future use. Mood-O-Meter's core features (weekly pulse checks,
department heat maps, attrition scoring, CSV exports) are entirely
structured-data driven and do not require embeddings or vector search, so
this file is currently a no-op.

Kept here per the NeuroNest DemoApp template convention (settings.py /
db_manager.py / vector_database_creation.py) so that if a future feature
needs semantic search over HR policy documents or open-text survey
responses, the wiring already matches the standard pattern used across
NeuroNest apps — just drop pymilvus into requirements.txt and fill this in.

Example of what this would look like once needed:

    from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType
    from settings import settings

    def connect():
        connections.connect(
            alias="default",
            host=settings.milvus_base.replace("http://", "").replace("https://", ""),
            port=settings.milvus_port,
            user=settings.milvus_user,
            password=settings.milvus_password,
        )

    def create_collection():
        ...  # define schema, create settings.collection_name in settings.vector_db_name
"""

from settings import settings


def status() -> dict:
    return {
        "configured": bool(settings.milvus_user and settings.milvus_password),
        "collection_name": settings.collection_name,
        "vector_db_name": settings.vector_db_name,
        "note": "Not required for Mood-O-Meter's current feature set — reserved for future semantic search.",
    }


if __name__ == "__main__":
    print(status())
