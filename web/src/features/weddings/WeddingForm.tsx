import { useForm } from "react-hook-form";
import type { WeddingInput } from "../../lib/weddings";

export function WeddingForm({
  initial,
  onSave,
  saving,
  error,
  editing = false,
  onReload,
}: {
  initial?: WeddingInput;
  onSave: (values: WeddingInput) => void;
  saving: boolean;
  error?: string;
  editing?: boolean;
  onReload?: () => void;
}) {
  const { register, handleSubmit } = useForm<WeddingInput>({
    defaultValues: {
      brideName: initial?.brideName || "",
      groomName: initial?.groomName || "",
      date: initial?.date || "",
      startTime: initial?.startTime || "",
      endTime: initial?.endTime || "",
      venue: initial?.venue || "",
      address: initial?.address || "",
      city: initial?.city || "",
      latitude: initial?.latitude ?? null,
      longitude: initial?.longitude ?? null,
      contactRole: initial?.contactRole || "",
      phone: initial?.phone || "",
      welcome: initial?.welcome || "",
      youtube: initial?.youtube || "",
    },
  });
  return (
    <form className="ws-form wedding-form" onSubmit={handleSubmit(onSave)}>
      <fieldset disabled={saving}>
        <section className="ws-panel">
          <div className="ws-panel-heading">
            <h2>The two of you</h2>
            <span className="setup-section-number">01</span>
          </div>
          <div className="ws-settings-fields ws-field-grid">
            <label>
              Bride’s name
              <input
                required
                maxLength={80}
                autoComplete="off"
                {...register("brideName")}
              />
            </label>
            <label>
              Groom’s name
              <input
                required
                maxLength={80}
                autoComplete="off"
                {...register("groomName")}
              />
            </label>
          </div>
        </section>
        <section className="ws-panel">
          <div className="ws-panel-heading">
            <h2>The date & celebration</h2>
            <span className="setup-section-number">02</span>
          </div>
          <div className="ws-settings-fields ws-field-grid">
            <label>
              Wedding date
              <input type="date" required {...register("date")} />
            </label>
            <label>
              Ceremony / shubh muhurat time (IST)
              <input type="time" required {...register("startTime")} />
              <small>
                Your countdown uses this saved time. Enter the muhurat agreed by
                your family.
              </small>
            </label>
            <label>
              End time (optional)
              <input type="time" {...register("endTime")} />
              <small>May be after midnight.</small>
            </label>
          </div>
        </section>
        <section className="ws-panel">
          <div className="ws-panel-heading">
            <h2>A place to come together</h2>
            <span className="setup-section-number">03</span>
          </div>
          <div className="ws-settings-fields">
            <label>
              Venue name
              <input
                required
                minLength={2}
                maxLength={160}
                {...register("venue")}
              />
            </label>
            <label>
              Full venue address
              <textarea
                required
                minLength={5}
                maxLength={500}
                {...register("address")}
              />
            </label>
            <label>
              City & state
              <input
                required
                minLength={2}
                maxLength={100}
                {...register("city")}
              />
            </label>
            <div className="ws-field-grid">
              <label>
                Latitude (optional)
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  {...register("latitude", {
                    setValueAs: (value) =>
                      value === "" || value === null ? null : Number(value),
                  })}
                />
              </label>
              <label>
                Longitude (optional)
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  {...register("longitude", {
                    setValueAs: (value) =>
                      value === "" || value === null ? null : Number(value),
                  })}
                />
              </label>
            </div>
            <p className="ws-help">
              Add both coordinates for an exact Google Maps pin, or leave both
              empty to use the address.
            </p>
          </div>
        </section>
        <section className="ws-panel">
          <div className="ws-panel-heading">
            <h2>A warm welcome for your guests</h2>
            <span className="setup-section-number">04</span>
          </div>
          <div className="ws-settings-fields">
            <p className="ws-help">
              The contact below will be visible on your public guest website.
            </p>
            <div className="ws-field-grid">
              <label>
                Organizer contact role
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Family coordinator"
                  {...register("contactRole")}
                />
              </label>
              <label>
                Contact phone
                <input
                  required
                  type="tel"
                  maxLength={20}
                  {...register("phone")}
                />
              </label>
            </div>
            <label>
              Welcome note (optional)
              <textarea
                maxLength={1000}
                placeholder="आपके स्नेह और आशीर्वाद से ही हमारा यह शुभ अवसर पूर्ण होगा।"
                {...register("welcome")}
              />
            </label>
            <label>
              YouTube livestream link (optional)
              <input
                type="url"
                maxLength={300}
                placeholder="https://www.youtube.com/…"
                {...register("youtube")}
              />
            </label>
          </div>
        </section>
        {error && (
          <div role="alert" className="ws-form-error">
            {error}
            {onReload && (
              <button type="button" className="ws-text-link" onClick={onReload}>
                Reload latest details
              </button>
            )}
          </div>
        )}
        <div className="ws-form-actions">
          <p className="ws-help">
            {editing
              ? "Updates appear on your dashboard and guest website."
              : "You can edit these details later. All ceremony times use India Standard Time."}
          </p>
          <button className="ws-button ws-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create wedding"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
