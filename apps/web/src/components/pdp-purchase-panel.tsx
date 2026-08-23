"use client";

import { useMemo, useState } from "react";
import type {
  CustomisationMode,
  CustomisationProfile,
  ProductDetail,
  ProductVariantSummary,
  SizeChart
} from "@sjh/shared";
import {
  cartCustomisationSchema,
  customisationPriceForMode,
  formatCustomisationSummary
} from "@sjh/shared";
import { formatProductPrice } from "@/lib/products";

type PdpPurchasePanelProps = {
  productTitle: string;
  variants: ProductVariantSummary[];
  customisationEnabled: boolean;
  customisationProfile?: CustomisationProfile;
  sizeChart?: SizeChart;
};

const MODE_LABELS: Record<CustomisationMode, string> = {
  none: "No customisation",
  name: "Name only",
  number: "Number only",
  name_number: "Name + number",
  message: "Additional message"
};

function addMoney(a: string, b: string): string {
  return (Number.parseFloat(a) + Number.parseFloat(b)).toFixed(2);
}

export function PdpPurchasePanel({
  productTitle,
  variants,
  customisationEnabled,
  customisationProfile,
  sizeChart
}: PdpPurchasePanelProps) {
  const availableVariants = variants.filter((variant) => variant.isAvailable);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    availableVariants[0]?.id ?? variants[0]?.id ?? ""
  );
  const [mode, setMode] = useState<CustomisationMode>("none");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const allowedModes = useMemo(() => {
    if (!customisationEnabled || !customisationProfile) {
      return ["none"] as CustomisationMode[];
    }

    return customisationProfile.allowedModes;
  }, [customisationEnabled, customisationProfile]);

  const customisationPrice = useMemo(() => {
    if (!customisationProfile || mode === "none") {
      return "0.00";
    }

    return customisationPriceForMode(customisationProfile, mode);
  }, [customisationProfile, mode]);

  const unitTotal = selectedVariant
    ? addMoney(selectedVariant.price.amount, customisationPrice)
    : "0.00";
  const currency = selectedVariant?.price.currencyCode ?? "USD";

  const preview = formatCustomisationSummary({
    mode,
    ...(name ? { name } : {}),
    ...(number ? { number } : {}),
    ...(message ? { message } : {})
  });

  async function handleAddToCart() {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!selectedVariant) {
      setErrorMessage("Select a size to continue.");
      return;
    }

    if (!selectedVariant.isAvailable) {
      setErrorMessage("That size is currently unavailable.");
      return;
    }

    const parsedCustomisation = cartCustomisationSchema.safeParse({
      mode,
      ...(name ? { name } : {}),
      ...(number ? { number } : {}),
      ...(message ? { message } : {})
    });

    if (!parsedCustomisation.success) {
      setErrorMessage(parsedCustomisation.error.issues[0]?.message ?? "Complete your customisation.");
      return;
    }

    const customisationPayload = parsedCustomisation.data;

    setSubmitting(true);

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity: 1,
          customisation: customisationPayload
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setErrorMessage(payload.error ?? "Could not add to cart.");
        return;
      }

      setStatusMessage("Added to cart.");
      setJustAdded(true);
      window.dispatchEvent(new Event("sjh:cart-updated"));
      window.setTimeout(() => setJustAdded(false), 900);
    } catch {
      setErrorMessage("Could not add to cart.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pdp-purchase-panel">
      <div className="pdp-size-block">
        <div className="pdp-section-heading">
          <h2>Size</h2>
          {sizeChart ? (
            <button className="text-button" onClick={() => setSizeChartOpen(true)} type="button">
              Size guide
            </button>
          ) : null}
        </div>
        <div className="size-picker" role="radiogroup" aria-label="Select size">
          {variants.map((variant) => {
            const label = variant.sizeLabel ?? variant.title;
            const selected = variant.id === selectedVariantId;

            return (
              <button
                key={variant.id}
                aria-checked={selected}
                className={`size-option${selected ? " is-selected" : ""}${variant.isAvailable ? "" : " is-unavailable"}`}
                disabled={!variant.isAvailable}
                onClick={() => setSelectedVariantId(variant.id)}
                role="radio"
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {customisationEnabled && customisationProfile ? (
        <div className="pdp-customisation-block">
          <h2>Customisation</h2>
          <p className="pdp-help">
            Made to order. Choose how you want this jersey personalised — or leave it blank.
          </p>
          <div className="customisation-modes" role="radiogroup" aria-label="Customisation mode">
            {allowedModes.map((allowedMode) => (
              <button
                key={allowedMode}
                aria-checked={mode === allowedMode}
                className={`customisation-mode${mode === allowedMode ? " is-selected" : ""}`}
                onClick={() => setMode(allowedMode)}
                role="radio"
                type="button"
              >
                <span>{MODE_LABELS[allowedMode]}</span>
                <span className="customisation-mode-price">
                  {allowedMode === "none"
                    ? "Included"
                    : `+${formatProductPrice(customisationPriceForMode(customisationProfile, allowedMode), currency)}`}
                </span>
              </button>
            ))}
          </div>

          {(mode === "name" || mode === "name_number") && (
            <label className="field">
              <span>Name on jersey</span>
              <input
                autoComplete="off"
                maxLength={customisationProfile.nameMaxLength}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. JORDAN"
                type="text"
                value={name}
              />
            </label>
          )}

          {(mode === "number" || mode === "name_number") && (
            <label className="field">
              <span>Number</span>
              <input
                autoComplete="off"
                inputMode="numeric"
                maxLength={customisationProfile.numberMaxLength}
                onChange={(event) => setNumber(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="e.g. 23"
                type="text"
                value={number}
              />
            </label>
          )}

          {mode === "message" && (
            <label className="field">
              <span>Message</span>
              <input
                autoComplete="off"
                maxLength={customisationProfile.messageMaxLength}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Short message"
                type="text"
                value={message}
              />
            </label>
          )}

          {preview ? <p className="customisation-preview">Preview: {preview}</p> : null}
        </div>
      ) : null}

      <div className={`pdp-purchase${justAdded ? " is-added" : ""}`}>
        <div className="pdp-sticky-summary">
          {selectedVariant ? (
            <p className="pdp-sticky-size">
              Size: {selectedVariant.sizeLabel ?? selectedVariant.title}
            </p>
          ) : null}
          {preview ? <p className="pdp-sticky-custom">{preview}</p> : null}
        </div>
        <div className="pdp-price-stack">
          <p className="product-detail-price">{formatProductPrice(unitTotal, currency)}</p>
          {selectedVariant?.compareAtPrice ? (
            <p className="product-detail-compare">
              <s>{formatProductPrice(selectedVariant.compareAtPrice.amount, currency)}</s>
            </p>
          ) : null}
          {Number.parseFloat(customisationPrice) > 0 ? (
            <p className="pdp-price-note">
              Includes {formatProductPrice(customisationPrice, currency)} customisation
            </p>
          ) : null}
        </div>
        <div className="add-to-cart">
          <button
            className="button primary"
            disabled={!selectedVariant?.isAvailable || submitting}
            onClick={handleAddToCart}
            type="button"
          >
            {submitting ? "Adding…" : justAdded ? "Added" : "Add to cart"}
          </button>
          {errorMessage ? (
            <p className="add-to-cart-message is-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {statusMessage ? (
            <p className="add-to-cart-message" role="status">
              {statusMessage}
            </p>
          ) : null}
        </div>
      </div>

      {sizeChart && sizeChartOpen ? (
        <SizeChartDialog
          productTitle={productTitle}
          sizeChart={sizeChart}
          onClose={() => setSizeChartOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SizeChartDialog({
  productTitle,
  sizeChart,
  onClose
}: {
  productTitle: string;
  sizeChart: SizeChart;
  onClose: () => void;
}) {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of sizeChart.rows) {
      for (const key of Object.keys(row)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [sizeChart.rows]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-labelledby="size-chart-title"
        aria-modal="true"
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Size guide</p>
            <h2 id="size-chart-title">{sizeChart.title}</h2>
            <p className="modal-subtitle">{productTitle}</p>
          </div>
          <button aria-label="Close size guide" className="text-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {sizeChart.description ? <p>{sizeChart.description}</p> : null}
        <div className="size-chart-table-wrap">
          <table className="size-chart-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizeChart.rows.map((row, index) => (
                <tr key={`${row.size ?? "row"}-${index}`}>
                  {columns.map((column) => (
                    <td key={column}>{String(row[column] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sizeChart.notes ? <p className="size-chart-notes">{sizeChart.notes}</p> : null}
      </div>
    </div>
  );
}

export type { ProductDetail };
