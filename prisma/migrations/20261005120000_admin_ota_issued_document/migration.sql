-- REGRESSION-FREEZE[admin-ota-issued-archive]: OTA 발행 인보이스/바우처 + 원본 보관 — manifest

CREATE TABLE IF NOT EXISTS "AdminOtaIssuedDocument" (
    "id" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "provider" TEXT,
    "bookingRef" TEXT,
    "guestName" TEXT,
    "propertyName" TEXT,
    "amountUsd" DOUBLE PRECISION,
    "amountKrw" INTEGER,
    "rateDate" TEXT,
    "usdKrwRate" DOUBLE PRECISION,
    "parsedJson" TEXT NOT NULL,
    "draftJson" TEXT NOT NULL,
    "issuedHtml" TEXT NOT NULL,
    "htmlKo" TEXT,
    "htmlEn" TEXT,
    "sourceText" TEXT,
    "note" TEXT,
    "issuedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminOtaIssuedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminOtaIssuedDocumentFile" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminOtaIssuedDocumentFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminOtaIssuedDocument_documentKind_createdAt_idx"
  ON "AdminOtaIssuedDocument"("documentKind", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminOtaIssuedDocument_bookingRef_idx"
  ON "AdminOtaIssuedDocument"("bookingRef");

CREATE INDEX IF NOT EXISTS "AdminOtaIssuedDocument_documentNumber_idx"
  ON "AdminOtaIssuedDocument"("documentNumber");

CREATE INDEX IF NOT EXISTS "AdminOtaIssuedDocumentFile_documentId_idx"
  ON "AdminOtaIssuedDocumentFile"("documentId");

DO $$ BEGIN
  ALTER TABLE "AdminOtaIssuedDocumentFile"
    ADD CONSTRAINT "AdminOtaIssuedDocumentFile_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "AdminOtaIssuedDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
