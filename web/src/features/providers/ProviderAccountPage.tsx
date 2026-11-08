import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Brand } from "../../components/ui/Brand";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import type { AuthUser } from "../../lib/api";
import {
  getMyProvider,
  getProviderModeration,
  moderateProviderContent,
  providerCategories,
  saveProvider,
} from "../../lib/providers";
import type { Provider } from "../../lib/providers";
import { PlacePicker } from "../integrations/PlacePicker";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your service name.").max(120),
  category: z.enum([
    "catering",
    "photography",
    "decoration",
    "lighting",
    "tent",
    "music",
  ]),
  description: z
    .string()
    .trim()
    .min(20, "Describe your service in at least 20 characters.")
    .max(2000),
  phone: z.string().trim().min(7, "Enter a contact number.").max(20),
  address: z
    .string()
    .trim()
    .min(5, "Enter the full business address.")
    .max(500),
  city: z.string().trim().min(2, "Enter your city and state.").max(100),
  latitude: z.number({ error: "Enter a latitude." }).min(-90).max(90),
  longitude: z.number({ error: "Enter a longitude." }).min(-180).max(180),
  googlePlaceId: z.string().max(300),
  serviceRadiusKm: z
    .number({ error: "Enter a service radius." })
    .int()
    .min(1)
    .max(1000),
  availability: z.string().trim().max(1000),
  portfolioText: z
    .string()
    .max(12000)
    .refine((value) => {
      const urls = value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return (
        urls.length <= 12 &&
        urls.every(
          (url) =>
            z
              .url({ protocol: /^https$/ })
              .max(1000)
              .safeParse(url).success,
        )
      );
    }, "Add up to 12 valid HTTPS image URLs, one per line."),
  published: z.boolean(),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ProviderAccountPage({ user }: { user: AuthUser }) {
  const query = useQuery({
    queryKey: ["my-provider", user.id],
    queryFn: ({ signal }) => getMyProvider(signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  return (
    <div className="provider-public-page">
      <header className="provider-site-header">
        <Brand />
        <div className="provider-header-links">
          <Link className="ws-text-link" to="/services">
            Browse services
          </Link>
          <Link className="ws-button" to="/app/setup">
            Your wedding
          </Link>
        </div>
      </header>
      <main className="provider-account provider-public-main">
        <div className="dash-page-heading">
          <div>
            <h1>Your service profile</h1>
            <p>Introduce your work. Let families contact you directly.</p>
          </div>
          <span className="provider-account-user">{user.name}</span>
        </div>
        {query.isPending ? (
          <div className="provider-state" role="status">
            Opening your service profile…
          </div>
        ) : query.isError ? (
          <div className="provider-state" role="alert">
            <h2>Couldn’t open your profile</h2>
            <p>{apiMessage(query.error)}</p>
            <button className="ws-button" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <ProviderProfileForm
              key={query.data.profile?.version ?? "new"}
              initial={query.data.profile}
              userId={user.id}
              onReload={() => query.refetch()}
            />
            {query.data.canModerate && <ModerationSection userId={user.id} />}
          </>
        )}
      </main>
    </div>
  );
}

function ProviderProfileForm({
  initial,
  userId,
  onReload,
}: {
  initial: Provider | null;
  userId: string;
  onReload: () => void;
}) {
  const cache = useQueryClient();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initial?.name || "",
      category: initial?.category || "catering",
      description: initial?.description || "",
      phone: initial?.phone || "",
      address: initial?.address || "",
      city: initial?.city || "",
      latitude: initial?.latitude,
      longitude: initial?.longitude,
      googlePlaceId: initial?.googlePlaceId || "",
      serviceRadiusKm: initial?.serviceRadiusKm || 50,
      availability: initial?.availability || "",
      portfolioText: initial?.portfolioUrls.join("\n") || "",
      published: initial?.published ?? false,
    },
  });
  const save = useMutation({
    mutationFn: (values: ProfileValues) => {
      const { portfolioText, ...profile } = values;
      return saveProvider({
        ...profile,
        portfolioUrls: portfolioText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        version: initial?.version || 0,
      });
    },
    onSuccess: async (next) => {
      cache.setQueryData<{ profile: Provider | null; canModerate: boolean }>(
        ["my-provider", userId],
        (current) =>
          current ? { ...current, profile: next.profile } : undefined,
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["provider-directory"] }),
        cache.invalidateQueries({ queryKey: ["provider", next.profile.id] }),
      ]);
    },
  });
  const errors = form.formState.errors;
  return (
    <div className="provider-account-grid">
      <form
        className="provider-form"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        <fieldset disabled={save.isPending}>
          <section className="provider-form-section">
            <h2>Your business</h2>
            <p>
              One account, one service profile. No wedding registration
              required.
            </p>
            <div className="provider-field-grid">
              <label>
                Service / business name
                <input
                  autoComplete="organization"
                  maxLength={120}
                  aria-invalid={Boolean(errors.name)}
                  {...form.register("name")}
                />
                {errors.name && (
                  <small role="alert">{errors.name.message}</small>
                )}
              </label>
              <label>
                Service category
                <select {...form.register("category")}>
                  {providerCategories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              About your service
              <textarea
                rows={5}
                maxLength={2000}
                placeholder="Tell families what you offer, your experience and how you work."
                aria-invalid={Boolean(errors.description)}
                {...form.register("description")}
              />
              {errors.description && (
                <small role="alert">{errors.description.message}</small>
              )}
            </label>
            <label>
              Contact number
              <input
                type="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder="+91 98765 43210"
                aria-invalid={Boolean(errors.phone)}
                {...form.register("phone")}
              />
              {errors.phone && (
                <small role="alert">{errors.phone.message}</small>
              )}
            </label>
          </section>
          <section className="provider-form-section">
            <h2>Where you work</h2>
            <p>
              Your own coordinates and travel radius help nearby families find
              you.
            </p>
            <PlacePicker
              disabled={save.isPending}
              placeId={form.watch("googlePlaceId")}
              onSelect={(place) => {
                form.setValue("googlePlaceId", place.id, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              onClear={() =>
                form.setValue("googlePlaceId", "", { shouldDirty: true })
              }
            />
            <label>
              Business address
              <textarea
                rows={3}
                maxLength={500}
                autoComplete="street-address"
                aria-invalid={Boolean(errors.address)}
                {...form.register("address")}
              />
              {errors.address && (
                <small role="alert">{errors.address.message}</small>
              )}
            </label>
            <label>
              City & state
              <input
                maxLength={100}
                autoComplete="address-level2"
                placeholder="Jaipur, Rajasthan"
                aria-invalid={Boolean(errors.city)}
                {...form.register("city")}
              />
              {errors.city && <small role="alert">{errors.city.message}</small>}
            </label>
            <div className="provider-field-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  placeholder="e.g. 26.9124"
                  aria-invalid={Boolean(errors.latitude)}
                  {...form.register("latitude", { valueAsNumber: true })}
                />
                {errors.latitude && (
                  <small role="alert">{errors.latitude.message}</small>
                )}
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  placeholder="e.g. 75.7873"
                  aria-invalid={Boolean(errors.longitude)}
                  {...form.register("longitude", { valueAsNumber: true })}
                />
                {errors.longitude && (
                  <small role="alert">{errors.longitude.message}</small>
                )}
              </label>
            </div>
            <label>
              Service radius (km)
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                aria-invalid={Boolean(errors.serviceRadiusKm)}
                {...form.register("serviceRadiusKm", { valueAsNumber: true })}
              />
              {errors.serviceRadiusKm && (
                <small role="alert">{errors.serviceRadiusKm.message}</small>
              )}
            </label>
          </section>
          <section className="provider-form-section">
            <h2>Availability & work</h2>
            <label>
              Availability note (optional)
              <textarea
                rows={3}
                maxLength={1000}
                placeholder="e.g. Taking enquiries for December. Please call to confirm your date."
                {...form.register("availability")}
              />
              <small className="provider-help">
                This note informs families. It doesn’t reserve dates or accept
                bookings.
              </small>
            </label>
            <label>
              Portfolio image URLs (optional)
              <textarea
                rows={5}
                maxLength={12000}
                placeholder="One HTTPS image URL per line"
                aria-invalid={Boolean(errors.portfolioText)}
                {...form.register("portfolioText")}
              />
              <small className="provider-help">
                Up to 12 images you have permission to share. Use direct HTTPS
                image links.
              </small>
              {errors.portfolioText && (
                <small role="alert">{errors.portfolioText.message}</small>
              )}
            </label>
          </section>
          <section className="provider-form-section">
            <h2>Directory visibility</h2>
            <label className="provider-checkbox">
              <input type="checkbox" {...form.register("published")} />
              <span>
                Publish my profile in the directory
                <small>
                  Your business contact and portfolio will be publicly visible.
                </small>
              </span>
            </label>
            {initial?.hidden && (
              <p className="provider-notice" role="status">
                Your profile is hidden by a platform moderator.{" "}
                {initial.moderationReason ||
                  "Contact platform support before republishing."}
              </p>
            )}
            {save.isError && (
              <div className="ws-form-error" role="alert">
                <p>{apiMessage(save.error)}</p>
                <button
                  className="ws-text-link"
                  type="button"
                  onClick={onReload}
                >
                  Discard & reload
                </button>
              </div>
            )}
            <div className="provider-actions">
              <button
                className="ws-button ws-primary"
                disabled={save.isPending}
              >
                {save.isPending
                  ? "Saving…"
                  : initial
                    ? "Save profile"
                    : "Create service profile"}
              </button>
              {initial?.published && !initial.hidden && (
                <Link className="ws-button" to={"/services/" + initial.id}>
                  View public profile
                </Link>
              )}
            </div>
          </section>
        </fieldset>
      </form>
      <aside className="provider-account-aside">
        <Icon name="store" />
        <h2>Before publishing your profile</h2>
        <p>
          Describe what you do, where you work and how a family can reach you.
        </p>
        <ul>
          <li>Keep your contact details up to date.</li>
          <li>Share your own work in your portfolio.</li>
          <li>Confirm availability and prices directly.</li>
        </ul>
        {initial && (
          <p className="provider-publication-status">
            {initial.hidden
              ? "Hidden by moderator"
              : initial.published
                ? "Published in the directory"
                : "Draft profile"}
          </p>
        )}
      </aside>
    </div>
  );
}

function ModerationSection({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["provider-moderation", userId],
    queryFn: ({ signal }) => getProviderModeration(signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: (values: {
      kind: "providers" | "reviews";
      id: string;
      hidden: boolean;
      reason: string;
    }) =>
      moderateProviderContent(values.kind, values.id, {
        hidden: values.hidden,
        reason: values.reason,
      }),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["provider-moderation", userId] }),
        cache.invalidateQueries({ queryKey: ["provider-directory"] }),
        cache.invalidateQueries({ queryKey: ["provider"] }),
        cache.invalidateQueries({ queryKey: ["my-provider"] }),
      ]);
    },
  });
  return (
    <section className="provider-moderation">
      <div className="dash-page-heading">
        <div>
          <h2>Platform moderation</h2>
          <p>
            Visibility controls for explicitly authorized platform moderators.
          </p>
        </div>
      </div>
      {query.isPending ? (
        <p role="status">Opening moderation…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{apiMessage(query.error)}</p>
          <button className="ws-button" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {!query.data.providers.length && !query.data.reviews.length && (
            <p>No provider profiles or reviews to moderate.</p>
          )}
          {(["providers", "reviews"] as const).map((kind) => (
            <section className="provider-moderation-group" key={kind}>
              <h3>
                {kind === "providers" ? "Provider profiles" : "Service reviews"}
              </h3>
              {query.data[kind].map((item) => (
                <form
                  key={item.id + String(item.hidden) + item.moderationReason}
                  className="provider-moderation-item"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const values = new FormData(event.currentTarget);
                    mutation.mutate({
                      kind,
                      id: item.id,
                      hidden: values.get("hidden") === "on",
                      reason: String(values.get("reason") || ""),
                    });
                  }}
                >
                  <div>
                    <strong>
                      {"name" in item ? item.name : item.rating + " / 5"}
                    </strong>
                    <p>
                      {"description" in item ? item.description : item.text}
                    </p>
                  </div>
                  <label className="provider-checkbox">
                    <input
                      type="checkbox"
                      name="hidden"
                      defaultChecked={item.hidden}
                      disabled={mutation.isPending}
                    />
                    <span>Hidden from public view</span>
                  </label>
                  <label>
                    Reason
                    <input
                      name="reason"
                      maxLength={500}
                      defaultValue={item.moderationReason || ""}
                      disabled={mutation.isPending}
                    />
                  </label>
                  <button className="ws-button" disabled={mutation.isPending}>
                    Save visibility
                  </button>
                </form>
              ))}
            </section>
          ))}
        </>
      )}
      {mutation.isError && (
        <p role="alert" className="ws-form-error">
          {apiMessage(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="provider-success">
          Visibility updated.
        </p>
      )}
    </section>
  );
}
