import { FormEvent, useEffect, useState } from "react";

type Listing = {
  id: number;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  condition: string;
  location: string;
  status: string;
  createdAt: string;
  seller: { id: number; name: string };
};

type BasicUser = { id: number; name: string; email: string };
type CurrentUser = BasicUser & { role: "USER" | "ADMIN"; createdAt: string };

type AuthMode = "login" | "register";
type View =
  | "marketplace"
  | "create"
  | "favourites"
  | "messages"
  | "reservations"
  | "admin";
type Language = "en" | "zh";

type ListingFilters = {
  search: string;
  category: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
  sort: "newest" | "price_asc" | "price_desc";
};

type Conversation = {
  id: number;
  buyerId: number;
  sellerId: number;
  listing: Listing;
  buyer: BasicUser;
  seller: BasicUser;
};
type Message = {
  id: number;
  content: string;
  createdAt: string;
  sender: BasicUser;
};
type Reservation = {
  id: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  listing: Listing;
  buyer: BasicUser;
};
type Report = {
  id: number;
  reason: string;
  status: "PENDING" | "DISMISSED" | "RESOLVED";
  createdAt: string;
  reporter: BasicUser;
  listing: Listing;
};

const categories = [
  "ELECTRONICS",
  "FURNITURE",
  "TEXTBOOKS",
  "CLOTHING",
  "HOME_LIVING",
  "OTHER",
];
const conditions = ["LIKE_NEW", "GOOD", "FAIR"];

const chinese: Record<string, string> = {
  Marketplace: "市场",
  Favourites: "收藏",
  Messages: "消息",
  Reservations: "预订",
  Admin: "管理",
  "Create listing": "发布商品",
  "Sign in": "登录",
  "Join CampusLoop": "加入 CampusLoop",
  "Log out": "退出登录",
  "Student marketplace": "校园二手市场",
  "Good things, close to campus.": "校园好物，就在身边。",
  "Sign in to save listings, message sellers, and make reservations.":
    "登录后即可收藏商品、联系卖家并预约。",
  "Log in": "登录",
  "Create account": "创建账号",
  Name: "姓名",
  "Massey email": "梅西大学邮箱",
  Password: "密码",
  "Confirm password": "确认密码",
  "Campus marketplace": "校园市场",
  "Find useful things around campus.": "发现校园周边的实用好物。",
  "Buy, sell and connect with students in your community.":
    "与校园社区的同学买卖和交流。",
  Browse: "浏览",
  "Your saved listings": "已收藏的商品",
  "Find your next useful thing": "寻找下一件实用好物",
  "Browse marketplace": "浏览市场",
  Search: "搜索",
  "Search listings": "搜索商品",
  Category: "分类",
  Condition: "成色",
  "All categories": "全部分类",
  "All conditions": "全部成色",
  "Min NZD": "最低价（NZD）",
  "Max NZD": "最高价（NZD）",
  Sort: "排序",
  Newest: "最新发布",
  "Price: low to high": "价格：从低到高",
  "Price: high to low": "价格：从高到低",
  Reset: "重置",
  "Saved listings": "已收藏商品",
  "Fresh around campus": "校园新上架",
  listing: "件商品",
  listings: "件商品",
  Save: "收藏",
  Edit: "编辑",
  Delete: "删除",
  Message: "联系卖家",
  Reserve: "预约",
  Report: "举报",
  "Sign in to interact": "登录后即可操作",
  "Nothing saved yet": "还没有收藏",
  "Save listings you like and they will appear here.":
    "收藏喜欢的商品后，它们会出现在这里。",
  "No listings match those filters": "没有符合筛选条件的商品",
  "Try broadening your search or resetting the filters.":
    "试试扩大搜索范围或重置筛选条件。",
  "Reset filters": "重置筛选",
  "Your listing": "你的商品",
  "Edit listing": "编辑商品",
  "Create a listing": "发布商品",
  "Keep the details clear so other students can decide quickly.":
    "清晰填写商品信息，方便其他同学快速决定。",
  Title: "标题",
  Description: "描述",
  "Price (NZD)": "价格（NZD）",
  Location: "地点",
  "Save changes": "保存修改",
  Cancel: "取消",
  "Publish listing": "发布商品",
  Inbox: "收件箱",
  "No conversations yet": "还没有会话",
  "Start by messaging a seller from a listing.": "从商品页联系卖家开始吧。",
  "Select a conversation": "选择一个会话",
  "Your messages will appear here.": "消息会显示在这里。",
  "Write a message…": "输入消息…",
  Send: "发送",
  "Your activity": "你的动态",
  "Keep track of items you are buying or selling.":
    "跟踪你正在购买或出售的商品。",
  "No reservations yet": "还没有预约",
  "When you request or receive a reservation, it will show up here.":
    "当你发起或收到预约时，会显示在这里。",
  "Cancel request": "取消预约",
  Accept: "接受",
  Decline: "拒绝",
  Administration: "管理",
  "Moderation queue": "审核队列",
  "Review reports and take proportionate action.": "查看举报并采取适当处理。",
  Administrator: "管理员",
  "No reports to review": "没有待处理的举报",
  "The moderation queue is currently clear.": "当前审核队列为空。",
  Dismiss: "忽略",
  "Remove listing": "下架商品",
  "Working…": "处理中…",
  "Report listing": "举报商品",
  "Tell us what is wrong with this listing. Your report will be reviewed by an administrator.":
    "请说明该商品的问题，管理员将审核你的举报。",
  Reason: "原因",
  "Submitting…": "提交中…",
  "Submit report": "提交举报",
  "Loading listings…": "正在加载商品…",
  "Checking sign-in status…": "正在检查登录状态…",
  "Report submitted.": "举报已提交。",
  ELECTRONICS: "电子产品",
  FURNITURE: "家具",
  TEXTBOOKS: "教材",
  CLOTHING: "服饰",
  HOME_LIVING: "家居用品",
  OTHER: "其他",
  "LIKE NEW": "几乎全新",
  GOOD: "良好",
  FAIR: "一般",
  AVAILABLE: "可预约",
  RESERVED: "已预约",
  SOLD: "已售出",
  PENDING: "待处理",
  ACCEPTED: "已接受",
  DECLINED: "已拒绝",
  CANCELLED: "已取消",
  DISMISSED: "已忽略",
  RESOLVED: "已处理",
};

