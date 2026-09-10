import { requireSession } from "../../src/lib/auth";
import { getIdentity } from "../../src/lib/hackclub";
import { getTokenBalance } from "../../src/lib/airtable";
import { findShopItemByName, shopItemsByPriceAsc } from "../../src/lib/shopItems";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import RedeemCatalog from "../components/RedeemCatalog";

export default async function Redeem() {
  const session = await requireSession();
  const identity = await getIdentity(session.access_token);

  if (!identity?.primary_email) {
    return (
      <section className="w-4/6 mx-auto min-h-screen py-10">
        <p className="text-error">Couldn&apos;t load your Hack Club identity. Try logging in again.</p>
      </section>
    );
  }

  const balance = await getTokenBalance(identity.primary_email);
  const items = shopItemsByPriceAsc.filter((item) => findShopItemByName(item.name) === item);

  return (
    <>
      <Navbar />

      <section className="w-4/6 font-2 mx-auto min-h-screen">
        <RedeemCatalog items={items} initialBalance={balance} />
      </section>

      <Footer />
    </>
  );
}
