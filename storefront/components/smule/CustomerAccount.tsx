"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors preserve the Frappe/Vinext route boundary. */
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Cookie,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import {
  archiveCustomerAddress,
  fetchCustomerAccount,
  logoutCustomer,
  saveCustomerAddress,
  saveCustomerProfile,
  type SmuleAccountAddress,
  type SmuleAccountData,
  type SmuleAccountOrder,
} from "@/lib/smule/customer-account";
import { formatPersianNumber, formatToman, toDisplayTomans } from "@/lib/smule/products";
import styles from "./CustomerAccount.module.css";

type AccountTab = "overview" | "orders" | "addresses" | "profile" | "payments";
type AddressDraft = Omit<SmuleAccountAddress, "is_primary_address"> & { is_primary_address: boolean };

const tabs: Array<{ id: AccountTab; label: string; icon: typeof UserRound }> = [
  { id: "overview", label: "نمای کلی", icon: BadgeCheck },
  { id: "orders", label: "سفارش‌ها", icon: ClipboardList },
  { id: "addresses", label: "نشانی‌ها", icon: MapPin },
  { id: "profile", label: "اطلاعات من", icon: UserRound },
  { id: "payments", label: "پرداخت‌ها", icon: CreditCard },
];

function getAccountTabFromLocation(): AccountTab {
  if (typeof window === "undefined") return "overview";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return tabs.some(({ id }) => id === requested) ? requested as AccountTab : "overview";
}

