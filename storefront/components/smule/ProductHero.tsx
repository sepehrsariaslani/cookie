import type { SmuleProduct } from "@/lib/smule/products";
import { formatProductPrice } from "@/lib/smule/products";
import styles from "./ProductDetail.module.css";

export function ProductHero({ product }: { product: SmuleProduct }) {
  return (
    <>
      <p className={styles.eyebrow}><span /> کوکی‌های منوی اسموله</p>
      <h1 id="product-title">{product.name}</h1>
      <p className={styles.description}>{product.description}</p>

      <div className={styles.purchaseLine}>
        <div>
          <span className={styles.priceLabel}>{product.isSample ? "وضعیت قیمت" : "قیمت فروش"}</span>
          <strong className={`${styles.price} ${product.isSample ? styles.pricePending : ""}`}>{formatProductPrice(product)}</strong>
          {product.isSample && <small className={styles.priceHint}>قیمت پس از ثبت دستور و بهای واقعی در ERPNext اعلام می‌شود.</small>}
        </div>
        <span className={styles.serving}>{product.serving}</span>
      </div>
    </>
  );
}
