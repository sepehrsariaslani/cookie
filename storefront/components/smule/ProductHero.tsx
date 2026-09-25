import type { SmuleProduct } from "@/lib/smule/products";
import { formatToman } from "@/lib/smule/products";
import styles from "./ProductDetail.module.css";

export function ProductHero({ product }: { product: SmuleProduct }) {
  return (
    <>
      <p className={styles.eyebrow}><span /> کوکی‌های منوی اسموله</p>
      <h1 id="product-title">{product.name}</h1>
      <p className={styles.description}>{product.description}</p>

      <div className={styles.purchaseLine}>
        <div>
          <span className={styles.priceLabel}>قیمت نمونه</span>
          <strong className={styles.price}>{formatToman(product.price)}</strong>
        </div>
        <span className={styles.serving}>{product.serving}</span>
      </div>
    </>
  );
}
