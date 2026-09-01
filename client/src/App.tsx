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

type CurrentUser = { id: number; name: string; email: string; createdAt: string };

type AuthMode = "login" | "register";

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

  async function refreshListings() {
    const response = await fetch("/api/listings");
    if (!response.ok) throw new Error("The server could not load listings.");
    setListings((await response.json()) as Listing[]);
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
      if (editingListing?.id === listing.id) setEditingListing(null);
    } catch (caughtError) {
      setListingActionError(caughtError instanceof Error ? caughtError.message : "Unable to delete the listing.");
    }
  }

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
      {isLoading && <p>Loading listings…</p>}
      {error !== null && <p role="alert">{error}</p>}
      {!isLoading && error === null && listings.length > 0 && (
        <section aria-label="Listings">
          {listings.map((listing) => (
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
            </article>
          ))}
        </section>
      )}
      {!isLoading && error === null && listings.length === 0 && <p>No listings are available yet.</p>}
    </main>
  );
}
