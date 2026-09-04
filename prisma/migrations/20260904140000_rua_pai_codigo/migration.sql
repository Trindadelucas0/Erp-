-- Vínculo da rua com uma área (código único da rua na empresa).
ALTER TABLE "NivelEnderecoWms" ADD COLUMN "paiCodigo" TEXT;

CREATE INDEX "NivelEnderecoWms_companyId_nivel_paiCodigo_idx" ON "NivelEnderecoWms"("companyId", "nivel", "paiCodigo");
