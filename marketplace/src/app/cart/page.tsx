import { listProducts } from "@/lib/server/store";
import { CartView } from "./cart-view";

export const revalidate = 0;

export default async function CartPage() {
  const catalog = await listProducts();
  return (
    <section className="site-width pb-20">
      <div className="page-heading">
        <p className="eyebrow">Purchase / Review</p>
        <h1 className="display">Your <em>bag.</em></h1>
        <p>Review your selection before continuing to USDT checkout.</p>
      </div>
      <CartView catalog={catalog} />
    </section>
  );
}
