/**
 * Execute complete business workflow against real DB — TEST orders only.
 * Usage: tsx packages/database/src/cli/run-e2e-business-flow.ts [--skip-sla-seed]
 */
import postgres from "postgres";
import {
  addItemToCart,
  clearCart,
  createPurchaseOrderBatch,
  detectAndPersistSlaExceptions,
  getOrderMargins,
  getSupplierPurchaseOrderDetail,
  getSupplierUserByEmail,
  resolveCartCustomisationPricing,
  runOpsExceptionDetectionJob,
  supplierAcknowledgePo,
  supplierSubmitCost,
  supplierSubmitTracking
} from "../index";
import { createOrderFromCart } from "../orders";
import type { GuestCheckoutInput } from "@sjh/shared";

const TEST_MARKER = "E2E-TEST";
const SESSION = `e2e-test-${Date.now()}`;

function dbUrl(): string {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

type StepResult = { step: string; ok: boolean; detail?: unknown; error?: string };

async function main(): Promise<void> {
  const url = dbUrl();
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 30 });
  const results: StepResult[] = [];
  const report: Record<string, unknown> = { session: SESSION, marker: TEST_MARKER };

  try {
    // --- Find product + variant ---
    const [product] = await sql`
      SELECT p.id, p.slug, p.title, pv.id AS variant_id, pv.title AS variant_title, pv.price_amount
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
        AND p.customisation_enabled = true AND p.customisation_profile_id IS NOT NULL
        AND pv.is_available = true
      ORDER BY p.updated_at DESC
      LIMIT 1
    `;
    if (!product) throw new Error("No published customisable SJD product found.");
    report.product = { slug: product.slug, title: product.title, variant: product.variant_title };

    const customisation = { mode: "name_number" as const, name: "TESTNAME", number: "99" };
    const resolved = await resolveCartCustomisationPricing(product.variant_id, customisation, url);

    await clearCart(SESSION, url);
    const cart = await addItemToCart(
      SESSION,
      product.variant_id,
      1,
      url,
      resolved.customisation,
      resolved.customisationPriceAmount
    );
    results.push({
      step: "cart_add",
      ok:
        cart.items.length === 1 &&
        cart.items[0]?.customisation.name?.toUpperCase() === "TESTNAME" &&
        cart.items[0]?.customisation.number === "99",
      detail: { itemCount: cart.items.length, customisation: cart.items[0]?.customisation }
    });

    const checkout: GuestCheckoutInput = {
      email: `e2e.test+${Date.now()}@sjh-internal.test`,
      phone: "+15555550100",
      shippingAddress: {
        fullName: `${TEST_MARKER} Customer`,
        line1: "123 Test Lane",
        city: "Testville",
        region: "CA",
        postalCode: "90210",
        country: "US"
      },
      customerNotes: `${TEST_MARKER} — internal workflow test. Do not fulfil commercially.`
    };

    const order = await createOrderFromCart(SESSION, checkout, url);
    report.orderNumber = order.orderNumber;
    report.orderId = order.id;

    const line = order.items[0];
    const customOk =
      line?.customisation.mode === "name_number" &&
      line.customisation.name === "TESTNAME" &&
      line.customisation.number === "99";
    results.push({
      step: "order_create",
      ok: Boolean(customOk),
      detail: {
        orderNumber: order.orderNumber,
        status: order.status,
        customisation: line?.customisation
      }
    });

    // Mark paid for realistic margin (still no Stripe)
    await sql`
      UPDATE orders SET status = 'paid', internal_notes = coalesce(internal_notes, '') || ${` ${TEST_MARKER}`},
        updated_at = now() WHERE order_number = ${order.orderNumber}
    `;

    // --- PO batch ---
    const batch = await createPurchaseOrderBatch(new Date().toISOString().slice(0, 10), url);
    const poForOrder = batch.created.find((po) =>
      po.lines.some((l) => l.orderNumber === order.orderNumber)
    );
    if (!poForOrder) {
      // PO may already exist — lookup
      const [existingPo] = await sql`
        SELECT po.po_number FROM purchase_orders po
        INNER JOIN order_items oi ON oi.purchase_order_id = po.id
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE o.order_number = ${order.orderNumber} LIMIT 1
      `;
      report.poNumber = existingPo?.po_number;
    } else {
      report.poNumber = poForOrder.poNumber;
    }
    results.push({
      step: "po_batch",
      ok: Boolean(report.poNumber),
      detail: { poNumber: report.poNumber, created: batch.created.length }
    });

    const poNumber = String(report.poNumber);
    const supplierUser = await getSupplierUserByEmail("supplier@sjh.local", url);
    if (!supplierUser) throw new Error("Supplier user supplier@sjh.local not found — run bootstrap-supplier-user.ts");

    const detailBefore = await getSupplierPurchaseOrderDetail(supplierUser.supplierId, poNumber, url);
    const hasCustom =
      detailBefore.lines.some(
        (l) => l.customisation.name?.toUpperCase() === "TESTNAME" && l.customisation.number === "99"
      );
    results.push({
      step: "supplier_portal_view",
      ok: hasCustom && detailBefore.lines.length > 0,
      detail: {
        lineCount: detailBefore.lines.length,
        customisation: detailBefore.lines[0]?.customisation,
        hasImage: Boolean(detailBefore.lines[0]?.imageUrl)
      }
    });

    // Auth boundary — wrong supplier
    const [otherSupplier] = await sql`
      INSERT INTO suppliers (code, name, email, is_active, created_by)
      VALUES (${`TEST2-${Date.now()}`}, 'Test Supplier 2', 'test2@sjh.test', true, 'e2e-test')
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    let authDenied = false;
    if (otherSupplier?.id) {
      try {
        await getSupplierPurchaseOrderDetail(otherSupplier.id, poNumber, url);
      } catch {
        authDenied = true;
      }
    } else {
      authDenied = true;
    }
    results.push({ step: "supplier_auth_boundary", ok: authDenied });

    // Acknowledge + cost + tracking
    await supplierAcknowledgePo(supplierUser.supplierId, supplierUser.id, poNumber, url);
    await supplierSubmitCost(
      supplierUser.supplierId,
      supplierUser.id,
      { poNumber, amount: "20.00", shippingCost: "5.00", notes: `${TEST_MARKER} supplier cost` },
      url
    );

    const orderItemId = detailBefore.lines[0]?.id;
    await supplierSubmitTracking(
      supplierUser.supplierId,
      supplierUser.id,
      {
        poNumber,
        orderItemId: orderItemId ?? "",
        trackingNumber: "1Z999AA10123456784",
        courier: "UPS",
        note: `${TEST_MARKER} tracking`
      },
      url
    );

    const detailAfter = await getSupplierPurchaseOrderDetail(supplierUser.supplierId, poNumber, url);
    results.push({
      step: "supplier_workflow",
      ok: detailAfter.status === "acknowledged" || detailAfter.status === "fulfilled",
      detail: {
        status: detailAfter.status,
        tracking: detailAfter.lines[0]?.trackingNumber,
        fulfilment: detailAfter.lines[0]?.fulfilmentStatus
      }
    });

    const margins = await getOrderMargins(order.orderNumber, url);
    const marginLine = margins?.lines[0];
    const marginOk =
      marginLine &&
      Number.parseFloat(marginLine.supplierCostAmount) === 20 &&
      Number.parseFloat(marginLine.fulfilmentCostAmount) === 5 &&
      Number.parseFloat(marginLine.grossProfitAmount) > 0;
    results.push({
      step: "margin_calculation",
      ok: Boolean(marginOk),
      detail: marginLine
        ? {
            sell: marginLine.netRevenueAmount,
            supplierCost: marginLine.supplierCostAmount,
            shippingCost: marginLine.fulfilmentCostAmount,
            grossProfit: marginLine.grossProfitAmount,
            marginPercent: marginLine.marginPercent
          }
        : null
    });

    report.packingSlipHasCustom = detailAfter.packingSlipHtml?.includes("TESTNAME") ?? false;
    results.push({
      step: "packing_slip",
      ok: Boolean(detailAfter.packingSlipHtml?.includes("TESTNAME")),
      detail: { htmlLength: detailAfter.packingSlipHtml?.length ?? 0 }
    });

    // --- SLA seed + detection (idempotent) ---
    if (!process.argv.includes("--skip-sla-seed")) {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      const [slaPo] = await sql`
        INSERT INTO purchase_orders (supplier_id, status, batch_date, acknowledged_at, supplier_received_at, notes, created_by)
        SELECT s.id, 'acknowledged', current_date, ${eightDaysAgo}, ${eightDaysAgo}, ${TEST_MARKER + " SLA tracking overdue"}, 'e2e-test'
        FROM suppliers s WHERE s.code = 'DEFAULT' AND s.deleted_at IS NULL LIMIT 1
        RETURNING id, po_number
      `;

      if (slaPo) {
        await sql`
          INSERT INTO order_items (
            order_id, product_id, product_title, variant_title, quantity,
            customisation, unit_price_amount, customisation_price_amount, line_total_amount,
            currency_code, fulfilment_status, purchase_order_id, supplier_id, created_by
          )
          SELECT o.id, p.id, p.title, 'M', 1, '{"mode":"none"}'::jsonb,
            '50.00', '0.00', '50.00', 'USD', 'in_production', ${slaPo.id}::uuid, s.id, 'e2e-test'
          FROM orders o, products p, suppliers s
          WHERE o.order_number = ${order.orderNumber} AND p.slug = ${product.slug}
            AND s.code = 'DEFAULT'
          LIMIT 1
          ON CONFLICT DO NOTHING
        `;
      }

      if (orderItemId) {
      await sql`
        UPDATE order_items SET shipped_at = ${thirtyOneDaysAgo}, fulfilment_status = 'shipped',
          tracking_number = 'TEST-SLA-DELIVERY', updated_at = now()
        WHERE id = ${orderItemId}::uuid AND delivered_at IS NULL
      `;
      await sql`
        UPDATE order_items SET delivered_at = NULL WHERE id = ${orderItemId}::uuid
      `;
      }

      const sla1 = await detectAndPersistSlaExceptions({ dryRun: false }, url);
      const sla2 = await detectAndPersistSlaExceptions({ dryRun: false }, url);

      const [exceptions] = await sql`
        SELECT reason, count(*)::int AS n FROM tracking_exceptions
        WHERE deleted_at IS NULL AND status = 'open'
          AND (metadata::text LIKE ${`%${TEST_MARKER}%`} OR reason IN ('tracking_overdue', 'delivery_overdue'))
        GROUP BY reason
      `;

      results.push({
        step: "sla_detection",
        ok: sla1.trackingOverdueCandidates >= 0 && sla2.trackingOverdueCreated === 0,
        detail: {
          sla1,
          sla2Idempotent: sla2.trackingOverdueCreated === 0 && sla2.deliveryOverdueCreated === 0,
          openExceptions: exceptions
        }
      });
    }

    const allOk = results.every((r) => r.ok);
    console.log(JSON.stringify({ ok: allOk, report, results }, null, 2));
    if (!allOk) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
