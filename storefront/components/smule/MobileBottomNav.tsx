"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Route highlighting reads the browser path after hydration to keep server markup deterministic. */

import { useEffect, useState } from "react";
import { ClipboardList, Cookie, ShoppingBasket, Sparkles, UserRound } from "lucide-react";
import styles from "./MobileBottomNav.module.css";

const items = [
  { id: "menu", label: "طعم‌ها", href: "/menu", icon: Cookie },
  { id: "builder", label: "بساز", href: "/build-cookie", icon: Sparkles },
  { id: "account", label: "حساب", href: "/account", icon: UserRound },
  { id: "orders", label: "سفارش‌ها", href: "/account?tab=orders", icon: ClipboardList },
  { id: "cart", label: "سبد", href: "/cart", icon: ShoppingBasket },
] as const;

export function MobileBottomNav() {
  const [active, setActive] = useState<(typeof items)[number]["id"] | "">("");

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/account")) setActive(new URLSearchParams(window.location.search).get("tab") === "orders" ? "orders" : "account");
    else if (path.startsWith("/build-cookie")) setActive("builder");
    else if (path.startsWith("/my-orders") || path.startsWith("/orders/view")) setActive("orders");
    else if (path.startsWith("/cart") || path.startsWith("/checkout")) setActive("cart");
    else if (path.startsWith("/menu")) setActive("menu");
    else if (path === "/") setActive("");

    if (path !== "/") return;
    const hero = document.querySelector(".hero-section");
    const products = document.getElementById("products");
    if (!hero || !products) return;

    if (window.location.hash === "#products") setActive("menu");
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
      if (visible) setActive(visible.target.id === "products" ? "menu" : "");
    }, { rootMargin: "-18% 0px -58% 0px", threshold: [0, 0.15, 0.3] });

    observer.observe(hero);
    observer.observe(products);
    return () => observer.disconnect();
  }, []);

  return (
    <nav className={styles.navigation} aria-label="ناوبری موبایل">
      {items.map(({ id, label, href, icon: Icon }) => (
        <a
          className={`${styles.item} ${active === id ? styles.active : ""}`}
          href={href}
          key={id}
          aria-current={active === id ? "page" : undefined}
          onClick={() => setActive(id)}
        >
          <Icon size={20} strokeWidth={active === id ? 2.4 : 1.9} aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
