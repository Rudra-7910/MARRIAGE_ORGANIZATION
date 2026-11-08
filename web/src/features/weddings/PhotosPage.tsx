import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import { canOrganize } from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";
import {
  createUploadLink,
  getUploadLink,
  getPhotos,
  moderatePhoto,
  revokeUploadLink,
} from "../../lib/media";
import type { Photo, PhotoState, UploadGrant } from "../../lib/media";
import { PlanningDialog } from "./PlanningDialog";

export function PhotosPage({
  userId,
  data,
}: {
  userId: string;
  data: Workspace;
}) {
  const organizer = canOrganize(data.role);
  const [state, setState] = useState<PhotoState>(
    organizer ? "pending" : "approved",
  );
  const [page, setPage] = useState(1);
  const [linkEditor, setLinkEditor] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<UploadGrant | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState("");
  const cache = useQueryClient();
  // A role change must not leave a private moderation view visible from old client state.
  const visibleState = organizer ? state : "approved";
  const query = useQuery({
    queryKey: ["photos", userId, visibleState, page],
    queryFn: ({ signal }) => getPhotos(visibleState, page, signal),
    staleTime: 15000,
    refetchInterval:
      selectedPhoto || linkEditor || selectedGrant ? false : 30000,
    refetchIntervalInBackground: false,
  });
  const canModerate = organizer && Boolean(query.data?.canModerate);
  const grantDetails = useQuery({
    queryKey: ["upload-link", userId, selectedGrant?.id],
    queryFn: ({ signal }) => getUploadLink(selectedGrant!.id, signal),
    enabled: canModerate && Boolean(selectedGrant),
    staleTime: 60000,
  });
  const qrDataUrl = selectedGrant?.qrDataUrl || grantDetails.data?.qrDataUrl;

  const linkForm = useForm({ defaultValues: { days: 7, limit: 100 } });
  async function refreshPhotos() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["photos", userId] }),
      cache.invalidateQueries({
        queryKey: ["public-photos", data.wedding!.publicId],
      }),
    ]);
  }
  const moderation = useMutation({
    mutationFn: ({
      photo,
      action,
    }: {
      photo: Photo;
      action: "approve" | "reject" | "unpublish";
    }) => moderatePhoto(photo.id, action, photo.version),
    onSuccess: async () => {
      setSelectedPhoto(null);
      await refreshPhotos();
    },
    onError: () => {
      void refreshPhotos();
    },
  });
  const createLink = useMutation({
    mutationFn: createUploadLink,
    onSuccess: async (grant) => {
      setLinkEditor(false);
      setSelectedGrant(grant);
      setCopyStatus("");
      await refreshPhotos();
    },
  });
  const revokeLink = useMutation({
    mutationFn: revokeUploadLink,
    onSuccess: refreshPhotos,
  });
  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("Upload link copied.");
    } catch {
      setCopyStatus("Select and copy the upload link below.");
    }
  }
  return (
    <div className="media-page">
      <div className="dash-page-heading">
        <div>
          <h1>Photos & gallery</h1>
          <p>
            {canModerate
              ? "Review guest uploads and publish approved photos to the gallery."
              : "View photos approved by the wedding organizers."}
          </p>
        </div>
        {canModerate && (
          <button
            type="button"
            className="ws-button ws-primary"
            disabled={!query.data?.configured}
            onClick={() => {
              createLink.reset();
              linkForm.reset();
              setLinkEditor(true);
            }}
          >
            <Icon name="plus" />
            Create upload link
          </button>
        )}
      </div>
      {query.data && !query.data.configured && (
        <div className="media-notice" role="status">
          <Icon name="camera" />
          <p>
            Photo uploads aren’t available right now. Existing approved photos
            remain in the gallery.
          </p>
        </div>
      )}
      <div className="media-toolbar">
        <div className="dash-tabs" aria-label="Photo moderation views">
          {(organizer
            ? (["pending", "approved", "rejected"] as const)
            : (["approved"] as const)
          ).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={visibleState === value}
              className={visibleState === value ? "is-active" : ""}
              onClick={() => {
                setState(value);
                setPage(1);
                moderation.reset();
              }}
            >
              {value === "pending"
                ? "Awaiting review"
                : value === "approved"
                  ? "Approved gallery"
                  : "Rejected"}
            </button>
          ))}
        </div>
        <Link
          className="ws-text-link"
          to={"/w/" + data.wedding!.publicId + "#guest-gallery"}
        >
          View guest gallery <Icon name="arrow" />
        </Link>
      </div>
      {(query.isError || moderation.isError) && (
        <div className="media-notice is-error" role="alert">
          <p>{apiMessage(moderation.error || query.error)}</p>
          <button
            type="button"
            className="ws-button"
            onClick={() => {
              moderation.reset();
              void query.refetch();
            }}
          >
            Refresh photos
          </button>
        </div>
      )}
      {query.isPending ? (
        <div className="media-empty" role="status">
          <Icon name="camera" />
          <p>Opening your wedding photos…</p>
        </div>
      ) : query.data && query.data.photos.length === 0 ? (
        <div className="media-empty">
          <Icon name="camera" />
          <h2>
            {visibleState === "pending"
              ? "No photos waiting for review"
              : visibleState === "approved"
                ? "No approved photos yet"
                : "No rejected photos"}
          </h2>
          <p>
            {visibleState === "pending"
              ? "Guest uploads will appear here before anyone can view them publicly."
              : visibleState === "approved"
                ? "Only photos approved by an organizer appear on the guest website."
                : "Photos you reject stay out of the public gallery."}
          </p>
        </div>
      ) : null}
      {query.data && query.data.photos.length > 0 && (
        <div className="media-photo-grid">
          {query.data.photos.map((photo, index) => (
            <article className="media-photo" key={photo.id}>
              {photo.url && !failedImages.includes(photo.id + photo.url) ? (
                <button
                  type="button"
                  className="media-photo-preview"
                  aria-label={"View photo " + photo.name}
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img
                    src={photo.url}
                    width={photo.width || 1200}
                    height={photo.height || 900}
                    alt={photo.name}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    onError={() =>
                      setFailedImages((current) => [
                        ...current,
                        photo.id + photo.url,
                      ])
                    }
                  />
                </button>
              ) : (
                <div className="media-photo-unavailable">
                  <Icon name="camera" />
                  <p>
                    {photo.state === "uploading"
                      ? "Upload in progress"
                      : photo.state === "verifying"
                        ? "Checking photo"
                        : "Preview unavailable"}
                  </p>
                  {photo.url && (
                    <button
                      type="button"
                      className="ws-text-link"
                      onClick={() => {
                        setFailedImages((current) =>
                          current.filter((key) => key !== photo.id + photo.url),
                        );
                        void query.refetch();
                      }}
                    >
                      Reload preview
                    </button>
                  )}
                </div>
              )}
              <div className="media-photo-caption">
                <strong title={photo.name}>{photo.name}</strong>
                <span>
                  {photo.state === "pending"
                    ? "Awaiting approval"
                    : photo.state === "approved"
                      ? "Visible to guests"
                      : photo.state === "rejected"
                        ? "Hidden from guests"
                        : "Not public"}
                </span>
              </div>
              {canModerate && photo.state === "pending" && (
                <div className="media-photo-actions">
                  <button
                    type="button"
                    className="ws-button ws-primary"
                    disabled={moderation.isPending}
                    onClick={() =>
                      moderation.mutate({ photo, action: "approve" })
                    }
                  >
                    <Icon name="check" />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="ws-button"
                    disabled={moderation.isPending}
                    onClick={() =>
                      moderation.mutate({ photo, action: "reject" })
                    }
                  >
                    Reject
                  </button>
                </div>
              )}
              {canModerate && photo.state === "approved" && (
                <div className="media-photo-actions">
                  <button
                    type="button"
                    className="ws-button"
                    disabled={moderation.isPending}
                    onClick={() =>
                      moderation.mutate({ photo, action: "unpublish" })
                    }
                  >
                    Unpublish photo
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {query.data && query.data.total > query.data.pageSize && (
        <nav className="media-pagination" aria-label="Photo pages">
          <button
            type="button"
            className="ws-button"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(query.data.total / query.data.pageSize)}
          </span>
          <button
            type="button"
            className="ws-button"
            disabled={
              page * query.data.pageSize >= query.data.total || query.isFetching
            }
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {canModerate && (
        <section className="media-sharing">
          <div className="media-section-heading">
            <div>
              <h2>Guest upload links</h2>
              <p>
                Share a QR code or link. Guests can contribute without creating
                an account.
              </p>
            </div>
          </div>
          {revokeLink.isError && (
            <p className="ws-error" role="alert">
              {apiMessage(revokeLink.error)}
            </p>
          )}
          {!query.data?.grants.length ? (
            <p className="media-muted">
              Create an upload link when you’re ready to collect photos.
            </p>
          ) : (
            <div className="media-grant-list">
              {query.data.grants.map((grant) => {
                const expired =
                  new Date(grant.expiresAt).getTime() <= Date.now();
                return (
                  <article className="media-grant" key={grant.id}>
                    <div>
                      <h3>
                        {grant.revoked
                          ? "Revoked upload link"
                          : expired
                            ? "Expired upload link"
                            : "Guest photo upload"}
                      </h3>
                      <p>
                        {grant.used} of {grant.limit} photo slots used. Expires{" "}
                        {new Date(grant.expiresAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        IST.
                      </p>
                    </div>
                    <div className="media-grant-actions">
                      {!grant.revoked && !expired && (
                        <button
                          type="button"
                          className="ws-button"
                          onClick={() => {
                            setCopyStatus("");
                            setSelectedGrant(grant);
                          }}
                        >
                          <Icon name="link" />
                          Share link & QR
                        </button>
                      )}
                      {!grant.revoked && (
                        <button
                          type="button"
                          className="ws-button"
                          disabled={revokeLink.isPending}
                          onClick={() => revokeLink.mutate(grant.id)}
                        >
                          Revoke link
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {linkEditor && canModerate && (
        <PlanningDialog
          title="Create guest upload link"
          onClose={() => {
            if (!createLink.isPending) setLinkEditor(false);
          }}
        >
          <form
            className="media-form"
            onSubmit={linkForm.handleSubmit((values) =>
              createLink.mutate(values),
            )}
          >
            <p>
              Guests with this link can upload photos. Every photo needs
              organizer approval before it becomes public.
            </p>
            <label>
              Link valid for (days)
              <input
                type="number"
                min="1"
                max="365"
                {...linkForm.register("days", {
                  required: true,
                  valueAsNumber: true,
                  min: 1,
                  max: 365,
                })}
              />
            </label>
            {linkForm.formState.errors.days && (
              <p className="ws-error" role="alert">
                Choose between 1 and 365 days.
              </p>
            )}
            <label>
              Maximum photo uploads
              <input
                type="number"
                min="1"
                max="1000"
                {...linkForm.register("limit", {
                  required: true,
                  valueAsNumber: true,
                  min: 1,
                  max: 1000,
                })}
              />
            </label>
            {linkForm.formState.errors.limit && (
              <p className="ws-error" role="alert">
                Choose between 1 and 1000 photos.
              </p>
            )}
            {createLink.isError && (
              <p className="ws-error" role="alert">
                {apiMessage(createLink.error)}
              </p>
            )}
            <button
              type="submit"
              className="ws-button ws-primary"
              disabled={createLink.isPending}
            >
              {createLink.isPending
                ? "Creating upload link…"
                : "Create upload link"}
            </button>
          </form>
        </PlanningDialog>
      )}
      {selectedGrant && canModerate && (
        <PlanningDialog
          title="Share photo upload link"
          onClose={() => setSelectedGrant(null)}
        >
          <div className="media-share-dialog">
            {grantDetails.isPending && !qrDataUrl && (
              <p role="status">Generating QR code…</p>
            )}
            {grantDetails.isError && !qrDataUrl && (
              <p role="alert">
                {apiMessage(grantDetails.error)}{" "}
                <button
                  className="ws-button"
                  onClick={() => grantDetails.refetch()}
                >
                  Try again
                </button>
              </p>
            )}
            {qrDataUrl && (
              <img
                className="media-qr"
                src={qrDataUrl}
                width="240"
                height="240"
                alt="QR code for guest photo uploads"
              />
            )}
            <p>
              Scan the QR code or open the link to upload photos. No account is
              needed.
            </p>
            <label>
              Guest upload link
              <input
                readOnly
                value={selectedGrant.url}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <div className="media-grant-actions">
              <button
                type="button"
                className="ws-button ws-primary"
                onClick={() => copyLink(selectedGrant.url)}
              >
                <Icon name="link" />
                Copy upload link
              </button>
              <a
                href={selectedGrant.url}
                className="ws-button"
                target="_blank"
                rel="noreferrer"
              >
                Open upload page
              </a>
              {qrDataUrl && (
                <a
                  className="ws-button"
                  href={qrDataUrl}
                  download="wedding-photo-qr.png"
                >
                  Download QR code
                </a>
              )}
            </div>
            <p role="status">{copyStatus}</p>
            <p className="media-muted">
              Up to {selectedGrant.limit} photos. Expires{" "}
              {new Date(selectedGrant.expiresAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST.
            </p>
          </div>
        </PlanningDialog>
      )}
      {selectedPhoto && (organizer || selectedPhoto.state === "approved") && (
        <PlanningDialog
          title={selectedPhoto.name}
          onClose={() => setSelectedPhoto(null)}
          wide
        >
          <div className="media-lightbox">
            {!failedImages.includes(
              "full" + selectedPhoto.id + selectedPhoto.url,
            ) ? (
              <img
                src={selectedPhoto.url}
                width={selectedPhoto.width || 1200}
                height={selectedPhoto.height || 900}
                alt={selectedPhoto.name}
                onError={() =>
                  setFailedImages((current) => [
                    ...current,
                    "full" + selectedPhoto.id + selectedPhoto.url,
                  ])
                }
              />
            ) : (
              <p role="status">
                This preview expired or could not be loaded. Close it and
                refresh the photos.
              </p>
            )}
            <p>
              {selectedPhoto.state === "approved"
                ? "Approved for the guest gallery."
                : "Private preview. This photo is not public."}
            </p>
          </div>
        </PlanningDialog>
      )}
    </div>
  );
}
