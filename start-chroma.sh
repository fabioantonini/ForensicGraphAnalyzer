#!/bin/bash

# Assicuriamoci che la directory chroma_data esista
mkdir -p chroma_data

# Avvia il server ChromaDB in background
python server/chroma-server.py &

# Salva il PID
echo $! > chroma.pid

echo "ChromaDB server avviato in background con PID $(cat chroma.pid)"
echo "I dati verranno salvati nella directory chroma_data"
echo "Per arrestare il server: kill $(cat chroma.pid)"
