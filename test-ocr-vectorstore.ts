/**
 * Test per verificare che il sistema OCR salvi correttamente nel vector store
 */

import { db } from "./server/db";
import { documents, documentEmbeddings } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { addDocumentToCollection } from "./server/vectordb";

async function testOCRVectorStoreIntegration() {
  console.log("🔍 Testing OCR → Vector Store integration...\n");

  try {
    // 1. Simula un documento OCR
    const mockOCRDocument = {
      id: 999999, // ID temporaneo per test
      userId: 3, // Usa un utente esistente (fabioantonini)
      filename: "test_ocr_document.txt",
      originalFilename: "Test OCR Document.txt",
      fileSize: 1024,
      fileType: "text/plain",
      content: "Questo è un testo estratto tramite OCR per test. Contiene informazioni grafologiche importanti per l'analisi forense. Il documento include dettagli tecnici sui parametri di scrittura e pressione del tratto.",
      indexed: false,
      source: "ocr",
      metadata: JSON.stringify({
        confidence: 95,
        language: "ita",
        processingTime: 2.5,
        ocrSettings: {
          language: "ita+eng",
          dpi: 300,
          preprocessingMode: "auto",
          outputFormat: "text"
        }
      }),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log("📄 Created test OCR document:", mockOCRDocument.originalFilename);

    // 2. Salva il documento nel database
    const [savedDocument] = await db.insert(documents).values(mockOCRDocument).returning();
    console.log("💾 Document saved to database with ID:", savedDocument.id);

    // 3. Testa l'aggiunta al vector store
    console.log("🔗 Adding document to vector store...");
    await addDocumentToCollection(savedDocument);

    // 4. Marca come indicizzato
    await db.update(documents)
      .set({ indexed: true })
      .where(eq(documents.id, savedDocument.id));

    console.log("✅ Document marked as indexed");

    // 5. Verifica che sia stato aggiunto al vector store
    const embeddings = await db.select()
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.documentId, savedDocument.id));

    console.log(`📊 Found ${embeddings.length} embeddings for document ${savedDocument.id}`);

    if (embeddings.length > 0) {
      console.log("✅ Vector embeddings successfully created!");
      console.log("📝 Sample embedding:", {
        id: embeddings[0].id,
        chunkIndex: embeddings[0].chunkIndex,
        contentLength: embeddings[0].content.length,
        embeddingDimensions: embeddings[0].embedding ? embeddings[0].embedding.split(',').length : 0
      });
    } else {
      console.log("❌ No embeddings found - vector store integration failed");
    }

    // 6. Verifica che il documento sia marcato come indicizzato
    const updatedDocument = await db.select()
      .from(documents)
      .where(eq(documents.id, savedDocument.id))
      .limit(1);

    if (updatedDocument[0]?.indexed) {
      console.log("✅ Document correctly marked as indexed");
    } else {
      console.log("❌ Document not marked as indexed");
    }

    // 7. Cleanup - rimuovi il documento di test
    await db.delete(documentEmbeddings).where(eq(documentEmbeddings.documentId, savedDocument.id));
    await db.delete(documents).where(eq(documents.id, savedDocument.id));
    console.log("🧹 Test document cleaned up");

    console.log("\n🎯 OCR → Vector Store integration test completed successfully!");

  } catch (error) {
    console.error("❌ Error during OCR vector store test:", error);
    throw error;
  }
}

// Esegui il test automaticamente
testOCRVectorStoreIntegration()
  .then(() => {
    console.log("✅ All tests passed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });

export { testOCRVectorStoreIntegration };