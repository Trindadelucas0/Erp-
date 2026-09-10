-- Vínculo da rua com um local (código único da rua na empresa).
ALTER TABLE "NivelEnderecoWms" ADD COLUMN "localCodigo" TEXT;

CREATE INDEX "NivelEnderecoWms_companyId_nivel_localCodigo_idx" ON "NivelEnderecoWms"("companyId", "nivel", "localCodigo");
