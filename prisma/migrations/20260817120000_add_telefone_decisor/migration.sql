-- AddColumn telefoneDecisor to negociacoes
ALTER TABLE "negociacoes" ADD COLUMN "telefoneDecisor" VARCHAR(20);

-- Add index for telefoneDecisor para queries de retargetização
CREATE INDEX "negociacoes_telefoneDecisor_idx" ON "negociacoes"("telefoneDecisor");
