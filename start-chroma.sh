#!/bin/bash

echo "Starting ChromaDB in hybrid mode (client + server)..."

# Make sure the directory exists
mkdir -p chroma_data

# Fase 1: Inizializza e testa ChromaDB in modalità diretta (client persistente)
echo "Inizializzazione client persistente ChromaDB..."
python server/direct-chroma.py

# Se il test del client è fallito, esci
if [ $? -ne 0 ]; then
  echo "Failed to initialize ChromaDB persistent client"
  exit 1
fi

# Fase 2: Avvio del server HTTP per ChromaDB (necessario per client JS)
echo "Avvio server HTTP ChromaDB in background..."

# Prima verifica se il processo è già in esecuzione
if [ -f "chroma.pid" ]; then
  PID=$(cat chroma.pid)
  if ps -p $PID > /dev/null 2>&1; then
    echo "ChromaDB server is already running with PID $PID"
    exit 0
  else
    echo "Removing stale PID file"
    rm chroma.pid
  fi
fi

# Avvio del server in background
nohup python server/chroma-server.py > chroma-server.log 2>&1 &

# Salva il PID
echo $! > chroma.pid
echo "ChromaDB server avviato con PID $(cat chroma.pid)"

# Attendi 2 secondi per assicurarsi che il server si sia avviato
sleep 2

# Verifica dello stato del processo
if ps -p $(cat chroma.pid) > /dev/null; then
  echo "ChromaDB server running successfully"
else
  echo "Failed to start ChromaDB server"
  exit 1
fi
