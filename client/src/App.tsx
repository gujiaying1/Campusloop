import { useEffect, useState } from "react";

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

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadListings() {
      try {
        const response = await fetch("/api/listings");
        if (!response.ok) {
          throw new Error("The server could not load listings.");
        }
        setListings((await response.json()) as Listing[]);
      } catch (caughtError) {
        console.error(caughtError);
        setError("Unable to load listings. Please make sure the backend is running and try again.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadListings();
  }, []);

  return (
    <main>
      <h1>CampusLoop</h1>
      {isLoading && <p>Loading listings…</p>}
      {error !== null && <p role="alert">{error}</p>}
      {!isLoading && error === null && listings.length > 0 && (
        <section aria-label="Listings">
          {listings.map((listing) => (
            <article key={listing.id}>
              <h2>{listing.title}</h2>
              <p>{new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(listing.priceCents / 100)}</p>
              <p>{listing.category.replace(/_/g, " ")} · {listing.condition.replace(/_/g, " ")} · {listing.location}</p>
            </article>
          ))}
        </section>
      )}
      {!isLoading && error === null && listings.length === 0 && <p>No listings are available yet.</p>}
    </main>
  );
}
