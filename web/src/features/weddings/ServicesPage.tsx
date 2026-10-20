import { useState } from "react";
import { Link } from "react-router-dom";
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
    description: "From the family favourites to the wedding feast.",
  },
  {
    id: "photography",
    name: "Photography",
    query: "wedding photographers",
    icon: "camera",
    description: "For the little moments and the big memories.",
  },
  {
    id: "decoration",
    name: "Decoration",
    query: "wedding decorators",
    icon: "spark",
    description: "Flowers, a mandap and a setting that feels like you.",
  },
  {
    id: "lighting",
    name: "Lighting",
    query: "wedding lighting services",
    icon: "tent",
    description: "A little glow for every evening of celebration.",
  },
  {
    id: "tent",
    name: "Tent & Mandap",
    query: "wedding tent house mandap",
    icon: "tent",
    description: "Make room for your people to come together.",
  },
  {
    id: "music",
    name: "Music & Rituals",
    query: "wedding band shehnai services",
    icon: "spark",
    description: "The familiar sounds that make it a shaadi.",
  },
];

function mapsSearch(wedding: WeddingDetails, query: string) {
  const location =
    wedding.latitude !== null && wedding.longitude !== null
      ? wedding.latitude + "," + wedding.longitude
      : wedding.address + ", " + wedding.city;
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(query + " near " + location)
  );
}

export function NearbyServices({ wedding }: { wedding: WeddingDetails }) {
  return (
    <section className="dash-nearby-section">
      <div className="dash-section-heading">
        <div>
          <span className="dash-kicker">A LITTLE LOCAL KNOW-HOW</span>
          <h2>Good people, close to your celebration.</h2>
          <p>Explore wedding services near {wedding.city}.</p>
        </div>
        <Link className="dash-inline-link" to="/app/services">
          Browse all services <Icon name="arrow" />
        </Link>
      </div>
      <div className="dash-nearby-grid">
        {categories.slice(0, 4).map((category) => (
          <Link
            key={category.id}
            to={"/app/services?category=" + category.id}
            className="dash-nearby-card"
          >
            <img
              src={"/images/stitch/category-" + category.id + ".jpg"}
              alt=""
              loading="lazy"
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

export function ServicesPage({ wedding }: { wedding: WeddingDetails }) {
  const initial = new URLSearchParams(window.location.search).get("category");
  const [categoryId, setCategoryId] = useState(initial || "all");
  const [search, setSearch] = useState("");
  const visible = categories.filter(
    (category) =>
      (categoryId === "all" || category.id === categoryId) &&
      (category.name + " " + category.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="dash-page-heading">
        <div>
          <span className="dash-kicker">
            LOCAL PEOPLE. BEAUTIFUL CELEBRATIONS.
          </span>
          <h1>Find wedding services</h1>
          <p>Caterers, photographers and more, around your wedding venue.</p>
        </div>
        <span className="dash-location">
          <Icon name="pin" />
          {wedding.city}
        </span>
      </div>
      <div className="dash-directory-note">
        <Icon name="store" />
        <div>
          <strong>Discover nearby. Speak to them directly.</strong>
          <p>
            The in-app directory is coming soon. For now, each category opens a
            Google Maps search using your saved wedding location. Images
            illustrate service categories.
          </p>
        </div>
        <span className="dash-badge">
          <Icon name="lock" />
          No bookings or payments
        </span>
      </div>
      <div className="dash-service-toolbar">
        <label className="dash-search">
          <Icon name="search" />
          <input
            aria-label="Search service categories"
            placeholder="What are you looking for?"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span>
          <Icon name="pin" />
          Around {wedding.venue}
        </span>
      </div>
      <div className="dash-tabs" aria-label="Service category filters">
        {[{ id: "all", name: "All services" }, ...categories].map(
          (category) => (
            <button
              key={category.id}
              aria-pressed={categoryId === category.id}
              className={categoryId === category.id ? "is-active" : ""}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ),
        )}
      </div>
      <div className="dash-service-grid">
        {visible.map((category) => (
          <article className="dash-service-card" key={category.id}>
            <div className="dash-service-image">
              <img
                src={"/images/stitch/category-" + category.id + ".jpg"}
                alt=""
                loading="lazy"
              />
              <span className="dash-badge">
                <Icon name={category.icon} />
                {category.name}
              </span>
            </div>
            <div className="dash-service-content">
              <h2>
                {category.name} near {wedding.city}
              </h2>
              <p>{category.description}</p>
              <span className="dash-service-location">
                <Icon name="pin" />
                Near your saved wedding location
              </span>
              <a
                className="ws-button ws-primary"
                href={mapsSearch(wedding, category.query)}
                target="_blank"
                rel="noreferrer"
              >
                Explore on Google Maps ↗
              </a>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="dash-card dash-empty-section">
          <Icon name="search" />
          <h2>No matching service categories</h2>
          <p>Try another search or choose All services.</p>
          <button
            className="ws-button"
            onClick={() => {
              setSearch("");
              setCategoryId("all");
            }}
          >
            Show all services
          </button>
        </div>
      )}
      <div className="dash-bottom-note">
        <Icon name="phone" />
        <p>
          Already know a local halwai, photographer or decorator? Keep their
          number handy. Adding contacts to Teams & Services is the next step.
        </p>
        <Link to="/app/departments" className="dash-inline-link">
          Teams & Services <Icon name="arrow" />
        </Link>
      </div>
    </>
  );
}
