import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Brand } from "../../components/ui/Brand";
import { apiMessage } from "../../lib/api";
import { getProviders, providerCategories } from "../../lib/providers";
import { Icon } from "../../components/ui/Icon";
import type { IconName } from "../../components/ui/Icon";
import type { WeddingDetails } from "../../lib/weddings";

const categories: {
  id: string;
  name: string;
  query: string;
  icon: IconName;
  description: string;
}[] = [
  {
    id: "catering",
    name: "Catering",
    query: "wedding caterers",
    icon: "food",
    description: "Wedding menus, meal counters and catering teams.",
  },
  {
    id: "photography",
    name: "Photography",
    query: "wedding photographers",
    icon: "camera",
    description: "Wedding photography and videography.",
  },
  {
    id: "decoration",
    name: "Decoration",
    query: "wedding decorators",
    icon: "tent",
    description: "Flowers, mandap decoration and stage setups.",
  },
  {
    id: "lighting",
    name: "Lighting",
    query: "wedding lighting services",
    icon: "tent",
    description: "Lighting for the stage, venue and outdoor areas.",
  },
  {
    id: "tent",
    name: "Tent & Mandap",
    query: "wedding tent house mandap",
    icon: "tent",
    description: "Tents, mandaps and seating arrangements.",
  },
  {
    id: "music",
    name: "Music & Rituals",
    query: "wedding band shehnai services",
    icon: "music",
    description: "Wedding bands, shehnai and ceremony services.",
  },
];

