"use client";

import { useMemo, useState } from "react";
import type {
  CustomisationProfile,
  ProductDetail,
  ProductVariantSummary,
  SizeChart
} from "@sjh/shared";
import { formatSelectedOptionsSummary, SJD_CUSTOMISATION_PRICE_AMOUNT } from "@sjh/shared";
import { formatProductPrice } from "@/lib/products";

type PdpPurchasePanelProps = {
  productTitle: string;
  variants: ProductVariantSummary[];
  customisationEnabled: boolean;
  customisationProfile?: CustomisationProfile;
  sizeChart?: SizeChart;
  productOptions?: ProductDetail["productOptions"];
  selectedVariantId?: string;
  onVariantChange?: (variantId: string) => void;
};

function addMoney(a: string, b: string): string {
  return (Number.parseFloat(a) + Number.parseFloat(b)).toFixed(2);
}

export function PdpPurchasePanel({
  productTitle,
  variants,
  customisationEnabled,
  customisationProfile,
  sizeChart,
  productOptions,
  selectedVariantId: controlledVariantId,
  onVariantChange
}: PdpPurchasePanelProps) {
  const availableVariants = variants.filter((variant) => variant.isAvailable);
  const optionSet = productOptions?.optionSet ?? null;
  const variantAxis = productOptions?.variantAxis ?? variants[0]?.variantAxis ?? "unknown";
  const showColourPicker = variantAxis === "colour" && variants.length > 1;
  const customisationPrice = productOptions?.customisationPriceAmount ?? SJD_CUSTOMISATION_PRICE_AMOUNT;

  const [internalVariantId, setInternalVariantId] = useState<string>(
    availableVariants[0]?.id ?? variants[0]?.id ?? ""
  );
  const selectedVariantId = controlledVariantId ?? internalVariantId;

  function selectVariant(variantId: string) {
    if (!controlledVariantId) {
      setInternalVariantId(variantId);
    }
    onVariantChange?.(variantId);
  }
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [customisationEnabledChoice, setCustomisationEnabledChoice] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const currency = selectedVariant?.price.currencyCode ?? "USD";
  const unitCustomisationPrice = customisationEnabledChoice ? customisationPrice : "0.00";
  const unitTotal = selectedVariant
    ? addMoney(selectedVariant.price.amount, unitCustomisationPrice)
    : "0.00";

  const previewLines = useMemo(() => {
    if (!selectedSize) return [];
    return formatSelectedOptionsSummary({
      colour: selectedVariant?.colourLabel ?? null,
      size: selectedSize,
      customisation: {
        enabled: customisationEnabledChoice,
        ...(name ? { name } : {}),
        ...(number ? { number } : {}),
        ...(message ? { message } : {})
      }
    });
  }, [selectedSize, selectedVariant?.colourLabel, customisationEnabledChoice, name, number, message]);

  async function handleAddToCart() {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!selectedVariant) {
      setErrorMessage(showColourPicker ? "Select a colour to continue." : "Select a variant to continue.");
      return;
    }

    if (!selectedVariant.isAvailable) {
      setErrorMessage("That option is currently unavailable.");
      return;
    }

    if (!optionSet) {
      setErrorMessage("Size options are not configured for this product yet.");
      return;
    }

    if (!selectedSize) {
      setErrorMessage("Select a size to continue.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity: 1,
          selectedOptions: {
            colour: selectedVariant.colourLabel ?? null,
            size: selectedSize,
            optionSetSlug: optionSet.slug,
            customisation: {
              enabled: customisationEnabled && customisationEnabledChoice,
              ...(name ? { name } : {}),
              ...(number ? { number } : {}),
              ...(message ? { message } : {})
            }
          }
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
      {showColourPicker ? (
        <div className="pdp-size-block">
          <div className="pdp-section-heading">
            <h2>Colour</h2>
          </div>
          <div className="size-picker" role="radiogroup" aria-label="Select colour">
            {variants.map((variant) => {
              const label = variant.colourLabel ?? variant.title;
              const selected = variant.id === selectedVariantId;
              return (
                <button
                  key={variant.id}
                  aria-checked={selected}
                  className={`size-option${selected ? " is-selected" : ""}${variant.isAvailable ? "" : " is-unavailable"}`}
                  disabled={!variant.isAvailable}
                  onClick={() => selectVariant(variant.id)}
                  role="radio"
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="pdp-size-block">
        <div className="pdp-section-heading">
          <h2>Size</h2>
          {sizeChart ? (
            <button className="text-button" onClick={() => setSizeChartOpen(true)} type="button">
              Size guide
            </button>
          ) : null}
        </div>
        {optionSet ? (
          <div className="size-picker" role="radiogroup" aria-label="Select size">
            {optionSet.sizes.map((size) => {
              const selected = size === selectedSize;
              return (
                <button
                  key={size}
                  aria-checked={selected}
                  className={`size-option${selected ? " is-selected" : ""}`}
                  onClick={() => setSelectedSize(size)}
                  role="radio"
                  type="button"
                >
                  {size}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="pdp-help" role="status">
            Size options for this product are pending review and cannot be selected yet.
          </p>
        )}
      </div>

      {customisationEnabled ? (
        <div className="pdp-customisation-block">
          <h2>Customisation</h2>
          <p className="pdp-help">
            Made to order. Choose whether to personalise this jersey — or leave it as standard.
          </p>
          <div className="customisation-modes" role="radiogroup" aria-label="Customisation">
            <button
              aria-checked={!customisationEnabledChoice}
              className={`customisation-mode${!customisationEnabledChoice ? " is-selected" : ""}`}
              onClick={() => setCustomisationEnabledChoice(false)}
              role="radio"
              type="button"
            >
              <span>No</span>
              <span className="customisation-mode-price">Included</span>
            </button>
            <button
              aria-checked={customisationEnabledChoice}
              className={`customisation-mode${customisationEnabledChoice ? " is-selected" : ""}`}
              onClick={() => setCustomisationEnabledChoice(true)}
              role="radio"
              type="button"
            >
              <span>Yes</span>
              <span className="customisation-mode-price">
                +{formatProductPrice(customisationPrice, currency)}
              </span>
            </button>
          </div>

          {customisationEnabledChoice ? (
            <>
              <label className="field">
                <span>Name</span>
                <input
                  autoComplete="off"
                  maxLength={customisationProfile?.nameMaxLength ?? 12}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. JORDAN"
                  type="text"
                  value={name}
                />
              </label>
              <label className="field">
                <span>Number</span>
                <input
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={customisationProfile?.numberMaxLength ?? 2}
                  onChange={(event) => setNumber(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="e.g. 23"
                  type="text"
                  value={number}
                />
              </label>
              <label className="field">
                <span>Any Message?</span>
                <input
                  autoComplete="off"
                  maxLength={customisationProfile?.messageMaxLength ?? 20}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Optional short message"
                  type="text"
                  value={message}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      <div className={`pdp-purchase${justAdded ? " is-added" : ""}`}>
        <div className="pdp-sticky-summary">
          {previewLines.map((line) => (
            <p className="pdp-sticky-custom" key={line}>
              {line}
            </p>
          ))}
        </div>
        <div className="pdp-price-stack">
          <p className="product-detail-price">{formatProductPrice(unitTotal, currency)}</p>
          {selectedVariant?.compareAtPrice ? (
            <p className="product-detail-compare">
              <s>{formatProductPrice(selectedVariant.compareAtPrice.amount, currency)}</s>
            </p>
          ) : null}
          {Number.parseFloat(unitCustomisationPrice) > 0 ? (
            <p className="pdp-price-note">
              Includes {formatProductPrice(unitCustomisationPrice, currency)} customisation
            </p>
          ) : null}
        </div>
        <div className="add-to-cart">
          <button
            className="button primary"
            disabled={!selectedVariant?.isAvailable || !optionSet || submitting}
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
