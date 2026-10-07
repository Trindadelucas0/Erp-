-- CreateTable
CREATE TABLE "RolePageAccess" (
    "roleId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,

    CONSTRAINT "RolePageAccess_pkey" PRIMARY KEY ("roleId","pageKey")
);

-- CreateTable
CREATE TABLE "RoleTabAccess" (
    "roleId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "tabKey" TEXT NOT NULL,

    CONSTRAINT "RoleTabAccess_pkey" PRIMARY KEY ("roleId","pageKey","tabKey")
);

-- AddForeignKey
ALTER TABLE "RolePageAccess" ADD CONSTRAINT "RolePageAccess_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTabAccess" ADD CONSTRAINT "RoleTabAccess_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