export function NearbyServices({ wedding }: { wedding: WeddingDetails }) {
  return (
    <section className="dash-nearby-section">
      <div className="dash-section-heading">
        <div>
          <h2>Find wedding services</h2>
          <p>Venue location: {wedding.city}. Browse providers by category.</p>
        </div>
        <Link className="dash-inline-link" to="/app/services">
          Browse all services <Icon name="arrow" />
        </Link>
      </div>
      <div className="dash-nearby-grid">
        {categories.slice(0, 4).map((category, index) => (
          <Link
            key={category.id}
            to={"/app/services?category=" + category.id}
            className="dash-nearby-card"
          >
            <img
              src={"/images/stitch/category-" + category.id + ".jpg"}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
            />
            <div>
              <span>
                <Icon name={category.icon} />
                {category.name}
              </span>
              <Icon name="arrow" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ServicesPage({
  wedding,
}: {
  wedding?: WeddingDetails;
  userId?: string;
}) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("category") || "all";
  const category = categories.some((item) => item.id === selected)
    ? selected
    : "all";
  const sort = params.get("sort") === "newest" ? "newest" : "rating";
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const search = params.get("search") || "";
  const filters = {
    category,
    sort,
    page,
    search,
    latitude: wedding?.latitude ?? undefined,
    longitude: wedding?.longitude ?? undefined,
  };
  const query = useQuery({
    queryKey: ["provider-directory", filters],
    queryFn: ({ signal }) => getProviders(filters, signal),
  });
  const savedLocation = wedding
    ? wedding.latitude !== null && wedding.longitude !== null
      ? wedding.latitude + "," + wedding.longitude
      : wedding.address + ", " + wedding.city
    : "India";
  const Page = wedding ? "section" : "main";
  return (
    <div
      className={
        "provider-directory" + (!wedding ? " provider-public-page" : "")
      }
    >
      {!wedding && (
        <header className="provider-site-header">
          <Brand />
          <Link className="ws-button" to="/app/provider">
            List your service
          </Link>
        </header>
      )}
      <Page className={!wedding ? "provider-public-main" : undefined}>
        <div className="dash-page-heading">
          <div>
            <h1>Find wedding services</h1>
            <p>
              {wedding
                ? "Find providers by service and location, then contact them directly."
                : "Browse registered wedding services, view reviews and contact providers."}
            </p>
          </div>
          {wedding && (
            <span className="dash-location">
              <Icon name="pin" />
              {wedding.city}
            </span>
          )}
        </div>
        <div className="provider-directory-note">
          <Icon name="store" />
          <p>
            Profiles are shared by providers. Availability is informational;
            confirm your date, scope and price directly before adding a service
            to your wedding plan.
          </p>
        </div>
        <form
          className="provider-search-row"
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams(params);
            next.set(
              "search",
              String(
                new FormData(event.currentTarget).get("search") || "",
              ).trim(),
            );
            next.delete("page");
            setParams(next);
          }}
        >
          <label className="provider-search">
            <Icon name="search" />
            <input
              key={search}
              name="search"
              type="search"
              maxLength={100}
              aria-label="Search wedding services"
              placeholder="Search by provider or city"
              defaultValue={search}
            />
          </label>
          <button className="ws-button" type="submit">
            Search
          </button>
          <label className="provider-sort">
            Sort by
            <select
              value={sort}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                next.set("sort", event.target.value);
                next.delete("page");
                setParams(next);
              }}
            >
              <option value="rating">Highest rated</option>
              <option value="newest">Recently listed</option>
            </select>
          </label>
        </form>
        <div
          className="dash-tabs provider-categories"
          aria-label="Service category filters"
        >
          {[{ id: "all", name: "All services" }, ...providerCategories].map(
            (item) => (
              <button
                key={item.id}
                aria-pressed={category === item.id}
                className={category === item.id ? "is-active" : ""}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("category", item.id);
                  next.delete("page");
                  setParams(next);
                }}
              >
                {item.name}
              </button>
            ),
          )}
        </div>
        {wedding && (
          <p className="provider-location-note">
            <Icon name="pin" />
            {wedding.latitude !== null && wedding.longitude !== null
              ? "Showing providers who serve your saved wedding location."
              : "Add coordinates in Wedding settings to find providers within their service area."}
          </p>
        )}
        {query.isPending ? (
          <div className="provider-state" role="status">
            <Icon name="search" />
            <h2>Finding wedding services…</h2>
            <p>Opening the provider directory.</p>
          </div>
        ) : query.isError ? (
          <div className="provider-state" role="alert">
            <h2>Couldn’t open the directory</h2>
            <p>{apiMessage(query.error)}</p>
            <button className="ws-button" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        ) : !query.data.providers.length ? (
          <div className="provider-state">
            <Icon name="store" />
            <h2>
              {search || category !== "all"
                ? "No providers match this search"
                : "No providers listed yet"}
            </h2>
            <p>
              {search || category !== "all"
                ? "Try another category or a broader search. You can also speak to a local service directly."
                : "There are no published profiles for this location yet. Service providers can create a profile without registering a wedding."}
            </p>
            <div className="provider-actions">
              {(search || category !== "all" || page > 1) && (
                <button className="ws-button" onClick={() => setParams({})}>
                  Clear filters
                </button>
              )}
              <Link className="ws-button ws-primary" to="/app/provider">
                List your service
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="provider-result-heading">
              <p>
                {query.data.total}{" "}
                {query.data.total === 1 ? "provider" : "providers"} found
              </p>
              <span>Reviews follow completed wedding services</span>
            </div>
            <div className="provider-results">
              {query.data.providers.map((provider) => (
                <article className="provider-result" key={provider.id}>
                  <Link
                    className="provider-result-image"
                    to={"/services/" + provider.id}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <img
                      src={
                        provider.portfolioUrls[0] ||
                        "/images/stitch/category-" + provider.category + ".jpg"
                      }
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    {!provider.portfolioUrls.length && (
                      <span>Category image</span>
                    )}
                  </Link>
                  <div className="provider-result-body">
                    <span className="provider-category-name">
                      {
                        providerCategories.find(
                          (item) => item.id === provider.category,
                        )?.name
                      }
                    </span>
                    <h2>
                      <Link to={"/services/" + provider.id}>
                        {provider.name}
                      </Link>
                    </h2>
                    <p className="provider-result-city">
                      <Icon name="pin" />
                      {provider.city}
                    </p>
                    <p className="provider-result-description">
                      {provider.description}
                    </p>
                    <p className="provider-rating">
                      {provider.reviewCount > 0 ? (
                        <>
                          <strong>
                            {provider.averageRating.toFixed(1)} / 5
                          </strong>
                          <span>
                            {provider.reviewCount}{" "}
                            {provider.reviewCount === 1 ? "review" : "reviews"}
                          </span>
                        </>
                      ) : (
                        <span>No reviews yet</span>
                      )}
                    </p>
                    {provider.distanceKm !== undefined && (
                      <p className="provider-distance">
                        {provider.distanceKm.toFixed(1)} km from your wedding
                        location
                      </p>
                    )}
                    <div className="provider-result-bottom">
                      <span>
                        {provider.availability ||
                          "Ask the provider about availability"}
                      </span>
                      <Link
                        className="ws-button"
                        to={"/services/" + provider.id}
                      >
                        View profile
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {query.data.total > query.data.pageSize && (
              <nav className="provider-pagination" aria-label="Provider pages">
                <button
                  className="ws-button"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", String(page - 1));
                    setParams(next);
                  }}
                >
                  Previous
                </button>
                <span>
                  Page {page} of{" "}
                  {Math.ceil(query.data.total / query.data.pageSize)}
                </span>
                <button
                  className="ws-button"
                  disabled={page * query.data.pageSize >= query.data.total}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", String(page + 1));
                    setParams(next);
                  }}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
        <section className="provider-local-options">
          <div>
            <h2>Already know someone local?</h2>
            <p>
              Outside vendors can stay account-free. Keep their details in your
              wedding plan.
            </p>
          </div>
          {wedding ? (
            <Link className="ws-button" to="/app/departments">
              Teams & Services
            </Link>
          ) : (
            <Link className="ws-button" to="/app/setup">
              Open your wedding
            </Link>
          )}
        </section>
        <div className="provider-map-links">
          <span>Explore more on Google Maps</span>
          {categories
            .filter((item) => category === "all" || item.id === category)
            .map((item) => (
              <a
                key={item.id}
                href={
                  "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(item.query + " near " + savedLocation)
                }
                target="_blank"
                rel="noreferrer"
              >
                {item.name}
              </a>
            ))}
        </div>
      </Page>
    </div>
  );
}
