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

type ListingFilters = {
  search: string;
  category: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
};

type Conversation = { id: number; buyerId: number; sellerId: number; listing: Listing; buyer: BasicUser; seller: BasicUser };
type Message = { id: number; content: string; createdAt: string; sender: BasicUser };
type Reservation = { id: number; status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"; listing: Listing; buyer: BasicUser };
type Report = { id: number; reason: string; status: "PENDING" | "DISMISSED" | "RESOLVED"; createdAt: string; reporter: BasicUser; listing: Listing };

const categories = ["ELECTRONICS", "FURNITURE", "TEXTBOOKS", "CLOTHING", "HOME_LIVING", "OTHER"];
const conditions = ["LIKE_NEW", "GOOD", "FAIR"];

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [listingActionError, setListingActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListingFilters>({ search: "", category: "", condition: "", minPrice: "", maxPrice: "" });
  const [favourites, setFavourites] = useState<Listing[]>([]);
  const [showFavourites, setShowFavourites] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reportingListing, setReportingListing] = useState<Listing | null>(null);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isModerating, setIsModerating] = useState(false);

  function listingsUrl(activeFilters: ListingFilters) {
    const params = new URLSearchParams();
    const addPrice = (value: string, name: "minPrice" | "maxPrice") => {
      if (!value.trim()) return;
      const dollars = Number(value);
      if (!Number.isFinite(dollars) || dollars < 0) {
        throw new Error(`${name === "minPrice" ? "Minimum" : "Maximum"} price must be a non-negative NZD amount.`);
      }
      params.set(name, String(Math.round(dollars * 100)));
    };

    if (activeFilters.search.trim()) params.set("search", activeFilters.search.trim());
    if (activeFilters.category) params.set("category", activeFilters.category);
    if (activeFilters.condition) params.set("condition", activeFilters.condition);
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
    try { await refreshReports(); } catch (caughtError) { setReportFeedback(caughtError instanceof Error ? caughtError.message : "Unable to load reports."); }
  }

  async function loadMessages(conversation: Conversation) {
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`);
      if (!response.ok) throw new Error("Unable to load messages.");
      setSelectedConversation(conversation);
      setMessages((await response.json()) as Message[]);
      setMessageError(null);
    } catch (caughtError) { setMessageError(caughtError instanceof Error ? caughtError.message : "Unable to load messages."); }
  }

  useEffect(() => {
    async function loadListings() {
      try {
        await refreshListings();
      } catch (caughtError) {
        console.error(caughtError);
        setError("Unable to load listings. Please make sure the backend is running and try again.");
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
    if (!email || !password || (authMode === "register" && !String(data.get("name") ?? "").trim())) {
      setAuthError("Please complete all required fields.");
      return;
    }
    if (authMode === "register" && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    const payload = authMode === "register"
      ? { name: String(data.get("name")).trim(), email, password }
      : { email, password };

    try {
      const response = await fetch(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { user?: CurrentUser; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error ?? "Unable to sign in.");
      setUser(body.user);
      await refreshFavourites();
      await refreshConversations();
      await refreshReservations();
      event.currentTarget.reset();
    } catch (caughtError) {
      setAuthError(caughtError instanceof Error ? caughtError.message : "Unable to sign in.");
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
      setAuthError(caughtError instanceof Error ? caughtError.message : "Unable to log out.");
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
      location: String(data.get("location") ?? "").trim()
    };
    const endpoint = editingListing ? `/api/listings/${editingListing.id}` : "/api/listings";

    try {
      const response = await fetch(endpoint, {
        method: editingListing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to save the listing.");
      await refreshListings();
      if (user) await refreshFavourites();
      setEditingListing(null);
      event.currentTarget.reset();
    } catch (caughtError) {
      setListingActionError(caughtError instanceof Error ? caughtError.message : "Unable to save the listing.");
    }
  }

  async function deleteListing(listing: Listing) {
    if (!window.confirm(`Delete “${listing.title}”?`)) return;
    setListingActionError(null);
    try {
      const response = await fetch(`/api/listings/${listing.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to delete the listing.");
      }
      await refreshListings();
      if (user) await refreshFavourites();
      if (editingListing?.id === listing.id) setEditingListing(null);
    } catch (caughtError) {
      setListingActionError(caughtError instanceof Error ? caughtError.message : "Unable to delete the listing.");
    }
  }

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    try {
      await refreshListings(filters);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to filter listings.");
    } finally {
      setIsLoading(false);
    }
  }

  async function clearFilters() {
    const clearedFilters = { search: "", category: "", condition: "", minPrice: "", maxPrice: "" };
    setFilters(clearedFilters);
    setIsLoading(true);
    try {
      await refreshListings(clearedFilters);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load listings.");
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleFavourite(listing: Listing) {
    const isFavourited = favourites.some((favourite) => favourite.id === listing.id);
    setListingActionError(null);
    try {
      const response = await fetch(`/api/listings/${listing.id}/favourite`, { method: isFavourited ? "DELETE" : "POST" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to update favourite.");
      }
      await refreshFavourites();
    } catch (caughtError) {
      setListingActionError(caughtError instanceof Error ? caughtError.message : "Unable to update favourite.");
    }
  }

  async function startConversation(listing: Listing) {
    try {
      const response = await fetch(`/api/listings/${listing.id}/conversations`, { method: "POST" });
      const body = (await response.json()) as Conversation & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to start conversation.");
      await refreshConversations();
      await loadMessages(body);
    } catch (caughtError) { setMessageError(caughtError instanceof Error ? caughtError.message : "Unable to start conversation."); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation) return;
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "");
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to send message.");
      form.reset();
      await loadMessages(selectedConversation);
      await refreshConversations();
    } catch (caughtError) { setMessageError(caughtError instanceof Error ? caughtError.message : "Unable to send message."); }
  }
  async function reservationAction(url: string) {
    try { const response = await fetch(url, { method: "POST" }); const body = (await response.json()) as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Unable to update reservation."); await refreshReservations(); await refreshListings(); }
    catch (caughtError) { setListingActionError(caughtError instanceof Error ? caughtError.message : "Unable to update reservation."); }
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reportingListing || isSubmittingReport) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    setIsSubmittingReport(true); try { const response = await fetch(`/api/listings/${reportingListing.id}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }); const body = (await response.json()) as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Unable to submit report."); setReportFeedback("Report submitted."); setReportingListing(null); }
    catch (caughtError) { setReportFeedback(caughtError instanceof Error ? caughtError.message : "Unable to submit report."); } finally { setIsSubmittingReport(false); }
  }
  async function adminAction(url: string, refreshListingsAfter = false) {
    if (isModerating) return; setIsModerating(true); try { const response = await fetch(url, { method: "POST" }); const body = (await response.json()) as { error?: string }; if (!response.ok) throw new Error(body.error ?? "Moderation action failed."); await loadReports(); if (refreshListingsAfter) { await refreshListings(); await refreshFavourites(); } }
    catch (caughtError) { setReportFeedback(caughtError instanceof Error ? caughtError.message : "Moderation action failed."); } finally { setIsModerating(false); }
  }

  const displayedListings = showFavourites ? favourites : listings;

  return (
    <main>
      <h1>CampusLoop</h1>
      <section aria-label="Authentication" className="auth-panel">
        {authLoading && <p>Checking sign-in status…</p>}
        {!authLoading && user && (
          <p>Signed in as <strong>{user.name}</strong> ({user.email}) <button type="button" onClick={logout}>Log out</button></p>
        )}
        {!authLoading && !user && (
          <>
            <div className="auth-switch">
              <button type="button" onClick={() => { setAuthMode("login"); setAuthError(null); }}>Log in</button>
              <button type="button" onClick={() => { setAuthMode("register"); setAuthError(null); }}>Register</button>
            </div>
            <form onSubmit={submitAuth}>
              {authMode === "register" && <label>Name <input name="name" autoComplete="name" /></label>}
              <label>Massey email <input name="email" type="email" autoComplete="email" /></label>
              <label>Password <input name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label>
              {authMode === "register" && <label>Confirm password <input name="confirmPassword" type="password" autoComplete="new-password" /></label>}
              <button type="submit">{authMode === "login" ? "Log in" : "Create account"}</button>
            </form>
          </>
        )}
        {authError && <p role="alert">{authError}</p>}
      </section>
      {user && (
        <section aria-label="Manage listings" className="listing-form">
          <h2>{editingListing ? "Edit listing" : "Create listing"}</h2>
          <form key={editingListing?.id ?? "new"} onSubmit={submitListing}>
            <label>Title <input name="title" required defaultValue={editingListing?.title ?? ""} /></label>
            <label>Description <textarea name="description" required defaultValue={editingListing?.description ?? ""} /></label>
            <label>Price (NZD) <input name="price" type="number" min="0.01" step="0.01" required defaultValue={editingListing ? (editingListing.priceCents / 100).toFixed(2) : ""} /></label>
            <label>Category <select name="category" defaultValue={editingListing?.category ?? "OTHER"}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>Condition <select name="condition" defaultValue={editingListing?.condition ?? "GOOD"}>{conditions.map((condition) => <option key={condition}>{condition}</option>)}</select></label>
            <label>Location <input name="location" required defaultValue={editingListing?.location ?? ""} /></label>
            <div className="listing-form-actions">
              <button type="submit">{editingListing ? "Save changes" : "Create listing"}</button>
              {editingListing && <button type="button" onClick={() => setEditingListing(null)}>Cancel</button>}
            </div>
          </form>
          {listingActionError && <p role="alert">{listingActionError}</p>}
        </section>
      )}
      {user?.role === "ADMIN" && <div className="favourite-view-toggle"><button type="button" onClick={() => { setShowAdmin(!showAdmin); if (!showAdmin) void loadReports(); }}>Admin moderation</button></div>}
      {user?.role === "ADMIN" && showAdmin && <section aria-label="Admin moderation" className="messages-panel"><h2>Moderation</h2>{reports.map((report) => <article key={report.id}><strong>{report.status}</strong><p>{report.reason}</p><p>{report.listing.title} — reported by {report.reporter.name} ({report.reporter.email})</p>{report.status === "PENDING" && <p className="listing-actions"><button disabled={isModerating} type="button" onClick={() => void adminAction(`/api/admin/reports/${report.id}/dismiss`)}>{isModerating ? "Working..." : "Dismiss"}</button><button disabled={isModerating} type="button" onClick={() => void adminAction(`/api/admin/reports/${report.id}/remove-listing`, true)}>Remove Listing</button></p>}</article>)}</section>}
      {user && <section aria-label="Reservations" className="messages-panel"><h2>Reservations</h2>{reservations.length === 0 ? <p>No reservations yet.</p> : reservations.map((reservation) => <div key={reservation.id}><strong>{reservation.listing.title}</strong> — {reservation.status} {reservation.buyer.id === user.id && reservation.status === "PENDING" && <button type="button" onClick={() => void reservationAction(`/api/reservations/${reservation.id}/cancel`)}>Cancel</button>} {reservation.listing.seller.id === user.id && reservation.status === "PENDING" && <><button type="button" onClick={() => void reservationAction(`/api/reservations/${reservation.id}/accept`)}>Accept</button><button type="button" onClick={() => void reservationAction(`/api/reservations/${reservation.id}/decline`)}>Decline</button></>}</div>)}</section>}
      {user && (
        <div className="favourite-view-toggle">
          <button type="button" onClick={() => setShowFavourites(false)}>All listings</button>
          <button type="button" onClick={() => setShowFavourites(true)}>Favourites ({favourites.length})</button>
        </div>
      )}
      {user && (
        <section aria-label="Messages" className="messages-panel">
          <h2>Messages</h2>
          <div className="conversation-list">{conversations.length === 0 ? <p>No conversations yet.</p> : conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => void loadMessages(conversation)}>{conversation.listing.title} — {conversation.buyerId === user.id ? conversation.seller.name : conversation.buyer.name}</button>)}</div>
          {selectedConversation && <div className="message-thread"><h3>{selectedConversation.listing.title}</h3>{messages.map((message) => <p key={message.id}><strong>{message.sender.name}:</strong> {message.content}</p>)}<form onSubmit={sendMessage}><label>Message <textarea name="content" required /></label><button type="submit">Send</button></form></div>}
          {messageError && <p role="alert">{messageError}</p>}
        </section>
      )}
      <section aria-label="Listing filters" className="filters">
        <h2>Find listings</h2>
        <form onSubmit={applyFilters}>
          <label>Keyword <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search title or description" /></label>
          <label>Category <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Condition <select value={filters.condition} onChange={(event) => setFilters({ ...filters, condition: event.target.value })}><option value="">All conditions</option>{conditions.map((condition) => <option key={condition}>{condition}</option>)}</select></label>
          <label>Minimum price (NZD) <input type="number" min="0" step="0.01" value={filters.minPrice} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} /></label>
          <label>Maximum price (NZD) <input type="number" min="0" step="0.01" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} /></label>
          <div className="filter-actions"><button type="submit">Apply filters</button><button type="button" onClick={() => void clearFilters()}>Clear filters</button></div>
        </form>
      </section>
      {isLoading && <p>Loading listings…</p>}
      {error !== null && <p role="alert">{error}</p>}
      {!isLoading && error === null && displayedListings.length > 0 && (
        <section aria-label={showFavourites ? "Favourites" : "Listings"}>
          {displayedListings.map((listing) => (
            <article key={listing.id}>
              <h2>{listing.title}</h2>
              <p>{new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(listing.priceCents / 100)}</p>
              <p>{listing.category.replace(/_/g, " ")} · {listing.condition.replace(/_/g, " ")} · {listing.location}</p>
              {user?.id === listing.seller.id && (
                <p className="listing-actions">
                  <button type="button" onClick={() => { setEditingListing(listing); setListingActionError(null); }}>Edit</button>
                  <button type="button" onClick={() => void deleteListing(listing)}>Delete</button>
                </p>
              )}
              {user && (
                <p className="listing-actions">
                  <button type="button" onClick={() => void toggleFavourite(listing)}>
                    {favourites.some((favourite) => favourite.id === listing.id) ? "Unfavourite" : "Favourite"}
                  </button>
                </p>
              )}
              {user && user.id !== listing.seller.id && <p className="listing-actions"><button type="button" onClick={() => void startConversation(listing)}>Message seller</button></p>}
              {user && user.id !== listing.seller.id && <p className="listing-actions"><button type="button" onClick={() => { setReportingListing(listing); setReportFeedback(null); }}>Report</button></p>}
              {user && user.id !== listing.seller.id && listing.status === "AVAILABLE" && <p className="listing-actions"><button type="button" onClick={() => void reservationAction(`/api/listings/${listing.id}/reservations`)}>Request reservation</button></p>}
              {user && user.id === listing.seller.id && listing.status === "RESERVED" && <p className="listing-actions"><button type="button" onClick={() => void reservationAction(`/api/listings/${listing.id}/sold`)}>Mark sold</button></p>}
            </article>
          ))}
        </section>
      )}
      {reportingListing && <section aria-label="Report listing" className="messages-panel"><h2>Report {reportingListing.title}</h2><form onSubmit={submitReport}><label>Reason <textarea name="reason" required /></label><button disabled={isSubmittingReport} type="submit">{isSubmittingReport ? "Submitting..." : "Submit Report"}</button><button disabled={isSubmittingReport} type="button" onClick={() => setReportingListing(null)}>Cancel</button></form></section>}
      {reportFeedback && <p role="status">{reportFeedback}</p>}
      {!isLoading && error === null && displayedListings.length === 0 && <p>{showFavourites ? "You have no favourites yet." : "No listings match these filters."}</p>}
    </main>
  );
}
