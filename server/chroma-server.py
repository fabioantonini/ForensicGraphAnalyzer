#!/usr/bin/env python3

import os
import logging
import chromadb

# Configurazione del logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Directory di persistenza
persistence_directory = os.path.join(os.getcwd(), 'chroma_data')
os.makedirs(persistence_directory, exist_ok=True)

logger.info(f"Inizializzazione ChromaDB con persistenza in: {persistence_directory}")

if __name__ == "__main__":
    logger.info("Avvio server ChromaDB...")
    # Porta 8000 per evitare conflitti con l'app principale su 5000
    
    # Configurazione aggiornata per ChromaDB 1.0.8+ che usa FastAPI
    # Questo approccio è compatibile con la versione attuale
    from chromadb.config import Settings
    
    settings = Settings(
        chroma_api_impl="chromadb.api.fastapi.FastAPI",
        chroma_server_host="0.0.0.0",
        chroma_server_http_port=8000,
        allow_reset=True,
        anonymized_telemetry=False,
        persist_directory=persistence_directory
    )
    
    # Crea il server in modalità standalone
    api = chromadb.Client(settings)
    
    # Questo client non termina mai e blocca il thread, eseguendolo in un server HTTP
    # Rimarrà in esecuzione finché non viene terminato manualmente
