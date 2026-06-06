-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('high_school', 'associate', 'bachelor', 'master', 'phd');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "education_level" "EducationLevel" NOT NULL,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "score_self_growth" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_users_city" ON "users"("city");

-- CreateIndex
CREATE INDEX "idx_users_score" ON "users"("score_self_growth");
