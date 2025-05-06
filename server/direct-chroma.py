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

# Configurazione client ChromaDB con persistenza
client = chromadb.PersistentClient(path=persistence_directory)

# Test di funzionalità
# Crea una collection di test
test_collection = client.get_or_create_collection(name="test_collection")

# Aggiungi un documento di test
test_collection.add(
    documents=["This is a test document"],
    metadatas=[{"source": "test"}],
    ids=["test1"]
)

# Verifica che il documento sia stato aggiunto correttamente
result = test_collection.get(ids=["test1"])
logger.info(f"Test documento: {result}")

# Verifica la ricerca
query_results = test_collection.query(
    query_texts=["test document"],
    n_results=1
)
logger.info(f"Test query: {query_results}")

logger.info("ChromaDB persistente inizializzato e testato con successo!")
logger.info("Usando direttamente il client persistente nel codice dell'applicazione.")
