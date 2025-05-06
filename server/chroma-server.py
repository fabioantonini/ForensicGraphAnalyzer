#!/usr/bin/env python3

import os
import logging
import chromadb
from chromadb.config import Settings
import uvicorn
from chromadb.server import FastAPI

# Configurazione del logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_app():
    # Directory di persistenza
    persistence_directory = os.path.join(os.getcwd(), 'chroma_data')
    os.makedirs(persistence_directory, exist_ok=True)
    
    logger.info(f"Inizializzazione ChromaDB con persistenza in: {persistence_directory}")
    
    # Configurazione del client ChromaDB con persistenza
    settings = Settings(
        chroma_api_impl="chromadb.api.segment.SegmentAPI",
        chroma_sysdb_impl="chromadb.db.impl.sqlite.SqliteDB",
        chroma_producer_impl="chromadb.db.impl.sqlite.SqliteDB",
        chroma_consumer_impl="chromadb.db.impl.sqlite.SqliteDB",
        chroma_segment_manager_impl="chromadb.segment.impl.manager.local.LocalSegmentManager",
        allow_reset=True,
        is_persistent=True,
        persist_directory=persistence_directory,
    )
    
    # Configurazione del server
    app = FastAPI(
        settings=settings
    ).app
    
    return app

if __name__ == "__main__":
    logger.info("Avvio server ChromaDB...")
    # Porta 8000 per evitare conflitti con l'app principale su 5000
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
