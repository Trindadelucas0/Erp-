-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "nomeVenda" TEXT NOT NULL,
    "marca" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    "caracteristicas" TEXT,
    "flagEntrega" BOOLEAN NOT NULL DEFAULT false,
    "flagDevolucao" BOOLEAN NOT NULL DEFAULT false,
    "controlaEstoque" BOOLEAN NOT NULL DEFAULT true,
    "flagComissao" BOOLEAN NOT NULL DEFAULT false,
    "permiteEstoqueNegativo" BOOLEAN NOT NULL DEFAULT false,
    "codigoBarras" TEXT,
    "pesoKg" DECIMAL(15,4),
    "alturaCm" DECIMAL(10,2),
    "larguraCm" DECIMAL(10,2),
    "comprimentoCm" DECIMAL(10,2),
    "embalagemMaster" TEXT,
    "pallet" TEXT,
    "enderecoWms" TEXT,
    "nomeCompra" TEXT,
    "fornecedorPessoaId" TEXT,
    "codigoFornecedor" TEXT,
    "multiploEntrada" DECIMAL(15,4),
    "unidadeEntrada" TEXT,
    "ncm" TEXT,
    "codigoOrigem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoFoto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "larguraPx" INTEGER,
    "alturaPx" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fornecedorPessoaId" TEXT NOT NULL,
    "transportadoraPessoaId" TEXT,
    "modalidadeTransporte" TEXT,
    "condicaoPagamento" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "observacoes" TEXT,
    "copiadoDeId" TEXT,
    "pedidoVendaId" TEXT,
    "creditoAplicado" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompraItem" (
    "id" TEXT NOT NULL,
    "pedidoCompraId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(15,4) NOT NULL,
    "unidade" TEXT NOT NULL,
    "precoUnitario" DECIMAL(15,4) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PedidoCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditoFornecedor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fornecedorPessoaId" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "saldo" DECIMAL(15,2) NOT NULL,
    "origem" TEXT,
    "vencimento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditoFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendenciaFornecedor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fornecedorPessoaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "produtoId" TEXT,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendenciaFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produto_sku_companyId_key" ON "Produto"("sku", "companyId");

-- CreateIndex
CREATE INDEX "Produto_companyId_ativo_idx" ON "Produto"("companyId", "ativo");

-- CreateIndex
CREATE INDEX "Produto_companyId_nomeVenda_idx" ON "Produto"("companyId", "nomeVenda");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoFoto_produtoId_tipo_key" ON "ProdutoFoto"("produtoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoCompra_companyId_numero_key" ON "PedidoCompra"("companyId", "numero");

-- CreateIndex
CREATE INDEX "PedidoCompra_companyId_fornecedorPessoaId_status_idx" ON "PedidoCompra"("companyId", "fornecedorPessoaId", "status");

-- CreateIndex
CREATE INDEX "CreditoFornecedor_companyId_fornecedorPessoaId_idx" ON "CreditoFornecedor"("companyId", "fornecedorPessoaId");

-- CreateIndex
CREATE INDEX "PendenciaFornecedor_companyId_fornecedorPessoaId_resolvido_idx" ON "PendenciaFornecedor"("companyId", "fornecedorPessoaId", "resolvido");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_fornecedorPessoaId_fkey" FOREIGN KEY ("fornecedorPessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFoto" ADD CONSTRAINT "ProdutoFoto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorPessoaId_fkey" FOREIGN KEY ("fornecedorPessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_transportadoraPessoaId_fkey" FOREIGN KEY ("transportadoraPessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_copiadoDeId_fkey" FOREIGN KEY ("copiadoDeId") REFERENCES "PedidoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompraItem" ADD CONSTRAINT "PedidoCompraItem_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompraItem" ADD CONSTRAINT "PedidoCompraItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditoFornecedor" ADD CONSTRAINT "CreditoFornecedor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditoFornecedor" ADD CONSTRAINT "CreditoFornecedor_fornecedorPessoaId_fkey" FOREIGN KEY ("fornecedorPessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendenciaFornecedor" ADD CONSTRAINT "PendenciaFornecedor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendenciaFornecedor" ADD CONSTRAINT "PendenciaFornecedor_fornecedorPessoaId_fkey" FOREIGN KEY ("fornecedorPessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendenciaFornecedor" ADD CONSTRAINT "PendenciaFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
