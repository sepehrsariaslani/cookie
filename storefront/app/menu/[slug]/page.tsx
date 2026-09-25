import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/smule/ProductDetail";
import { getSmuleProduct, SMULE_PRODUCTS } from "@/lib/smule/products";

type MenuPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SMULE_PRODUCTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getSmuleProduct(slug);
  if (!product) return { title: "کوکی پیدا نشد | اسموله" };

  return {
    title: `${product.name} | اسموله`,
    description: `${product.description} ترکیبات و ارزش غذایی تقریبی ${product.name} را ببین.`,
  };
}

export default async function MenuProductPage({ params }: MenuPageProps) {
  const { slug } = await params;
  const product = getSmuleProduct(slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
