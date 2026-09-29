-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundSource" AS ENUM ('AUTOMATED', 'AGENT', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEEDS_INFO', 'APPROVED', 'DENIED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ReasonCategory" AS ENUM ('DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'CHANGED_MIND', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "RequestFlag" AS ENUM ('HUMAN_REQUESTED', 'MANIPULATION', 'EXTRACTION_FAILED', 'CROSS_ACCOUNT', 'CLAIM_MISMATCH', 'HIGH_VALUE', 'FAIR_USE', 'UNCONFIGURED_CURRENCY');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('CUSTOMER', 'ASSISTANT', 'STAFF');

-- CreateEnum
CREATE TYPE "AuditKind" AS ENUM ('AUTOMATED', 'HANDOFF', 'STAFF_RESOLUTION');

-- CreateEnum
CREATE TYPE "ReplySource" AS ENUM ('MODEL', 'TEMPLATE');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "finalSale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "refundRequestId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "source" "RefundSource" NOT NULL,
    "issuedById" TEXT,
    "issuedByName" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "reference" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "amountMinor" INTEGER,
    "currency" CHAR(3),
    "reasonCategory" "ReasonCategory",
    "flags" "RequestFlag"[] DEFAULT ARRAY[]::"RequestFlag"[],
    "decisiveRule" TEXT,
    "summary" TEXT,
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_audits" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" "AuditKind" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "inputText" TEXT,
    "signals" JSONB,
    "extraction" JSONB,
    "extractionError" TEXT,
    "facts" JSONB,
    "ruleTrace" JSONB,
    "outcome" "RequestStatus" NOT NULL,
    "decisiveRule" TEXT,
    "reply" TEXT,
    "replySource" "ReplySource",
    "llmMode" TEXT,
    "model" TEXT,
    "latencyMs" INTEGER,
    "usage" JSONB,
    "policyVersion" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_orderId_sku_key" ON "order_items"("orderId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_orderItemId_key" ON "refunds"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_refundRequestId_key" ON "refunds"("refundRequestId");

-- CreateIndex
CREATE INDEX "refunds_customerId_issuedAt_idx" ON "refunds"("customerId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_reference_key" ON "refund_requests"("reference");

-- CreateIndex
CREATE INDEX "refund_requests_status_createdAt_idx" ON "refund_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "refund_requests_customerId_createdAt_idx" ON "refund_requests"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "request_messages_requestId_createdAt_idx" ON "request_messages"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "decision_audits_requestId_createdAt_idx" ON "decision_audits"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "refund_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_messages" ADD CONSTRAINT "request_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "refund_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_audits" ADD CONSTRAINT "decision_audits_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "refund_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
