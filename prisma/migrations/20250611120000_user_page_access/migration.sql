-- CreateTable
CREATE TABLE "UserPageAccess" (
    "userId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,

    CONSTRAINT "UserPageAccess_pkey" PRIMARY KEY ("userId","pageKey")
);

-- AddForeignKey
ALTER TABLE "UserPageAccess" ADD CONSTRAINT "UserPageAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
