-- PR 7: 인사이트 기반 후킹 자동 학습 임계값 (운영자 설정)
CREATE TABLE "BongHookLearnConfig" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL DEFAULT 'default',
    "topPercentile" INTEGER NOT NULL DEFAULT 20,
    "bottomPercentile" INTEGER NOT NULL DEFAULT 20,
    "minSampleSize" INTEGER NOT NULL DEFAULT 20,
    "lookbackDays" INTEGER NOT NULL DEFAULT 90,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongHookLearnConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BongHookLearnConfig_configKey_key" ON "BongHookLearnConfig"("configKey");
