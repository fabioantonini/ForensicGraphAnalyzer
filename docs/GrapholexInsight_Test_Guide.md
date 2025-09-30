# GrapholexInsight - Guida Completa di Test

## Informazioni Generali
**Applicazione**: GrapholexInsight - Sistema di Analisi Grafologica Forense  
**Versione**: v2024.1  
**URL di Test**: [Inserire URL dell'applicazione]  
**Data**: [Data di esecuzione test]  
**Tester**: [Nome del collaboratore]

---

## Checklist di Test Completa

### 1. AUTENTICAZIONE E ACCESSO

#### 1.1 Registrazione Nuovo Utente
- [ ] Accedere alla pagina di registrazione
- [ ] Inserire dati validi: username, email, password, conferma password
- [ ] Verificare che la registrazione avvenga con successo
- [ ] Controllare messaggio di benvenuto
- [ ] **Test negativo**: Provare con email già esistente
- [ ] **Test negativo**: Provare con password non corrispondenti

#### 1.2 Login
- [ ] Accedere con credenziali valide
- [ ] Verificare reindirizzamento alla dashboard
- [ ] **Test negativo**: Provare con credenziali errate
- [ ] Verificare messaggio di errore appropriato

#### 1.3 Logout
- [ ] Effettuare logout dalla dashboard
- [ ] Verificare che la sessione sia terminata
- [ ] Tentare di accedere a pagine protette dopo logout

---

### 2. DASHBOARD E NAVIGAZIONE

#### 2.1 Dashboard Principale
- [ ] Verificare caricamento corretto della dashboard
- [ ] Controllare presenza di tutte le sezioni:
  - Statistiche documenti
  - Statistiche query
  - Utilizzo storage
  - Raccomandazioni AI
- [ ] Verificare che i numeri nelle statistiche siano corretti
- [ ] Testare link di navigazione rapida

#### 2.2 Menu di Navigazione
- [ ] Testare navigazione a "Libreria Documenti"
- [ ] Testare navigazione a "OCR Documenti"
- [ ] Testare navigazione a "Ricerca Semantica"
- [ ] Testare navigazione a "Analisi Firme"
- [ ] Testare navigazione a "Anonimizzazione"
- [ ] Testare navigazione a "Wake Up Quiz"
- [ ] Verificare highlight della pagina corrente

#### 2.3 Internazionalizzazione
- [ ] Cambiare lingua da Italiano a Inglese
- [ ] Verificare che tutti i testi si aggiornino
- [ ] Cambiare da Inglese a Italiano
- [ ] Controllare che la preferenza si mantenga al ricaricamento

---

### 3. GESTIONE DOCUMENTI

#### 3.1 Upload Documenti - Test Positivi
- [ ] Caricare un file PDF (< 25MB)
- [ ] Caricare un file DOCX
- [ ] Caricare un file TXT
- [ ] Caricare un file HTML
- [ ] Verificare che la progress bar si mostri durante l'upload
- [ ] Controllare che il documento appaia nella lista
- [ ] Verificare status "Indexed" dopo il processamento

#### 3.2 Upload Documenti - Test Negativi
- [ ] Tentare upload file > 25MB
- [ ] Verificare messaggio di errore per file troppo grande
- [ ] Tentare upload formato non supportato (es. .exe)
- [ ] Verificare messaggio di errore per formato non valido

#### 3.3 Controllo Duplicati
- [ ] Caricare un documento
- [ ] Tentare di caricare lo stesso documento
- [ ] Verificare che appaia immediatamente l'avviso di duplicato
- [ ] Controllare che il pulsante upload sia disabilitato
- [ ] Rinominare il file e riprovare l'upload
- [ ] Verificare che venga rilevato come duplicato simile

#### 3.4 Import da URL
- [ ] Utilizzare la tab "Import from URL"
- [ ] Inserire URL valido (es. pagina Wikipedia)
- [ ] Verificare che il contenuto venga importato
- [ ] **Test negativo**: Inserire URL non valido
- [ ] **Test negativo**: Inserire URL non raggiungibile

#### 3.5 Gestione Lista Documenti
- [ ] Verificare visualizzazione lista documenti
- [ ] Testare cambio vista da lista a griglia
- [ ] Utilizzare filtri per tipo file
- [ ] Utilizzare filtri per data
- [ ] Testare ricerca per nome documento
- [ ] Ordinare documenti per nome, data, dimensione

#### 3.6 Eliminazione Documenti
- [ ] Selezionare un documento per l'eliminazione
- [ ] Confermare eliminazione
- [ ] Verificare che il documento sia rimosso dalla lista
- [ ] Verificare aggiornamento delle statistiche

---

### 4. SISTEMA OCR

#### 4.1 OCR Base - Immagini
- [ ] Caricare un'immagine con testo chiaro (JPEG/PNG)
- [ ] Verificare estrazione testo corretta
- [ ] Controllare indicatore di confidenza
- [ ] Verificare tempo di processamento
- [ ] Testare con immagine di qualità diversa

#### 4.2 OCR Avanzato - PDF Scansionato
- [ ] Caricare PDF scansionato
- [ ] Testare modalità "Automatico"
- [ ] Testare modalità "Migliora Contrasto"
- [ ] Testare modalità "Aumenta Nitidezza"
- [ ] Testare modalità "Riduci Rumore"
- [ ] Confrontare risultati delle diverse modalità

#### 4.3 OCR Modalità Completa
- [ ] Caricare documento con 20+ pagine
- [ ] Attivare modalità "Completa"
- [ ] Verificare indicatore di progresso con percentuale
- [ ] Controllare stima tempo rimanente
- [ ] Testare interruzione durante processamento
- [ ] Verificare gestione documenti molto grandi

#### 4.4 Controlli Duplicati OCR
- [ ] Processare un PDF tramite OCR
- [ ] Tentare di caricare lo stesso PDF nella sezione documenti
- [ ] Verificare rilevamento duplicato intelligente
- [ ] Controllare messaggio che indica processamento OCR precedente

#### 4.5 Salvataggio nella Base di Conoscenza
- [ ] Completare processamento OCR
- [ ] Verificare opzione "Salva nella base di conoscenza"
- [ ] Confermare salvataggio
- [ ] Controllare che il documento appaia nella libreria
- [ ] Verificare indicizzazione automatica per ricerca semantica

---

### 5. RICERCA SEMANTICA (RAG)

#### 5.1 Query di Base
- [ ] Inserire query semplice (es. "firma falsa")
- [ ] Verificare che vengano restituiti risultati pertinenti
- [ ] Controllare riferimenti ai documenti fonte
- [ ] Verificare punteggi di rilevanza

#### 5.2 Query Complesse
- [ ] Testare query con termini tecnici grafologici
- [ ] Provare domande in linguaggio naturale
- [ ] Testare query multilingue (italiano/inglese)
- [ ] Verificare qualità delle risposte generate

#### 5.3 Filtri e Opzioni
- [ ] Utilizzare filtri per documenti specifici
- [ ] Testare filtro per data documento
- [ ] Provare diverse soglie di rilevanza
- [ ] Verificare ordinamento risultati

#### 5.4 Storico Query
- [ ] Eseguire multiple query
- [ ] Verificare che vengano salvate nello storico
- [ ] Testare ricerca nello storico
- [ ] Verificare possibilità di ripetere query precedenti

---

### 6. ANALISI FIRME

#### 6.1 Creazione Progetto
- [ ] Creare nuovo progetto di analisi firme
- [ ] Inserire nome e descrizione progetto
- [ ] Impostare DPI appropriato (300-600)
- [ ] Salvare progetto

#### 6.2 Upload Firme
- [ ] Caricare firma di riferimento (alta qualità)
- [ ] Caricare firma da verificare
- [ ] Verificare preview delle immagini
- [ ] Controllare informazioni file (dimensioni, formato)

#### 6.3 Cropping Automatico
- [ ] Utilizzare strumento di ritaglio automatico
- [ ] Verificare rilevamento automatico dei bordi
- [ ] Regolare manualmente se necessario
- [ ] Confermare ritaglio

#### 6.4 Calibrazione DPI
- [ ] Utilizzare strumento di calibrazione
- [ ] Impostare riferimento millimetrico
- [ ] Verificare calcolo DPI automatico
- [ ] Salvare calibrazione

#### 6.5 Analisi Parametri
- [ ] Avviare analisi automatica
- [ ] Verificare estrazione di tutti i 21 parametri:
  - Dimensioni (altezza, larghezza, area)
  - Spessori (minimo, massimo, medio)
  - Pressione (variazioni, intensità)
  - Velocità (stimata)
  - Inclinazione (angoli)
  - Curvature (variazioni direzionali)
  - Altri parametri specifici
- [ ] Controllare unità di misura (mm, gradi, etc.)

#### 6.6 Comparazione
- [ ] Eseguire comparazione tra firme
- [ ] Verificare calcolo compatibilità
- [ ] Controllare soglie di autenticità:
  - ≥85% (autentica)
  - 65-84% (probabilmente autentica)  
  - <65% (sospetta)
- [ ] Verificare grafici di comparazione

#### 6.7 Report PDF
- [ ] Generare report PDF completo
- [ ] Verificare presenza di:
  - Informazioni progetto
  - Immagini firme analizzate
  - Tabelle parametri
  - Grafici comparativi
  - Conclusioni AI
  - Metadata tecnici
- [ ] Controllare qualità formattazione
- [ ] Testare download del report

---

### 7. ANONIMIZZAZIONE DOCUMENTI

#### 7.1 Upload per Anonimizzazione
- [ ] Caricare documento contenente dati sensibili
- [ ] Verificare supporto formati (PDF, DOCX, TXT)
- [ ] Controllare preview del documento originale

#### 7.2 Rilevamento Automatico Entità
- [ ] Avviare processo di anonimizzazione
- [ ] Verificare rilevamento automatico di:
  - Nomi di persona
  - Indirizzi
  - Numeri di telefono
  - Email
  - Codici fiscali
  - Numeri di carta di credito
  - Date di nascita
  - Altri dati sensibili (13 categorie totali)
- [ ] Controllare evidenziazione entità rilevate

#### 7.3 Personalizzazione Anonimizzazione
- [ ] Modificare entità selezionate per anonimizzazione
- [ ] Escludere alcune categorie
- [ ] Aggiungere entità personalizzate
- [ ] Verificare anteprima delle modifiche

#### 7.4 Generazione Documento Anonimizzato
- [ ] Completare processo anonimizzazione
- [ ] Verificare che tutte le entità selezionate siano sostituite
- [ ] Controllare coerenza del documento risultante
- [ ] Testare download del documento anonimizzato
- [ ] Verificare mantenimento formattazione originale

---

### 8. WAKE UP QUIZ

#### 8.1 Avvio Quiz
- [ ] Accedere alla sezione Wake Up Quiz
- [ ] Leggere informazioni introduttive
- [ ] Avviare nuovo quiz
- [ ] Verificare caricamento prima domanda

#### 8.2 Tipologie Domande
- [ ] Verificare presenza domande di grafologia
- [ ] Testare domande di cultura generale
- [ ] Controllare varietà delle tipologie:
  - Domande a risposta multipla
  - Domande vero/falso
  - Domande aperte
- [ ] Verificare qualità e accuratezza contenuti

#### 8.3 Sistema Anti-Ripetizione
- [ ] Completare un quiz
- [ ] Avviare immediatamente un nuovo quiz
- [ ] Verificare che le domande siano diverse
- [ ] Ripetere test per verificare varietà

#### 8.4 Multilingua
- [ ] Testare quiz in italiano
- [ ] Cambiare lingua e testare quiz in inglese
- [ ] Verificare coerenza traduzioni
- [ ] Controllare mantenimento progresso

#### 8.5 Tracciamento Progresso
- [ ] Completare multiple sessioni quiz
- [ ] Verificare salvataggio punteggi
- [ ] Controllare statistiche personali
- [ ] Testare reset progresso se disponibile

---

### 9. PRESTAZIONI E AFFIDABILITÀ

#### 9.1 Test di Carico
- [ ] Caricare simultaneamente più documenti
- [ ] Eseguire multiple query contemporaneamente
- [ ] Verificare tempi di risposta accettabili
- [ ] Controllare stabilità durante uso intensivo

#### 9.2 Gestione Errori
- [ ] Testare comportamento con connessione lenta
- [ ] Simulare interruzione di rete durante upload
- [ ] Verificare messaggi di errore appropriati
- [ ] Controllare possibilità di ripresa operazioni

#### 9.3 Compatibilità Browser
- [ ] Testare su Chrome
- [ ] Testare su Firefox  
- [ ] Testare su Safari (se disponibile)
- [ ] Testare su Edge
- [ ] Verificare responsive design su mobile

---

### 10. SICUREZZA E PRIVACY

#### 10.1 Gestione Sessioni
- [ ] Verificare timeout automatico sessione
- [ ] Testare comportamento dopo inattività prolungata
- [ ] Controllare impossibilità accesso senza autenticazione

#### 10.2 Protezione Dati
- [ ] Verificare che i documenti siano visibili solo al proprietario
- [ ] Testare isolamento tra utenti diversi
- [ ] Controllare sicurezza download/upload

---

## CRITERI DI SUCCESSO

### Funzionalità Critiche (Devono Funzionare Perfettamente)
- [ ] Autenticazione utente
- [ ] Upload e gestione documenti
- [ ] Sistema OCR con tutte le modalità
- [ ] Ricerca semantica con risultati pertinenti
- [ ] Analisi firme completa con report PDF
- [ ] Controllo duplicati intelligente

### Funzionalità Importanti (Devono Funzionare Bene)
- [ ] Anonimizzazione documenti
- [ ] Wake Up Quiz
- [ ] Interfaccia multilingue
- [ ] Gestione errori

### Funzionalità Desiderabili (Possono Avere Problemi Minori)
- [ ] Ottimizzazioni performance
- [ ] Dettagli estetici
- [ ] Funzionalità avanzate

---

## REPORT BUGS E PROBLEMI

**Formato per segnalazione bug:**

**ID Bug**: [Numero progressivo]  
**Priorità**: [Alta/Media/Bassa]  
**Sezione**: [Area dell'applicazione]  
**Descrizione**: [Descrizione dettagliata del problema]  
**Passi per riprodurre**:
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

**Risultato atteso**: [Cosa dovrebbe succedere]  
**Risultato attuale**: [Cosa succede invece]  
**Browser**: [Chrome/Firefox/Safari/Edge + versione]  
**Screenshot**: [Se applicabile]

---

## NOTE FINALI

- Completare tutti i test in sequenza
- Documentare qualsiasi comportamento anomalo
- Testare sia scenari normali che casi limite
- Verificare usabilità da punto di vista utente finale
- Prestare attenzione a tempi di caricamento e fluidità
- Segnalare immediatamente problemi di sicurezza

**Data completamento test**: _______________  
**Firma tester**: _______________  
**Risultato complessivo**: [ ] SUPERATO [ ] PARZIALE [ ] NON SUPERATO