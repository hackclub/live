import { findShopItemByName } from "../../../src/lib/shopItems";

export type Redemption = {
  id: string;
  itemName: string;
  cost: number;
  quantity: number;
  redeemedAt: string;
};

export default function PurchasedPrizes({ redemptions }: { redemptions: Redemption[] }) {
  if (redemptions.length === 0) {
    return <p className="opacity-60 text-sm font-2">You haven&apos;t redeemed anything yet.</p>;
  }

  return (
    <div className="flex flex-row flex-wrap gap-4">
      {redemptions.map((r) => {
        const item = findShopItemByName(r.itemName);
        return (
          <div key={r.id} className="p-3 w-fit w-40 border-b border-r border-dashed">
            {item?.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.img} alt="" className="w-full object-cover h-40 rounded-lg" />
            )}
            <p className="font-2">{r.quantity} × {r.itemName}</p>
            <p className="text-xs opacity-60 font-2">
              {r.cost} hours{r.redeemedAt ? ` · ${new Date(r.redeemedAt).toLocaleDateString()}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
