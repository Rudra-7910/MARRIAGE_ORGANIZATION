import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brand } from "../../components/ui/Brand";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import {
  authorizeUpload,
  completeUpload,
  getUploadInfo,
  putPhoto,
  renewUpload,
} from "../../lib/media";
import type { AuthorizedUpload } from "../../lib/media";

type UploadItem = {
  id: string;
  file: File;
  state: "ready" | "uploading" | "checking" | "pending" | "failed";
  percent: number;
  error: string;
  authorized?: AuthorizedUpload;
  uploaded: boolean;
};

export function UploadPage() {
  const { publicId = "" } = useParams();
  const token = useLocation().hash.slice(1);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["upload-info", publicId, token],
    queryFn: ({ signal }) => getUploadInfo(publicId, token, signal),
    enabled: Boolean(publicId && token),
    retry: false,
    staleTime: 15000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => () => request.current?.abort(), []);
  const info = query.data;
  const ready = items.filter((item) => item.state === "ready");
  const completed = items.filter((item) => item.state === "pending").length;
  const canUpload = Boolean(info?.configured && info.remaining > 0);

  function selectPhotos(files: FileList | null) {
    setSelectionError("");
    if (!files?.length || busy || !info) return;
    const selected = Array.from(files);
    if (selected.length > 3) {
      setSelectionError("Choose up to 3 photos at a time.");
      return;
    }
    if (selected.length > info.remaining) {
      setSelectionError(
        "This link has " +
          info.remaining +
          " photo slots left. Please choose fewer photos.",
      );
      return;
    }
    if (
      selected.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setSelectionError(
        "Choose JPEG, PNG or WebP photos. Other file formats aren’t supported.",
      );
      return;
    }
    if (selected.some((file) => file.size <= 0 || file.size > info.maxBytes)) {
      setSelectionError(
        "Each photo must be larger than 0 bytes and no bigger than " +
          Math.floor(info.maxBytes / 1048576) +
          " MB.",
      );
      return;
    }
    setItems(
      selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        state: "ready",
        percent: 0,
        error: "",
        uploaded: false,
      })),
    );
  }
  // One photo at a time keeps both results and retries clear, even on a slow connection.
  async function sendPhotos(selected: UploadItem[]) {
    if (
      request.current ||
      busy ||
      !info?.configured ||
      (!canUpload && selected.some((item) => !item.authorized))
    )
      return;
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    for (const item of selected) {
      if (controller.signal.aborted) break;
      let authorized = item.authorized;
      let uploaded = item.uploaded;
      function update(changes: Partial<UploadItem>) {
        setItems((current) =>
          current.map((value) =>
            value.id === item.id ? { ...value, ...changes } : value,
          ),
        );
      }
      try {
        update({
          state: uploaded ? "checking" : "uploading",
          error: "",
          percent: uploaded ? 100 : 0,
        });
        if (!authorized) {
          authorized = await authorizeUpload(
            publicId,
            token,
            item.file,
            controller.signal,
          );
          update({ authorized });
        } else if (!uploaded) {
          authorized = await renewUpload(
            publicId,
            token,
            authorized.id,
            controller.signal,
          );
          update({ authorized });
        }
        if (!uploaded) {
          await putPhoto(
            authorized,
            item.file,
            (percent) => update({ percent }),
            controller.signal,
          );
          uploaded = true;
          update({ uploaded: true, state: "checking", percent: 100 });
        }
        const result = await completeUpload(
          publicId,
          token,
          authorized.id,
          controller.signal,
        );
        if (result.state !== "pending")
          throw new Error("We couldn’t confirm this photo. Please try again.");
        update({ state: "pending", error: "" });
      } catch (error) {
        if (controller.signal.aborted) break;
        // A retry renews this authorization without reserving another photo slot.
        // A completed PUT is retained, so retrying confirmation never uploads it twice.
        update({
          state: "failed",
          error: apiMessage(error),
          uploaded,
          authorized,
        });
      }
    }
    if (!controller.signal.aborted) {
      setBusy(false);
      request.current = null;
      await query.refetch();
      void cache.invalidateQueries({ queryKey: ["photos"] });
    }
  }
  return (
    <div className="media-upload-page">
      <header className="media-upload-header">
        <Brand />
        <span>
          <Icon name="camera" />
          Wedding photo upload
        </span>
      </header>
      <main className="media-upload-main">
        {!token || !publicId ? (
          <section className="media-upload-status">
            <Icon name="link" />
            <h1>Open your photo upload link</h1>
            <p>
              Please use the full link or QR code shared by the wedding
              organizers. You don’t need an account.
            </p>
          </section>
        ) : query.isPending ? (
          <section className="media-upload-status" role="status">
            <Icon name="camera" />
            <h1>Loading photo upload…</h1>
          </section>
        ) : !info ? (
          <section className="media-upload-status">
            <Icon name="link" />
            <h1>This upload link is unavailable</h1>
            <p role="alert">{apiMessage(query.error)}</p>
            <p>Please ask the wedding organizers for a current link.</p>
            <button
              type="button"
              className="ws-button"
              onClick={() => void query.refetch()}
            >
              Try again
            </button>
          </section>
        ) : (
          <>
            <div className="media-upload-title">
              <h1>
                {info.brideName} & {info.groomName}
              </h1>
              <p>
                Upload your wedding photos. Organizers review each photo before
                it appears in the gallery.
              </p>
              <Link className="ws-text-link" to={"/w/" + publicId}>
                View wedding website <Icon name="arrow" />
              </Link>
            </div>
            {!info.configured && (
              <div className="media-notice" role="status">
                <p>
                  Photo uploads aren’t available right now. Please try again
                  later or contact the wedding organizers.
                </p>
              </div>
            )}
            {info.remaining === 0 && (
              <div className="media-notice" role="status">
                <p>
                  This upload link has no photo slots left. You can ask the
                  organizers for a new link.
                </p>
              </div>
            )}
            {query.isError && (
              <div className="media-notice is-error" role="alert">
                <p>
                  {apiMessage(query.error)} We couldn’t refresh this link’s
                  availability.
                </p>
                <button
                  type="button"
                  className="ws-button"
                  onClick={() => void query.refetch()}
                >
                  Check link
                </button>
              </div>
            )}
            <section
              className="media-upload-select"
              aria-labelledby="upload-photos-heading"
            >
              <Icon name="camera" />
              <h2 id="upload-photos-heading">Upload photos</h2>
              <p>
                Choose up to 3 photos at a time. JPEG, PNG or WebP, up to{" "}
                {Math.floor(info.maxBytes / 1048576)} MB each.
              </p>
              <label
                className={
                  "media-file-control" +
                  (!canUpload || busy ? " is-disabled" : "")
                }
              >
                <span>Choose photos</span>
                <input
                  ref={input}
                  type="file"
                  name="weddingPhotos"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={!canUpload || busy}
                  onChange={(event) => {
                    selectPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              <p className="media-muted">
                No sign-up. No names to fill in. Your photos stay private until
                approved.
              </p>
            </section>
            {selectionError && (
              <p className="media-error" role="alert">
                {selectionError}
              </p>
            )}
            {items.length > 0 && (
              <section
                className="media-upload-files"
                aria-labelledby="selected-photos-heading"
              >
                <h2 id="selected-photos-heading">Selected photos</h2>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <div className="media-upload-file-icon">
                        <Icon
                          name={
                            item.state === "pending" ? "circle-check" : "camera"
                          }
                        />
                      </div>
                      <div className="media-upload-file-info">
                        <strong>{item.file.name}</strong>
                        <span>{(item.file.size / 1048576).toFixed(1)} MB</span>
                        <p role="status">
                          {item.state === "ready"
                            ? "Ready to upload"
                            : item.state === "uploading"
                              ? "Uploading, " + item.percent + "%"
                              : item.state === "checking"
                                ? "Checking your photo…"
                                : item.state === "pending"
                                  ? "Sent for organizer review"
                                  : "Photo not confirmed"}
                        </p>
                        {item.state === "uploading" && (
                          <progress
                            max="100"
                            value={item.percent}
                            aria-label={"Upload progress for " + item.file.name}
                          />
                        )}
                        {item.state === "failed" && (
                          <p className="media-error" role="alert">
                            {item.error}
                          </p>
                        )}
                      </div>
                      {item.state === "failed" && (
                        <button
                          type="button"
                          className="ws-button"
                          disabled={
                            busy ||
                            !info.configured ||
                            (!canUpload && !item.authorized)
                          }
                          onClick={() => void sendPhotos([item])}
                        >
                          Retry photo
                        </button>
                      )}
                      {item.state === "ready" && (
                        <button
                          type="button"
                          className="ws-button"
                          disabled={busy}
                          onClick={() =>
                            setItems((current) =>
                              current.filter((value) => value.id !== item.id),
                            )
                          }
                          aria-label={"Remove " + item.file.name}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {ready.length > 0 && (
                  <button
                    type="button"
                    className="ws-button ws-primary"
                    disabled={busy || !canUpload}
                    aria-busy={busy}
                    onClick={() => void sendPhotos(ready)}
                  >
                    {busy
                      ? "Sending photos…"
                      : "Send " +
                        ready.length +
                        (ready.length === 1 ? " photo" : " photos") +
                        " for review"}
                  </button>
                )}
                {completed > 0 && (
                  <p className="media-success" role="status">
                    <Icon name="circle-check" />
                    {completed} {completed === 1 ? "photo is" : "photos are"}{" "}
                    with the organizers for review. Thank you for sharing.
                  </p>
                )}
              </section>
            )}
            <p className="media-upload-expiry">
              {info.remaining} photo slots remaining. Link valid until{" "}
              {new Date(info.expiresAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST.
            </p>
          </>
        )}
      </main>
      <footer className="media-upload-footer">
        Make My Marriage
      </footer>
    </div>
  );
}
