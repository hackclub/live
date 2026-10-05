"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { ShopItem } from "../../src/lib/shopItems";

export default function RedeemCatalog({
  items,
  initialBalance,
}: {
  items: ShopItem[];
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);

  // A ref (not the `pending` state) so a second click in the same tick, before
  // React re-renders, is still rejected.
  const inFlight = useRef(false);

  async function redeem(item: ShopItem) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(item.name);
    setError(null);
    try {
      const response = await fetch("/api/shop/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: item.name }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          data.error === "insufficient_balance"
            ? `Not enough tokens for ${item.name}.`
            : data.error === "duplicate_request"
              ? `Looks like ${item.name} was just redeemed — wait a few seconds if you meant to buy another.`
              : "Redemption failed. Try again.",
        );
        if (typeof data.balance === "number") setBalance(data.balance);
        return;
      }
      setBalance(data.balance);
    } catch {
      setError("Network error. Check your balance before trying again.");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <>
      <p className="text-4xl text-left mb-2">your balance: {balance.toFixed(1)} tokens</p>
      {error && <p className="text-error mb-4">{error}</p>}

      <div className="flex flex-row flex-wrap gap-4">
        {items.map((item, i) => {
          const canAfford = balance >= item.price;
          const isOpen = openItem === item.name;

          return (
            <div key={i}>
              {isOpen && (
                <>
                  <section
                    onClick={() => setOpenItem(null)}
                    className="fixed top-0 left-0 opacity-65 bg-black z-99 w-screen h-screen"
                  ></section>
                  <div className="fixed rounded-box border border-secondary p-4 bg-base-300 min-w-3/6 z-100 top-[30%] translate-y-[-50%] left-[50%] translate-x-[-50%]">
                    <Image src={item.img} alt={item.name} width={640} height={160} className="w-full h-40 object-cover" />

                    <div className="flex gap-2 items-center flex-row">
                      <p className="text-error text-2xl">~{item.price}</p>
                      <p> hours</p>
                    </div>

                    <p>{item.name}</p>

                    <div className="mt-2 bg-base-100 p-2">
                      <p className="text-xs font-2">lil description</p>
                      <p className="mt-2">{item.description ?? "i lowk forgot to write one. sorry"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full">
                      <button onClick={() => setOpenItem(null)} className="w-full btn btn-outline mt-2">
                        let&apos;s go back
                      </button>
                      <button
                        className="btn btn-secondary w-full mt-2"
                        disabled={!canAfford || pending !== null}
                        onClick={() => redeem(item)}
                      >
                        {pending === item.name ? "Redeeming..." : "Redeem"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div
                onClick={() => setOpenItem(item.name)}
                className="p-3 hover:scale-105 duration-150 cursor-pointer w-fit border-b border-r border-dashed"
              >
                <Image src={item.img} alt={item.name} width={160} height={160} className="w-full object-cover h-40 rounded-lg" />
                <div className="flex gap-2 items-center flex-row">
                  <p className="text-error text-2xl">~{item.price}</p>
                  <p> hours</p>
                </div>
                <p>{item.name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
