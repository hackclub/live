"use client";

import { useRef, useState } from "react";
import type { ShopItem } from "../../src/lib/shopItems";

export default function RedeemCatalog({
  items,
  initialBalance,
}: {
  items: ShopItem[];
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const redeeming = useRef(false);

  async function redeem(item: ShopItem, quantity: number) {
    if (redeeming.current) return;
    redeeming.current = true;
    setPending(item.name);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/shop/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: item.name, quantity }),
      });
      const data = await response.json();
      if (typeof data.balance === "number" && Number.isFinite(data.balance)) {
        setBalance(data.balance);
      }
      if (!response.ok) {
        setError(
          data.error === "insufficient_balance"
            ? "Not enough balance. Please reduce the quantity."
            : data.error === "redemption_pending"
              ? "A purchase is already processing. Please wait."
              : "Couldn't confirm the purchase. Check your purchase history before trying again.",
        );
        return;
      }
      setQuantities({});
      setSuccess(`Purchased ${data.quantity} × ${item.name}`);
    } catch {
      setError("Couldn't confirm the purchase. Check your purchase history before trying again.");
    } finally {
      redeeming.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <p className="text-4xl text-left mb-2">your balance: {balance.toFixed(1)} tokens</p>
      {error && <p role="alert" className="text-error mb-4">{error}</p>}
      {success && <p role="status" className="mb-4">{success}</p>}

      <div className="flex flex-row flex-wrap gap-4">
        {items.map((item, i) => {
          const maxQuantity = item.price > 0 ? Math.max(0, Math.floor(balance / item.price)) : 0;
          const quantity = Math.min(quantities[item.name] ?? 1, Math.max(1, maxQuantity));
          const canAfford = maxQuantity >= 1;
          return (
            <div key={i} className="p-3 w-fit w-40 border-b border-r border-dashed">
              <img src={item.img} alt={item.name} className="w-full object-cover h-40 rounded-lg" />
              <p>{item.name}</p>
              <div className="flex gap-2 items-center mt-2" role="group" aria-label={`Quantity for ${item.name}`}>
                <span>Quantity</span>
                <button
                  className="btn btn-xs"
                  aria-label={`Decrease quantity for ${item.name}`}
                  disabled={quantity <= 1 || pending !== null}
                  onClick={() => setQuantities({ ...quantities, [item.name]: quantity - 1 })}
                >
                  −
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  className="btn btn-xs"
                  aria-label={`Increase quantity for ${item.name}`}
                  disabled={quantity >= maxQuantity || pending !== null}
                  onClick={() => setQuantities({ ...quantities, [item.name]: quantity + 1 })}
                >
                  +
                </button>
              </div>
              <p className="mt-2">Total cost: {item.price * quantity} hours</p>
              <button
                className="btn btn-sm mt-2"
                disabled={!canAfford || pending !== null}
                onClick={() => redeem(item, quantity)}
              >
                {pending === item.name ? "Redeeming..." : "Redeem"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
