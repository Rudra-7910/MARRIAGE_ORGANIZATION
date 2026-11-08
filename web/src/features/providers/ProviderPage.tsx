import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { Brand } from "../../components/ui/Brand";
import { Icon } from "../../components/ui/Icon";
import { apiMessage, getCurrentUser } from "../../lib/api";
import { canOrganize, getDashboard } from "../../lib/weddings";
import {
  addProviderToWedding,
  createProviderReview,
  getProvider,
  providerCategories,
  updateProviderReview,
} from "../../lib/providers";
import type { ProviderDetails, Review } from "../../lib/providers";

const reviewSchema = z.object({
  departmentId: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z
    .string()
    .trim()
    .min(10, "Tell other families about the service in at least 10 characters.")
    .max(1000),
});
type ReviewValues = z.infer<typeof reviewSchema>;

export function ProviderPage() {
  const { providerId = "" } = useParams();
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Review | null>(null);
  const session = useQuery({
    queryKey: ["auth-user"],
    queryFn: getCurrentUser,
  });
  const user = session.data;
  const query = useQuery({
    queryKey: ["provider", providerId, user?.id || "public"],
    queryFn: ({ signal }) => getProvider(providerId, signal),
    enabled: !session.isPending,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const workspace = useQuery({
    queryKey: ["wedding-dashboard", user?.id],
    queryFn: ({ signal }) => getDashboard(signal),
    enabled: Boolean(user),
  });
  const add = useMutation({
    mutationFn: () => addProviderToWedding(providerId),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["planning", user?.id] });
    },
  });
  const review = useMutation({
    mutationFn: (values: ReviewValues) =>
      editing
        ? updateProviderReview(providerId, editing.id, {
            version: editing.version,
            rating: values.rating,
            text: values.text,
          })
        : createProviderReview(providerId, values),
    onSuccess: async () => {
      setEditing(null);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["provider", providerId] }),
        cache.invalidateQueries({ queryKey: ["provider-directory"] }),
      ]);
    },
  });
  const data = query.data;
  const provider = data?.provider;
  return (
    <div className="provider-public-page">
      <header className="provider-site-header">
        <Brand />
        <div className="provider-header-links">
          <Link className="ws-text-link" to="/services">
            Find services
          </Link>
          <Link className="ws-button" to="/app/provider">
            Your service profile
          </Link>
        </div>
      </header>
      <main className="provider-profile provider-public-main">
        <Link
          className="provider-back-link"
          to={workspace.data?.wedding ? "/app/services" : "/services"}
        >
          Back to services
        </Link>
        {session.isPending || query.isPending ? (
          <div className="provider-state" role="status">
            Opening this service profile…
          </div>
        ) : query.isError || !provider || !data ? (
          <div className="provider-state" role="alert">
            <h1>Couldn’t open this profile</h1>
            <p>
              {query.error
                ? apiMessage(query.error)
                : "This service isn’t publicly available."}
            </p>
            <button className="ws-button" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="provider-profile-intro">
              <div>
                <span className="provider-category-name">
                  {
                    providerCategories.find(
                      (item) => item.id === provider.category,
                    )?.name
                  }
                </span>
                <h1>{provider.name}</h1>
                <p className="provider-result-city">
                  <Icon name="pin" />
                  {provider.city}
                </p>
              </div>
              <div className="provider-profile-rating">
                {provider.reviewCount > 0 ? (
                  <>
                    <strong>
                      {provider.averageRating.toFixed(1)}
                      <span> / 5</span>
                    </strong>
                    <p>
                      {provider.reviewCount}{" "}
                      {provider.reviewCount === 1
                        ? "service review"
                        : "service reviews"}
                    </p>
                  </>
                ) : (
                  <p>No service reviews yet</p>
                )}
              </div>
            </div>
            <div className="provider-profile-grid">
              <div className="provider-profile-content">
                <figure className="provider-profile-photo">
                  <img
                    src={
                      provider.portfolioUrls[0] ||
                      "/images/stitch/category-" + provider.category + ".jpg"
                    }
                    alt={
                      provider.portfolioUrls.length
                        ? provider.name + " portfolio"
                        : ""
                    }
                    referrerPolicy="no-referrer"
                  />
                  {!provider.portfolioUrls.length && (
                    <figcaption>
                      Category image. This provider hasn’t added portfolio
                      photos yet.
                    </figcaption>
                  )}
                </figure>
                <section className="provider-profile-section">
                  <h2>About the service</h2>
                  <p className="provider-preserve-lines">
                    {provider.description}
                  </p>
                </section>
                {provider.portfolioUrls.length > 1 && (
                  <section className="provider-profile-section">
                    <h2>Their work</h2>
                    <div className="provider-portfolio">
                      {provider.portfolioUrls.slice(1).map((url, index) => (
                        <a
                          key={url + index}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={url}
                            alt={
                              provider.name + " portfolio image " + (index + 2)
                            }
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </a>
                      ))}
                    </div>
                  </section>
                )}
                <section
                  className="provider-profile-section"
                  id="service-reviews"
                >
                  <div className="provider-section-heading">
                    <h2>Family feedback</h2>
                    <span>
                      {provider.reviewCount}{" "}
                      {provider.reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                  <p className="provider-help">
                    Organizers can review a provider after a linked wedding
                    service is marked done.
                  </p>
                  {!data.reviews.length ? (
                    <div className="provider-review-empty">
                      <p>No reviews have been shared yet.</p>
                    </div>
                  ) : (
                    <div className="provider-reviews">
                      {data.reviews.map((item) => (
                        <article className="provider-review" key={item.id}>
                          <div className="provider-review-heading">
                            <strong>{item.rating} / 5</strong>
                            <time dateTime={item.createdAt}>
                              {new Date(item.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  timeZone: "Asia/Kolkata",
                                },
                              )}
                            </time>
                            {item.canEdit && (
                              <button
                                className="ws-text-link"
                                disabled={review.isPending}
                                onClick={() => {
                                  review.reset();
                                  setEditing(item);
                                }}
                              >
                                Edit your review
                              </button>
                            )}
                          </div>
                          {editing?.id === item.id ? (
                            <ReviewEditor
                              key={item.id + ":" + item.version}
                              initial={editing}
                              departments={[]}
                              saving={review.isPending}
                              error={
                                review.isError ? apiMessage(review.error) : ""
                              }
                              onSave={(values) => review.mutate(values)}
                              onCancel={() => {
                                setEditing(null);
                                review.reset();
                              }}
                              onReload={() => {
                                setEditing(null);
                                review.reset();
                                query.refetch();
                              }}
                            />
                          ) : (
                            <p>{item.text}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                  {data.canReview.length > 0 && !editing && (
                    <ReviewEditor
                      key={data.canReview
                        .map((item) => item.departmentId)
                        .join(",")}
                      departments={data.canReview}
                      saving={review.isPending}
                      error={review.isError ? apiMessage(review.error) : ""}
                      onSave={(values) => review.mutate(values)}
                      onReload={() => {
                        review.reset();
                        query.refetch();
                      }}
                    />
                  )}
                  {review.isSuccess && (
                    <p className="provider-success" role="status">
                      Your review has been saved.
                    </p>
                  )}
                </section>
              </div>
              <aside className="provider-contact-panel">
                <h2>Talk to the provider</h2>
                <p>Confirm your date, requirements and cost directly.</p>
                <a
                  className="ws-button ws-primary"
                  href={"tel:" + provider.phone.replace(/[^+\d]/g, "")}
                >
                  <Icon name="phone" />
                  {provider.phone}
                </a>
                <dl>
                  <div>
                    <dt>Based in</dt>
                    <dd>
                      {provider.address}, {provider.city}
                    </dd>
                  </div>
                  <div>
                    <dt>Service area</dt>
                    <dd>
                      Within {provider.serviceRadiusKm} km of their location
                    </dd>
                  </div>
                  <div>
                    <dt>Availability note</dt>
                    <dd>
                      {provider.availability ||
                        "Contact the provider to check your date."}
                    </dd>
                  </div>
                </dl>
                <a
                  className="ws-text-link"
                  href={
                    "https://www.google.com/maps/search/?api=1&query=" +
                    encodeURIComponent(
                      provider.googlePlaceId
                        ? provider.name
                        : provider.latitude + "," + provider.longitude,
                    ) +
                    (provider.googlePlaceId
                      ? "&query_place_id=" +
                        encodeURIComponent(provider.googlePlaceId)
                      : "")
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View business location
                </a>
                <div className="provider-add-section">
                  {user &&
                  workspace.data?.wedding &&
                  canOrganize(workspace.data.role) ? (
                    <>
                      <h3>Keep them in your wedding plan</h3>
                      <p>
                        Adds a department with their contact details. It doesn’t
                        book the service or give the provider wedding access.
                      </p>
                      {add.isSuccess ? (
                        <div role="status">
                          <p className="provider-success">
                            Saved in Teams & Services.
                          </p>
                          <Link className="ws-button" to="/app/departments">
                            Open your wedding teams
                          </Link>
                        </div>
                      ) : (
                        <button
                          className="ws-button"
                          disabled={add.isPending}
                          onClick={() => add.mutate()}
                        >
                          {add.isPending ? "Adding…" : "Add to wedding plan"}
                        </button>
                      )}
                      {add.isError && (
                        <p className="ws-form-error" role="alert">
                          {apiMessage(add.error)}
                        </p>
                      )}
                    </>
                  ) : !user ? (
                    <>
                      <p>Sign in to keep this service in your wedding plan.</p>
                      <Link className="ws-button" to="/login">
                        Sign in
                      </Link>
                    </>
                  ) : workspace.isPending ? (
                    <p role="status">Checking your wedding access…</p>
                  ) : workspace.isError ? (
                    <Link className="ws-button" to="/app/setup">
                      Open your wedding
                    </Link>
                  ) : null}
                </div>
                {(provider.ownerId === user?.id || data.canModerate) && (
                  <Link className="ws-text-link" to="/app/provider">
                    {provider.ownerId === user?.id
                      ? "Edit your service profile"
                      : "Open platform moderation"}
                  </Link>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ReviewEditor({
  initial,
  departments,
  saving,
  error,
  onSave,
  onCancel,
  onReload,
}: {
  initial?: Review;
  departments: ProviderDetails["canReview"];
  saving: boolean;
  error: string;
  onSave: (values: ReviewValues) => void;
  onCancel?: () => void;
  onReload: () => void;
}) {
  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      departmentId: departments[0]?.departmentId || "",
      rating: initial?.rating || 5,
      text: initial?.text || "",
    },
  });
  return (
    <form
      className="provider-form provider-review-form"
      onSubmit={form.handleSubmit(onSave)}
    >
      <fieldset disabled={saving}>
        <h3>{initial ? "Edit your review" : "Share your experience"}</h3>
        {!initial && (
          <label>
            Completed service
            <select {...form.register("departmentId")} required>
              {departments.map((item) => (
                <option key={item.departmentId} value={item.departmentId}>
                  {item.departmentName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Rating
          <select {...form.register("rating", { valueAsNumber: true })}>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} out of 5
              </option>
            ))}
          </select>
        </label>
        <label>
          Your experience
          <textarea
            rows={4}
            maxLength={1000}
            aria-invalid={Boolean(form.formState.errors.text)}
            placeholder="What should another family know about working with this service?"
            {...form.register("text")}
          />
          {form.formState.errors.text && (
            <small role="alert">{form.formState.errors.text.message}</small>
          )}
        </label>
        {error && (
          <div className="ws-form-error" role="alert">
            <p>{error}</p>
            <button className="ws-text-link" type="button" onClick={onReload}>
              Reload latest reviews
            </button>
          </div>
        )}
        <div className="provider-actions">
          <button className="ws-button ws-primary" disabled={saving}>
            {saving ? "Saving…" : initial ? "Save review" : "Post review"}
          </button>
          {onCancel && (
            <button
              className="ws-button"
              type="button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
