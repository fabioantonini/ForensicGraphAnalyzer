#!/usr/bin/env python3

import os
import logging
import chromadb
import uvicorn

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
    
    # Nuova configurazione secondo documentazione aggiornata
    # https://docs.trychroma.com/deployment
    from chromadb.server import Server
    
    server = Server(
        host="0.0.0.0",
        port=8000,
        cors_allow_origins=["*"],
        telemetry_enabled=False,
        persistent_directory=persistence_directory
    )
    
    server.run()
