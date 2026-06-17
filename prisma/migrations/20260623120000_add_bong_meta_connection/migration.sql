-- PR 7: Meta Graph API OAuth 토큰 저장 (운영자 단일 연결)
CREATE TABLE "BongMetaConnection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'meta',
    "userAccessToken" TEXT NOT NULL,
    "userTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "pageId" TEXT,
    "pageName" TEXT,
    "pageAccessToken" TEXT,
    "instagramBusinessId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongMetaConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BongMetaConnection_provider_key" ON "BongMetaConnection"("provider");