function readable(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function categoryIllustration(category: string) {
  const illustrations: Record<string, string> = {
    ELECTRONICS: "🎧",
    FURNITURE: "🪑",
    TEXTBOOKS: "📚",
    CLOTHING: "🎒",
    HOME_LIVING: "💡",
    OTHER: "🫖",
  };
  return illustrations[category] ?? "🫖";
}

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [listingActionError, setListingActionError] = useState<string | null>(
    null,
  );
  const [filters, setFilters] = useState<ListingFilters>({
    search: "",
    category: "",
    condition: "",
    minPrice: "",
    maxPrice: "",
    sort: "newest",
  });
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("campusloop-language") === "zh" ? "zh" : "en",
  );
  const [favourites, setFavourites] = useState<Listing[]>([]);
  const [showFavourites, setShowFavourites] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reportingListing, setReportingListing] = useState<Listing | null>(
    null,
  );
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [activeView, setActiveView] = useState<View>("marketplace");
  const [showAuth, setShowAuth] = useState(false);
  const t = (value: string) =>
    language === "zh" ? (chinese[value] ?? value) : value;

  function listingsUrl(activeFilters: ListingFilters) {
    const params = new URLSearchParams();
    const addPrice = (value: string, name: "minPrice" | "maxPrice") => {
      if (!value.trim()) return;
      const dollars = Number(value);
      if (!Number.isFinite(dollars) || dollars < 0) {
        throw new Error(
          `${name === "minPrice" ? "Minimum" : "Maximum"} price must be a non-negative NZD amount.`,
        );
      }
      params.set(name, String(Math.round(dollars * 100)));
    };

    if (activeFilters.search.trim())
      params.set("search", activeFilters.search.trim());
    if (activeFilters.category) params.set("category", activeFilters.category);
    if (activeFilters.condition)
      params.set("condition", activeFilters.condition);
    if (activeFilters.sort !== "newest") params.set("sort", activeFilters.sort);
    addPrice(activeFilters.minPrice, "minPrice");
    addPrice(activeFilters.maxPrice, "maxPrice");

    const query = params.toString();
    return `/api/listings${query ? `?${query}` : ""}`;
  }

  async function refreshListings(activeFilters = filters) {
    const response = await fetch(listingsUrl(activeFilters));
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "The server could not load listings.");
    }
    setListings((await response.json()) as Listing[]);
    setError(null);
  }

  async function refreshFavourites() {
    const response = await fetch("/api/favourites");
    if (!response.ok) throw new Error("Unable to load favourites.");
    setFavourites((await response.json()) as Listing[]);
  }

  async function refreshConversations() {
    const response = await fetch("/api/conversations");
    if (!response.ok) throw new Error("Unable to load conversations.");
    setConversations((await response.json()) as Conversation[]);
  }
  async function refreshReservations() {
    const response = await fetch("/api/reservations");
    if (!response.ok) throw new Error("Unable to load reservations.");
    setReservations((await response.json()) as Reservation[]);
  }
  async function refreshReports() {
    const response = await fetch("/api/admin/reports");
    if (!response.ok) throw new Error("Unable to load reports.");
    setReports((await response.json()) as Report[]);
  }
  async function loadReports() {
    try {
      await refreshReports();
    } catch (caughtError) {
      setReportFeedback(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load reports.",
      );
    }
  }

  async function loadMessages(conversation: Conversation) {
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/messages`,
      );
      if (!response.ok) throw new Error("Unable to load messages.");
      setSelectedConversation(conversation);
      setMessages((await response.json()) as Message[]);
      setMessageError(null);
    } catch (caughtError) {
      setMessageError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load messages.",
      );
    }
  }

  useEffect(() => {
    async function loadListings() {
      try {
        await refreshListings();
      } catch (caughtError) {
        console.error(caughtError);
        setError(
          "Unable to load listings. Please make sure the backend is running and try again.",
        );
      } finally {
        setIsLoading(false);
      }
    }
    void loadListings();
  }, []);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.status === 401) return;
        if (!response.ok) throw new Error("Unable to check authentication.");
        setUser(((await response.json()) as { user: CurrentUser }).user);
        await refreshFavourites();
        await refreshConversations();
        await refreshReservations();
      } catch (caughtError) {
        console.error(caughtError);
        setAuthError("Unable to check your sign-in status.");
      } finally {
        setAuthLoading(false);
      }
    }
    void loadCurrentUser();
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    setAuthError(null);
    if (
      !email ||
      !password ||
      (authMode === "register" && !String(data.get("name") ?? "").trim())
    ) {
      setAuthError("Please complete all required fields.");
      return;
    }
    if (authMode === "register" && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    const payload =
      authMode === "register"
        ? { name: String(data.get("name")).trim(), email, password }
        : { email, password };

    try {
      const response = await fetch(
        `/api/auth/${authMode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as {
        user?: CurrentUser;
        error?: string;
      };
      if (!response.ok || !body.user)
        throw new Error(body.error ?? "Unable to sign in.");
      setUser(body.user);
      await refreshFavourites();
      await refreshConversations();
      await refreshReservations();
      event.currentTarget.reset();
    } catch (caughtError) {
      setAuthError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to sign in.",
      );
    }
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to log out.");
      setUser(null);
      setEditingListing(null);
      setFavourites([]);
      setShowFavourites(false);
      setConversations([]);
      setSelectedConversation(null);
      setMessages([]);
      setReservations([]);
    } catch (caughtError) {
      setAuthError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to log out.",
      );
    }
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const priceDollars = Number(data.get("price"));
    const priceCents = Math.round(priceDollars * 100);

    setListingActionError(null);
    if (!Number.isFinite(priceDollars) || priceCents <= 0) {
      setListingActionError("Enter a valid positive NZD price.");
      return;
    }

    const payload = {
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      priceCents,
      category: String(data.get("category") ?? ""),
      condition: String(data.get("condition") ?? ""),
      location: String(data.get("location") ?? "").trim(),
    };
    const endpoint = editingListing
      ? `/api/listings/${editingListing.id}`
      : "/api/listings";

    try {
      const response = await fetch(endpoint, {
        method: editingListing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Unable to save the listing.");
      await refreshListings();
      if (user) await refreshFavourites();
      setEditingListing(null);
      event.currentTarget.reset();
    } catch (caughtError) {
      setListingActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the listing.",
      );
    }
  }

  async function deleteListing(listing: Listing) {
    if (!window.confirm(`Delete “${listing.title}”?`)) return;
    setListingActionError(null);
    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to delete the listing.");
      }
      await refreshListings();
      if (user) await refreshFavourites();
      if (editingListing?.id === listing.id) setEditingListing(null);
    } catch (caughtError) {
      setListingActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete the listing.",
      );
    }
  }

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    try {
      await refreshListings(filters);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to filter listings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function clearFilters() {
    const clearedFilters = {
      search: "",
      category: "",
      condition: "",
      minPrice: "",
      maxPrice: "",
      sort: "newest" as const,
    };
    setFilters(clearedFilters);
    setIsLoading(true);
    try {
      await refreshListings(clearedFilters);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load listings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleFavourite(listing: Listing) {
    const isFavourited = favourites.some(
      (favourite) => favourite.id === listing.id,
    );
    setListingActionError(null);
    try {
      const response = await fetch(`/api/listings/${listing.id}/favourite`, {
        method: isFavourited ? "DELETE" : "POST",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to update favourite.");
      }
      await refreshFavourites();
    } catch (caughtError) {
      setListingActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update favourite.",
      );
    }
  }

  async function startConversation(listing: Listing) {
    try {
      const response = await fetch(
        `/api/listings/${listing.id}/conversations`,
        { method: "POST" },
      );
      const body = (await response.json()) as Conversation & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Unable to start conversation.");
      await refreshConversations();
      setActiveView("messages");
      await loadMessages(body);
    } catch (caughtError) {
      setMessageError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start conversation.",
      );
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation) return;
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "");
    try {
      const response = await fetch(
        `/api/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Unable to send message.");
      form.reset();
      await loadMessages(selectedConversation);
      await refreshConversations();
    } catch (caughtError) {
      setMessageError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to send message.",
      );
    }
  }
  async function reservationAction(url: string) {
    try {
      const response = await fetch(url, { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Unable to update reservation.");
      await refreshReservations();
      await refreshListings();
    } catch (caughtError) {
      setListingActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update reservation.",
      );
    }
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportingListing || isSubmittingReport) return;
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    );
    setIsSubmittingReport(true);
    try {
      const response = await fetch(
        `/api/listings/${reportingListing.id}/reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Unable to submit report.");
      setReportFeedback("Report submitted.");
      setReportingListing(null);
    } catch (caughtError) {
      setReportFeedback(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to submit report.",
      );
    } finally {
      setIsSubmittingReport(false);
    }
  }
  async function adminAction(url: string, refreshListingsAfter = false) {
    if (isModerating) return;
    setIsModerating(true);
    try {
      const response = await fetch(url, { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Moderation action failed.");
      await loadReports();
      if (refreshListingsAfter) {
        await refreshListings();
        await refreshFavourites();
      }
    } catch (caughtError) {
      setReportFeedback(
        caughtError instanceof Error
          ? caughtError.message
          : "Moderation action failed.",
      );
    } finally {
      setIsModerating(false);
    }
  }

  const displayedListings = showFavourites ? favourites : listings;
  const setView = (view: View) => {
    setActiveView(view);
    setShowFavourites(view === "favourites");
    if (view === "admin") void loadReports();
  };
  const viewTitle = showFavourites
    ? t("Saved listings")
    : t("Fresh around campus");
  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    localStorage.setItem("campusloop-language", nextLanguage);
  };

  return (
    <>
      <header className="site-header">
        <div className="nav-shell">
          <button
            className="brand"
            type="button"
            onClick={() => setView("marketplace")}
          >
            Campus<span>Loop</span>
          </button>
          <nav aria-label="Primary navigation">
            <button
              className={
                activeView === "marketplace" ? "nav-link is-active" : "nav-link"
              }
              onClick={() => setView("marketplace")}
            >
              {t("Marketplace")}
            </button>
            {user && (
              <>
                <button
                  className={
                    activeView === "favourites"
                      ? "nav-link is-active"
                      : "nav-link"
                  }
                  onClick={() => setView("favourites")}
                >
                  {t("Favourites")} <small>{favourites.length}</small>
                </button>
                <button
                  className={
                    activeView === "messages"
                      ? "nav-link is-active"
                      : "nav-link"
                  }
                  onClick={() => setView("messages")}
                >
                  {t("Messages")}
                </button>
                <button
                  className={
                    activeView === "reservations"
                      ? "nav-link is-active"
                      : "nav-link"
                  }
                  onClick={() => setView("reservations")}
                >
                  {t("Reservations")}
                </button>
              </>
            )}
          </nav>
          <div className="nav-actions">
            <div
              className="language-toggle"
              aria-label="Language"
              style={{ display: "flex", border: "1px solid #dcd7cf", borderRadius: 8, overflow: "hidden" }}
            >
              <button
                type="button"
                className={language === "en" ? "is-active" : ""}
                onClick={() => changeLanguage("en")}
                style={{ border: 0, padding: "6px 7px", background: language === "en" ? "#e8f4ef" : "#fff" }}
              >
                EN
              </button>
              <button
                type="button"
                className={language === "zh" ? "is-active" : ""}
                onClick={() => changeLanguage("zh")}
                style={{ border: 0, borderLeft: "1px solid #dcd7cf", padding: "6px 7px", background: language === "zh" ? "#e8f4ef" : "#fff" }}
              >
                中文
              </button>
            </div>
            {user ? (
              <>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setEditingListing(null);
                    setView("create");
                  }}
                >
                  {t("Create listing")}
                </button>
                {user.role === "ADMIN" && (
                  <button
                    className={
                      activeView === "admin"
                        ? "admin-button is-active"
                        : "admin-button"
                    }
                    onClick={() => setView("admin")}
                  >
                    {t("Admin")}
                  </button>
                )}
                <button
                  className="profile-button"
                  onClick={logout}
                  title={`${t("Log out")} ${user.email}`}
                >
                  {user.name}
                  <span>{t("Log out")}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className="nav-sign-in"
                  onClick={() => {
                    setAuthMode("login");
                    setShowAuth(true);
                  }}
                >
                  {t("Sign in")}
                </button>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setAuthMode("register");
                    setShowAuth(true);
                  }}
                >
                  {t("Join CampusLoop")}
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="app-shell">
        {!user && showAuth && (
          <section
            id="auth"
            aria-label="Authentication"
            className="auth-panel surface-card"
          >
            <div className="auth-copy">
              <p className="eyebrow">{t("Student marketplace")}</p>
              <h1>{t("Good things, close to campus.")}</h1>
              <p>{t("Sign in to save listings, message sellers, and make reservations.")}</p>
            </div>
            {authLoading && <p>{t("Checking sign-in status…")}</p>}
            {!authLoading && (
              <>
                <div className="auth-switch">
                  <button
                    className={authMode === "login" ? "is-selected" : ""}
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                    }}
                  >
                    {t("Log in")}
                  </button>
                  <button
                    className={authMode === "register" ? "is-selected" : ""}
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError(null);
                    }}
                  >
                    {t("Create account")}
                  </button>
                </div>
                <form onSubmit={submitAuth}>
                  {authMode === "register" && (
                    <label>
                      {t("Name")} <input name="name" autoComplete="name" />
                    </label>
                  )}
                  <label>
                    {t("Massey email")}{" "}
                    <input name="email" type="email" autoComplete="email" />
                  </label>
                  <label>
                    {t("Password")}{" "}
                    <input
                      name="password"
                      type="password"
                      autoComplete={
                        authMode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                    />
                  </label>
                  {authMode === "register" && (
                    <label>
                      {t("Confirm password")}{" "}
                      <input
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                      />
                    </label>
                  )}
                  <button className="button button-primary" type="submit">
                    {authMode === "login" ? t("Log in") : t("Create account")}
                  </button>
                </form>
              </>
            )}
            {authError && (
              <p className="notice notice-error" role="alert">
                {authError}
              </p>
            )}
          </section>
        )}

        {(activeView === "marketplace" || activeView === "favourites") && (
          <>
            <section className="market-hero">
              <div>
                <p className="eyebrow">{t("Campus marketplace")}</p>
                <h1>{t("Find useful things around campus.")}</h1>
                <p>{t("Buy, sell and connect with students in your community.")}</p>
              </div>
            </section>
            <section aria-label="Listing filters" className="filters">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("Browse")}</p>
                  <h2>
                    {activeView === "favourites"
                      ? t("Your saved listings")
                      : t("Find your next useful thing")}
                  </h2>
                </div>
                {activeView === "favourites" && (
                  <button
                    className="button button-secondary"
                    onClick={() => setView("marketplace")}
                  >
                    {t("Browse marketplace")}
                  </button>
                )}
              </div>
              <form onSubmit={applyFilters}>
                <label className="search-field">
                  <span>{t("Search")}</span>
                  <input
                    value={filters.search}
                    onChange={(event) =>
                      setFilters({ ...filters, search: event.target.value })
                    }
                    placeholder={t("Search listings")}
                  />
                </label>
                <label>
                  {t("Category")}
                  <select
                    value={filters.category}
                    onChange={(event) =>
                      setFilters({ ...filters, category: event.target.value })
                    }
                  >
                    <option value="">{t("All categories")}</option>
                    {categories.map((category) => (
                      <option key={category}>{t(readable(category))}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Condition")}
                  <select
                    value={filters.condition}
                    onChange={(event) =>
                      setFilters({ ...filters, condition: event.target.value })
                    }
                  >
                    <option value="">{t("All conditions")}</option>
                    {conditions.map((condition) => (
                      <option key={condition}>{t(readable(condition))}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Sort")}
                  <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as ListingFilters["sort"] })}>
                    <option value="newest">{t("Newest")}</option>
                    <option value="price_asc">{t("Price: low to high")}</option>
                    <option value="price_desc">{t("Price: high to low")}</option>
                  </select>
                </label>
                <div className="price-fields">
                  <label>
                    {t("Min NZD")}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={filters.minPrice}
                      onChange={(event) =>
                        setFilters({ ...filters, minPrice: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    {t("Max NZD")}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={filters.maxPrice}
                      onChange={(event) =>
                        setFilters({ ...filters, maxPrice: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="filter-actions">
                  <button className="button button-primary" type="submit">
                    {t("Search")}
                  </button>
                  <button
                    className="button button-quiet"
                    type="button"
                    onClick={() => void clearFilters()}
                  >
                    {t("Reset")}
                  </button>
                </div>
              </form>
            </section>
            {isLoading && <p className="state-card">{t("Loading listings…")}</p>}
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
            {!isLoading && !error && (
              <section className="listing-section">
                <div className="section-heading">
                  <h2>{viewTitle}</h2>
                  <span className="result-count">
                    {displayedListings.length}{" "}
                    {t(displayedListings.length === 1 ? "listing" : "listings")}
                  </span>
                </div>
                {displayedListings.length > 0 ? (
                  <div className="listing-grid">
                    {displayedListings.map((listing) => (
                      <article className="listing-card" key={listing.id}>
                        <div
                          className={`listing-media category-${listing.category.toLowerCase()}`}
                        >
                          <span
                            className="listing-illustration"
                            role="img"
                            aria-label={readable(listing.category)}
                          >
                            {categoryIllustration(listing.category)}
                          </span>
                          {user && (
                            <button
                              className={
                                favourites.some(
                                  (favourite) => favourite.id === listing.id,
                                )
                                  ? "favourite-button is-saved"
                                  : "favourite-button"
                              }
                              aria-label={
                                favourites.some(
                                  (favourite) => favourite.id === listing.id,
                                )
                                  ? "Remove from favourites"
                                  : "Add to favourites"
                              }
                              onClick={() => void toggleFavourite(listing)}
                            >
                              {t("Save")}
                            </button>
                          )}
                        </div>
                        <div className="listing-card-body">
                          <div className="listing-card-topline">
                            <span className="metadata">
                              {t(readable(listing.category))} ·{" "}
                              {t(readable(listing.condition))}
                            </span>
                            <span className="metadata">{listing.location}</span>
                          </div>
                          <h3>{listing.title}</h3>
                          <p className="price">
                            {new Intl.NumberFormat("en-NZ", {
                              style: "currency",
                              currency: "NZD",
                            }).format(listing.priceCents / 100)}
                          </p>
                          <p className="seller-line">
                            {language === "zh" ? "发布者：" : "Listed by "}{listing.seller.name}
                          </p>
                          <div className="card-actions">
                            {user?.id === listing.seller.id ? (
                              <>
                                <button
                                  className="button button-secondary"
                                  onClick={() => {
                                    setEditingListing(listing);
                                    setListingActionError(null);
                                    setView("create");
                                  }}
                                >
                                  {t("Edit")}
                                </button>
                                <button
                                  className="text-button danger"
                                  onClick={() => void deleteListing(listing)}
                                >
                                  {t("Delete")}
                                </button>
                              </>
                            ) : user ? (
                              <>
                                <button
                                  className="button button-primary"
                                  onClick={() =>
                                    void startConversation(listing)
                                  }
                                >
                                  {t("Message")}
                                </button>
                                {listing.status === "AVAILABLE" && (
                                  <button
                                    className="button button-secondary"
                                    onClick={() =>
                                      void reservationAction(
                                        `/api/listings/${listing.id}/reservations`,
                                      )
                                    }
                                  >
                                    {t("Reserve")}
                                  </button>
                                )}
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setReportingListing(listing);
                                    setReportFeedback(null);
                                  }}
                                >
                                  {t("Report")}
                                </button>
                              </>
                            ) : (
                              <span className="metadata">
                                {t("Sign in to interact")}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <h3>
                      {activeView === "favourites"
                        ? t("Nothing saved yet")
                        : t("No listings match those filters")}
                    </h3>
                    <p>
                      {activeView === "favourites"
                        ? t("Save listings you like and they will appear here.")
                        : t("Try broadening your search or resetting the filters.")}
                    </p>
                    {activeView === "favourites" ? (
                      <button
                        className="button button-primary"
                        onClick={() => setView("marketplace")}
                      >
                        {t("Browse marketplace")}
                      </button>
                    ) : (
                      <button
                        className="button button-secondary"
                        onClick={() => void clearFilters()}
                      >
                        {t("Reset filters")}
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {user && activeView === "create" && (
          <section
            aria-label="Manage listings"
            className="listing-form surface-card"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("Your listing")}</p>
                <h1>{editingListing ? t("Edit listing") : t("Create a listing")}</h1>
                <p>{t("Keep the details clear so other students can decide quickly.")}</p>
              </div>
            </div>
            <form key={editingListing?.id ?? "new"} onSubmit={submitListing}>
              <label className="form-wide">
                {t("Title")}
                <input
                  name="title"
                  required
                  defaultValue={editingListing?.title ?? ""}
                />
              </label>
              <label className="form-wide">
                {t("Description")}
                <textarea
                  name="description"
                  required
                  defaultValue={editingListing?.description ?? ""}
                />
              </label>
              <label>
                {t("Price (NZD)")}
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={
                    editingListing
                      ? (editingListing.priceCents / 100).toFixed(2)
                      : ""
                  }
                />
              </label>
              <label>
                {t("Location")}
                <input
                  name="location"
                  required
                  defaultValue={editingListing?.location ?? ""}
                />
              </label>
              <label>
                {t("Category")}
                <select
                  name="category"
                  defaultValue={editingListing?.category ?? "OTHER"}
                >
                  {categories.map((category) => (
                    <option key={category}>{t(readable(category))}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("Condition")}
                <select
                  name="condition"
                  defaultValue={editingListing?.condition ?? "GOOD"}
                >
                  {conditions.map((condition) => (
                    <option key={condition}>{t(readable(condition))}</option>
                  ))}
                </select>
              </label>
              <div className="listing-form-actions form-wide">
                <button className="button button-primary" type="submit">
                  {editingListing ? t("Save changes") : t("Publish listing")}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setEditingListing(null);
                    setView("marketplace");
                  }}
                >
                  {t("Cancel")}
                </button>
              </div>
            </form>
            {listingActionError && (
              <p className="notice notice-error" role="alert">
                {listingActionError}
              </p>
            )}
          </section>
        )}

        {user && activeView === "messages" && (
          <section
            aria-label="Messages"
            className="messages-panel surface-card"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("Inbox")}</p>
                <h1>{t("Messages")}</h1>
              </div>
            </div>
            <div className="message-layout">
              <div className="conversation-list">
                {conversations.length === 0 ? (
                  <div className="empty-state compact">
                    <h3>{t("No conversations yet")}</h3>
                    <p>{t("Start by messaging a seller from a listing.")}</p>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      className={
                        selectedConversation?.id === conversation.id
                          ? "conversation-item is-active"
                          : "conversation-item"
                      }
                      key={conversation.id}
                      type="button"
                      onClick={() => void loadMessages(conversation)}
                    >
                      <strong>{conversation.listing.title}</strong>
                      <span>
                        {conversation.buyerId === user.id
                          ? conversation.seller.name
                          : conversation.buyer.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="message-thread">
                {selectedConversation ? (
                  <>
                    <div className="thread-header">
                      <div>
                        <h2>{selectedConversation.listing.title}</h2>
                        <p>
                          {selectedConversation.buyerId === user.id
                            ? selectedConversation.seller.name
                            : selectedConversation.buyer.name}
                        </p>
                      </div>
                    </div>
                    <div className="message-history">
                      {messages.map((message) => (
                        <p
                          className={
                            message.sender.id === user.id
                              ? "message-bubble mine"
                              : "message-bubble"
                          }
                          key={message.id}
                        >
                          <strong>{message.sender.name}</strong>
                          {message.content}
                        </p>
                      ))}
                    </div>
                    <form onSubmit={sendMessage}>
                      <div className="message-compose">
                        <textarea
                          aria-label={t("Message")}
                          name="content"
                          required
                          placeholder={t("Write a message…")}
                        />
                        <button className="button button-primary" type="submit">
                          {t("Send")}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="empty-state">
                    <h3>{t("Select a conversation")}</h3>
                    <p>{t("Your messages will appear here.")}</p>
                  </div>
                )}
              </div>
            </div>
            {messageError && (
              <p className="notice notice-error" role="alert">
                {messageError}
              </p>
            )}
          </section>
        )}

        {user && activeView === "reservations" && (
          <section aria-label="Reservations" className="reservations-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("Your activity")}</p>
                <h1>{t("Reservations")}</h1>
                <p>{t("Keep track of items you are buying or selling.")}</p>
              </div>
            </div>
            {reservations.length === 0 ? (
              <div className="empty-state surface-card">
                <h3>{t("No reservations yet")}</h3>
                <p>{t("When you request or receive a reservation, it will show up here.")}</p>
                <button
                  className="button button-primary"
                  onClick={() => setView("marketplace")}
                >
                  {t("Browse marketplace")}
                </button>
              </div>
            ) : (
              <div className="reservation-grid">
                {reservations.map((reservation) => (
                  <article
                    className="reservation-card surface-card"
                    key={reservation.id}
                  >
                    <div>
                      <span
                        className={`status-badge status-${reservation.status.toLowerCase()}`}
                      >
                        {t(readable(reservation.status))}
                      </span>
                      <h2>{reservation.listing.title}</h2>
                      <p>
                        {reservation.listing.location} ·{" "}
                        {reservation.buyer.id === user.id
                          ? "Your request"
                          : `Requested by ${reservation.buyer.name}`}
                      </p>
                    </div>
                    {reservation.buyer.id === user.id &&
                      reservation.status === "PENDING" && (
                        <button
                          className="button button-secondary"
                          onClick={() =>
                            void reservationAction(
                              `/api/reservations/${reservation.id}/cancel`,
                            )
                          }
                        >
                          {t("Cancel request")}
                        </button>
                      )}
                    {reservation.listing.seller.id === user.id &&
                      reservation.status === "PENDING" && (
                        <div className="card-actions">
                          <button
                            className="button button-primary"
                            onClick={() =>
                              void reservationAction(
                                `/api/reservations/${reservation.id}/accept`,
                              )
                            }
                          >
                            {t("Accept")}
                          </button>
                          <button
                            className="button button-secondary"
                            onClick={() =>
                              void reservationAction(
                                `/api/reservations/${reservation.id}/decline`,
                              )
                            }
                          >
                            {t("Decline")}
                          </button>
                        </div>
                      )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {user?.role === "ADMIN" && activeView === "admin" && (
          <section
            aria-label="Admin moderation"
            className="admin-panel surface-card"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("Administration")}</p>
                <h1>{t("Moderation queue")}</h1>
                <p>{t("Review reports and take proportionate action.")}</p>
              </div>
              <span className="admin-label">{t("Administrator")}</span>
            </div>
            {reports.length === 0 ? (
              <div className="empty-state">
                <h3>{t("No reports to review")}</h3>
                <p>{t("The moderation queue is currently clear.")}</p>
              </div>
            ) : (
              <div className="report-list">
                {reports.map((report) => (
                  <article className="report-card" key={report.id}>
                    <div className="report-main">
                      <div className="report-meta">
                        <span
                          className={`status-badge status-${report.status.toLowerCase()}`}
                        >
                          {t(readable(report.status))}
                        </span>
                        <span>{formatDate(report.createdAt)}</span>
                      </div>
                      <h2>{report.listing.title}</h2>
                      <p className="report-reason">“{report.reason}”</p>
                      <p className="metadata">
                        {language === "zh" ? "举报人：" : "Reported by "}{report.reporter.name} ·{" "}
                        {report.reporter.email}
                      </p>
                    </div>
                    {report.status === "PENDING" && (
                      <div className="report-actions">
                        <button
                          disabled={isModerating}
                          className="button button-secondary"
                          type="button"
                          onClick={() =>
                            void adminAction(
                              `/api/admin/reports/${report.id}/dismiss`,
                            )
                          }
                        >
                          {isModerating ? t("Working…") : t("Dismiss")}
                        </button>
                        <button
                          disabled={isModerating}
                          className="button button-danger"
                          type="button"
                          onClick={() =>
                            void adminAction(
                              `/api/admin/reports/${report.id}/remove-listing`,
                              true,
                            )
                          }
                        >
                          {t("Remove listing")}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {reportingListing && (
          <section
            aria-label="Report listing"
            className="report-form surface-card"
          >
            <div>
              <p className="eyebrow">{t("Report listing")}</p>
              <h2>{reportingListing.title}</h2>
              <p>
                {t("Tell us what is wrong with this listing. Your report will be reviewed by an administrator.")}
              </p>
            </div>
            <form onSubmit={submitReport}>
              <label>
                {t("Reason")}
                <textarea name="reason" required />
              </label>
              <div className="listing-form-actions">
                <button
                  disabled={isSubmittingReport}
                  className="button button-primary"
                  type="submit"
                >
                  {isSubmittingReport ? t("Submitting…") : t("Submit report")}
                </button>
                <button
                  disabled={isSubmittingReport}
                  className="button button-secondary"
                  type="button"
                  onClick={() => setReportingListing(null)}
                >
                  {t("Cancel")}
                </button>
              </div>
            </form>
          </section>
        )}
        {reportFeedback && (
          <p className="notice notice-success" role="status">
            {reportFeedback}
          </p>
        )}
      </main>
    </>
  );
}