function subscribeToAccountTab(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function faDate(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

function statusText(status: string) {
  const known: Record<string, string> = {
    Draft: "در انتظار بررسی فروشگاه",
    Submitted: "ثبت نهایی‌شده",
    "To Deliver and Bill": "در حال آماده‌سازی",
    "To Bill": "آمادهٔ تسویه",
    Completed: "تکمیل‌شده",
    Closed: "بسته‌شده",
    Cancelled: "لغوشده",
    "جدید": "در انتظار بررسی فروشگاه",
    "نیازمند قیمت‌گذاری": "در حال تعیین قیمت",
    "قیمت‌گذاری‌شده": "قیمت‌گذاری‌شده",
    "تبدیل به سفارش فروش": "در صف آماده‌سازی",
    "ردشده": "این درخواست پذیرفته نشد",
    "در انتظار بررسی": "در انتظار بررسی",
  };
  return known[status] ?? status;
}

function EmptyState({ icon: Icon, title, detail, action }: {
  icon: typeof Cookie;
  title: string;
  detail: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><Icon size={22} aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action && <a className={styles.secondaryAction} href={action.href}>{action.label}<ArrowLeft size={15} aria-hidden="true" /></a>}
    </div>
  );
}

function OrderCard({ order }: { order: SmuleAccountOrder }) {
  const amount = order.total > 0 ? formatToman(toDisplayTomans(order.total, order.currency)) : "پس از بررسی فروشگاه";
  return (
    <article className={styles.orderCard}>
      <div className={styles.orderTop}>
        <span className={styles.orderIcon}><Cookie size={19} aria-hidden="true" /></span>
        <div className={styles.orderIdentity}>
          <strong>{order.name}</strong>
          <small>{faDate(order.date)}{order.requestName ? ` · درخواست ${order.requestName}` : ""}</small>
          {order.deliveryDate && <small>دریافت پیشنهادی: {faDate(order.deliveryDate)}{order.requestedForTime ? ` · ${order.requestedForTime.slice(0, 5)}` : ""}</small>}
        </div>
        <span className={styles.statusPill}>{statusText(order.status)}</span>
      </div>
      {order.items.length > 0 && (
        <div className={styles.orderItems}>
          {order.items.slice(0, 3).map((item, index) => (
            <span key={`${item.title}-${index}`}>{item.title} <b>× {formatPersianNumber(item.quantity)}</b></span>
          ))}
          {order.items.length > 3 && <small>و {formatPersianNumber(order.items.length - 3)} قلم دیگر</small>}
        </div>
      )}
      <div className={styles.orderBottom}>
        <span>{order.kind === "sales-order" ? "سفارش ERPNext" : "درخواست سفارش"}</span>
        <strong>{amount}</strong>
      </div>
    </article>
  );
}

function AddressEditor({
  initial,
  countries,
  busy,
  onCancel,
  onSave,
}: {
  initial?: SmuleAccountAddress;
  countries: string[];
  busy: boolean;
  onCancel: () => void;
  onSave: (draft: AddressDraft) => void;
}) {
  const [draft, setDraft] = useState<AddressDraft>(() => ({
    name: initial?.name ?? "",
    address_title: initial?.address_title ?? "",
    address_line1: initial?.address_line1 ?? "",
    address_line2: initial?.address_line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    pincode: initial?.pincode ?? "",
    country: initial?.country ?? (countries.includes("Iran") ? "Iran" : countries[0] ?? ""),
    is_primary_address: Boolean(initial?.is_primary_address),
  }));

  const update = (key: keyof AddressDraft, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(draft);
  };

  return (
    <form className={styles.addressForm} onSubmit={submit}>
      <div className={styles.formHeading}>
        <div><span className={styles.eyebrow}>{initial ? "ویرایش نشانی" : "نشانی تازه"}</span><h3>{initial ? "جزئیات نشانی" : "نشانی را کجا بفرستیم؟"}</h3></div>
        <button type="button" className={styles.iconButton} onClick={onCancel} aria-label="بستن فرم"><ChevronLeft size={20} aria-hidden="true" /></button>
      </div>
      <div className={styles.formGrid}>
        <label>عنوان نشانی <input value={draft.address_title} onChange={(event) => update("address_title", event.target.value)} placeholder="مثلاً خانه یا محل کار" maxLength={100} /></label>
        <label>شهر <input required value={draft.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" maxLength={100} /></label>
        <label className={styles.spanTwo}>نشانی کامل <input required value={draft.address_line1} onChange={(event) => update("address_line1", event.target.value)} autoComplete="street-address" maxLength={240} /></label>
        <label className={styles.spanTwo}>ادامهٔ نشانی <input value={draft.address_line2} onChange={(event) => update("address_line2", event.target.value)} maxLength={240} /></label>
        <label>استان <input value={draft.state} onChange={(event) => update("state", event.target.value)} autoComplete="address-level1" maxLength={100} /></label>
        <label>کد پستی <input value={draft.pincode} onChange={(event) => update("pincode", event.target.value)} autoComplete="postal-code" maxLength={40} /></label>
        <label>کشور
          <select required value={draft.country} onChange={(event) => update("country", event.target.value)}>
            <option value="" disabled>انتخاب کشور</option>
            {countries.map((country) => <option value={country} key={country}>{country}</option>)}
          </select>
        </label>
      </div>
      <label className={styles.checkLabel}><input type="checkbox" checked={draft.is_primary_address} onChange={(event) => update("is_primary_address", event.target.checked)} /><span>این نشانی، نشانی اصلی من باشد</span></label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.primaryAction} disabled={busy}><Check size={17} aria-hidden="true" />{busy ? "در حال ذخیره…" : "ذخیرهٔ نشانی"}</button>
        <button type="button" className={styles.tertiaryAction} onClick={onCancel}>انصراف</button>
      </div>
    </form>
  );
}

export function CustomerAccount() {
  const [data, setData] = useState<SmuleAccountData | null>(null);
  const tab = useSyncExternalStore(subscribeToAccountTab, getAccountTabFromLocation, () => "overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [editingAddress, setEditingAddress] = useState<SmuleAccountAddress | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomerAccount(controller.signal)
      .then((result) => {
        setData(result);
        setFullName(result.profile?.fullName ?? "");
        setPhone(result.profile?.phone ?? "");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "حساب بارگذاری نشد.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const acceptUpdate = (updated: SmuleAccountData) => {
    setData(updated);
    setFullName(updated.profile?.fullName ?? "");
    setPhone(updated.profile?.phone ?? "");
    setEditingAddress(undefined);
    setDeleteTarget("");
  };

  const runAction = async (action: () => Promise<SmuleAccountData>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      acceptUpdate(await action());
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ذخیره انجام نشد؛ دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(() => saveCustomerProfile({ fullName, phone }), "اطلاعات حساب با موفقیت ذخیره شد.");
  };

  const submitAddress = (draft: AddressDraft) => {
    void runAction(() => saveCustomerAddress({
      name: draft.name || undefined,
      title: draft.address_title,
      addressLine1: draft.address_line1,
      addressLine2: draft.address_line2,
      city: draft.city,
      state: draft.state,
      postalCode: draft.pincode,
      country: draft.country,
      isPrimary: draft.is_primary_address,
    }), "نشانی ذخیره شد.");
  };

  const handleLogout = async () => {
    try {
      await logoutCustomer();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "خروج از حساب انجام نشد.");
    }
  };

  const orderCount = data?.orders?.length ?? 0;
  const addressCount = data?.addresses?.length ?? 0;
  const paymentCount = data?.payments?.length ?? 0;

  const selectTab = (nextTab: AccountTab) => {
    if (getAccountTabFromLocation() !== nextTab) {
      const url = new URL(window.location.href);
      if (nextTab === "overview") url.searchParams.delete("tab");
      else url.searchParams.set("tab", nextTab);
      window.history.pushState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    setNotice("");
    setError("");
  };

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="account" />
        <main id="main-content" className={styles.main}>
          <div className={styles.pageIntro}>
            <div>
              <span className={styles.eyebrow}><span /> فضای شخصی اسموله</span>
              <h1>حساب <em>من</em></h1>
              <p>سفارش‌ها، نشانی‌ها و اطلاعاتت را یک‌جا و همیشه در دسترس داشته باش.</p>
            </div>
            {data?.authenticated && <button className={styles.logoutButton} type="button" onClick={() => void handleLogout()}><LogOut size={16} aria-hidden="true" /> خروج از حساب</button>}
          </div>

          {loading ? (
            <div className={styles.loading}><span /><span /><span />در حال آماده‌کردن فضای شخصی…</div>
          ) : error && !data ? (
            <section className={styles.errorPanel} role="alert"><p>{error}</p><button type="button" onClick={() => window.location.reload()}><RefreshCw size={16} aria-hidden="true" /> تلاش دوباره</button></section>
          ) : !data?.authenticated ? (
            <section className={styles.guestPanel}>
              <span className={styles.guestArt}><UserRound size={31} aria-hidden="true" /><Cookie size={19} aria-hidden="true" /></span>
              <div className={styles.guestCopy}>
                <span className={styles.eyebrow}>خوش آمدی به اسموله</span>
                <h2>سفارش‌هایت همیشه همراهت باشند.</h2>
                <p>وارد حساب شو تا سفارش‌های ثبت‌شده در فروشگاه، نشانی‌ها و پرداخت‌های ثبت‌شدهٔ ERPNext را ببینی.</p>
                <a className={styles.primaryAction} href="/login?redirect-to=%2Faccount">{data?.signupEnabled && data.signupEmailReady ? "ورود یا ساخت حساب" : "ورود به حساب"} <ArrowLeft size={17} aria-hidden="true" /></a>
              </div>
              <div className={styles.signupNote}>
                {data?.signupEnabled && data.signupEmailReady ? (
                  <><ShieldCheck size={18} aria-hidden="true" /><span>برای ساخت حساب، از گزینهٔ ثبت‌نام در صفحهٔ ورود استفاده کن.</span></>
                ) : data?.signupEnabled ? (
                  <><ShieldCheck size={18} aria-hidden="true" /><span>ثبت‌نام پس از تنظیم ایمیل تأیید حساب از طرف فروشگاه فعال می‌شود.</span></>
                ) : (
                  <><ShieldCheck size={18} aria-hidden="true" /><span>ساخت حساب جدید فعلاً از تنظیمات امن فروشگاه غیرفعال است؛ ورود با حساب موجود در دسترس است.</span></>
                )}
              </div>
            </section>
          ) : (
            <>
              <section className={styles.welcomeCard}>
                <span className={styles.avatar}><UserRound size={23} aria-hidden="true" /></span>
                <div><span className={styles.eyebrow}>سلام، خوش برگشتی</span><h2>{data.profile?.fullName || "دوست اسموله"}</h2><p>{data.profile?.email}</p></div>
                <a href="/menu" className={styles.welcomeLink}>انتخاب یک طعم <ArrowLeft size={16} aria-hidden="true" /></a>
              </section>

              {!data.accountReady && <div className={`${styles.setupNotice} ${data.customerSetupReady ? "" : styles.setupNoticeError}`}><ShieldCheck size={18} aria-hidden="true" /><span>{data.customerSetupReady ? "برای ثبت نشانی و پیگیری سفارش‌ها، اطلاعات تماس را یک‌بار ذخیره کن." : "مدیر فروشگاه باید ابتدا گروه مشتری و قلمرو را در ERPNext تنظیم کند؛ بعد از آن می‌توان اطلاعات را ثبت کرد."}</span>{data.customerSetupReady && <button type="button" onClick={() => selectTab("profile")}>تکمیل اطلاعات</button>}</div>}
              {(error || notice) && <div className={`${styles.feedback} ${error ? styles.feedbackError : styles.feedbackSuccess}`} role={error ? "alert" : "status"}>{error || notice}</div>}

              <div className={styles.dashboardLayout}>
                <nav className={styles.tabs} role="tablist" aria-label="بخش‌های حساب کاربری">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <button type="button" id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls="account-panel" className={tab === id ? styles.activeTab : ""} key={id} onClick={() => selectTab(id)}>
                      <Icon size={18} aria-hidden="true" /><span>{label}</span><ChevronLeft size={15} className={styles.tabChevron} aria-hidden="true" />
                    </button>
                  ))}
                </nav>

                <section id="account-panel" className={styles.panel} role="tabpanel" aria-labelledby={`tab-${tab}`}>
                  {tab === "overview" && (
                    <div className={styles.panelContent}>
                      <div className={styles.panelHeading}><div><span className={styles.eyebrow}>همه‌چیز مرتب است</span><h2>نمای کلی حساب</h2></div><button className={styles.refreshButton} type="button" onClick={() => window.location.reload()} aria-label="تازه‌سازی اطلاعات"><RefreshCw size={17} aria-hidden="true" /></button></div>
                      <div className={styles.statsGrid}>
                        <button type="button" onClick={() => selectTab("orders")}><span className={styles.statIcon}><ClipboardList size={19} aria-hidden="true" /></span><strong>{formatPersianNumber(orderCount)}</strong><small>سفارش ثبت‌شده</small></button>
                        <button type="button" onClick={() => selectTab("addresses")}><span className={styles.statIcon}><MapPin size={19} aria-hidden="true" /></span><strong>{formatPersianNumber(addressCount)}</strong><small>نشانی ذخیره‌شده</small></button>
                        <button type="button" onClick={() => selectTab("payments")}><span className={styles.statIcon}><CreditCard size={19} aria-hidden="true" /></span><strong>{formatPersianNumber(paymentCount)}</strong><small>پرداخت ثبت‌شده</small></button>
                      </div>
                      <div className={styles.sectionHeading}><h3>آخرین سفارش‌ها</h3><button type="button" onClick={() => selectTab("orders")}>همهٔ سفارش‌ها <ArrowLeft size={15} aria-hidden="true" /></button></div>
                      {orderCount ? <div className={styles.cardList}>{data.orders?.slice(0, 2).map((order) => <OrderCard order={order} key={`${order.kind}-${order.name}`} />)}</div> : <EmptyState icon={Cookie} title="هنوز سفارشی به حساب وصل نیست" detail="از منو انتخاب کن؛ سفارش‌های ثبت‌شده پس از ورود به حسابت اینجا دیده می‌شوند." action={{ label: "دیدن منوی کوکی‌ها", href: "/menu" }} />}
                    </div>
                  )}

                  {tab === "orders" && (
                    <div className={styles.panelContent}>
                      <div className={styles.panelHeading}><div><span className={styles.eyebrow}>از ثبت تا تحویل</span><h2>سفارش‌های من</h2></div><a href="/my-orders" className={styles.subtleLink}>پیش‌نویس‌های این دستگاه</a></div>
                      {orderCount ? <div className={styles.cardList}>{data.orders?.map((order) => <OrderCard order={order} key={`${order.kind}-${order.name}`} />)}</div> : <EmptyState icon={ClipboardList} title="سفارشی برای نمایش نیست" detail="فقط سفارش‌های مرتبط با همین حساب نمایش داده می‌شوند. سفارش مهمان قدیمی برای حفظ حریم خصوصی خودکار به حساب وصل نمی‌شود." action={{ label: "رفتن به منو", href: "/menu" }} />}
                    </div>
                  )}

                  {tab === "addresses" && (
                    <div className={styles.panelContent}>
                      <div className={styles.panelHeading}><div><span className={styles.eyebrow}>برای سفارش بعدی آماده</span><h2>نشانی‌های من</h2></div>{editingAddress === undefined && <button type="button" className={styles.primaryAction} disabled={!data.accountReady && !data.customerSetupReady} onClick={() => setEditingAddress(null)}><Plus size={17} aria-hidden="true" /> نشانی تازه</button>}</div>
                      {editingAddress !== undefined && <AddressEditor initial={editingAddress ?? undefined} countries={data.countries ?? []} busy={busy} onCancel={() => setEditingAddress(undefined)} onSave={submitAddress} />}
                      {addressCount ? <div className={styles.addressList}>{data.addresses?.map((address) => (
                        <article className={styles.addressCard} key={address.name}>
                          <div className={styles.addressIcon}><MapPin size={19} aria-hidden="true" /></div>
                          <div className={styles.addressDetails}><div><strong>{address.address_title || address.city}</strong>{Boolean(address.is_primary_address) && <span className={styles.primaryBadge}>اصلی</span>}</div><p>{address.address_line1}{address.address_line2 ? `، ${address.address_line2}` : ""}</p><small>{[address.city, address.state, address.pincode, address.country].filter(Boolean).join("، ")}</small></div>
                          {deleteTarget === address.name ? <div className={styles.confirmDelete}><span>از فهرست نشانی‌ها برداشته شود؟</span><button type="button" disabled={busy} onClick={() => void runAction(() => archiveCustomerAddress(address.name), "نشانی از فهرست فعال برداشته شد.")}>بله</button><button type="button" onClick={() => setDeleteTarget("")}>نه</button></div> : <div className={styles.addressActions}><button type="button" aria-label={`ویرایش ${address.address_title || address.city}`} onClick={() => setEditingAddress(address)}><Pencil size={16} aria-hidden="true" /></button><button type="button" aria-label={`برداشتن ${address.address_title || address.city} از فهرست`} onClick={() => setDeleteTarget(address.name)}><Trash2 size={16} aria-hidden="true" /></button></div>}
                        </article>
                      ))}</div> : editingAddress === undefined && <EmptyState icon={MapPin} title="هنوز نشانی ذخیره نکرده‌ای" detail="نشانی خانه یا محل کارت را ذخیره کن تا برای ثبت سفارش بعدی آماده باشد." />}
                    </div>
                  )}

                  {tab === "profile" && (
                    <div className={styles.panelContent}>
                      <div className={styles.panelHeading}><div><span className={styles.eyebrow}>اطلاعات تماس تو</span><h2>اطلاعات من</h2></div></div>
                      <form className={styles.profileForm} onSubmit={submitProfile}>
                        <label>نام و نام خانوادگی<input required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={140} /></label>
                        <label>شمارهٔ موبایل<input type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷" /></label>
                        <label className={styles.spanTwo}>ایمیل حساب<input dir="ltr" type="email" value={data.profile?.email ?? ""} readOnly autoComplete="email" /><small>ایمیل ورود تغییر نمی‌کند؛ برای تغییر آن باید از تنظیمات امن حساب Frappe استفاده شود.</small></label>
                        <div className={styles.formActions}><button type="submit" className={styles.primaryAction} disabled={busy || (!data.accountReady && !data.customerSetupReady)}><Check size={17} aria-hidden="true" />{busy ? "در حال ذخیره…" : "ذخیرهٔ اطلاعات"}</button></div>
                      </form>
                    </div>
                  )}

                  {tab === "payments" && (
                    <div className={styles.panelContent}>
                      <div className={styles.panelHeading}><div><span className={styles.eyebrow}>شفاف و قابل پیگیری</span><h2>پرداخت‌های من</h2></div></div>
                      {paymentCount ? <div className={styles.paymentList}>{data.payments?.map((payment) => (
                        <article className={styles.paymentCard} key={payment.name}>
                          <span className={styles.paymentIcon}><CreditCard size={18} aria-hidden="true" /></span>
                          <div><strong>{payment.mode_of_payment || "پرداخت ثبت‌شده"}</strong><small>{faDate(payment.posting_date)} · {payment.name}</small></div>
                          <b>{formatToman(toDisplayTomans(payment.received_amount, payment.paid_to_account_currency))} <small>{payment.paid_to_account_currency}</small></b>
                        </article>
                      ))}</div> : <EmptyState icon={CreditCard} title="هنوز پرداخت ثبت‌شده‌ای نیست" detail="اینجا فقط پرداخت‌های قطعی ثبت‌شده در ERPNext نشان داده می‌شوند؛ پرداخت آزمایشی یا ناموفق نمایش داده نمی‌شود." />}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
