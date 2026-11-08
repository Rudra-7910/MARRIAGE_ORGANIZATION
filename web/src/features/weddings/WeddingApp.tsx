import { useState } from "react";
import { apiMessage } from "../../lib/api";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "../../lib/api";
import {
  canOrganize,
  editWedding,
  getDashboard,
  needsSetup,
  signedOut,
} from "../../lib/weddings";
import type { Workspace, WeddingInput } from "../../lib/weddings";
import { SetupPage } from "./SetupPage";
import { WeddingForm } from "./WeddingForm";
import { DashboardLayout } from "./DashboardLayout";
import { WeddingOverview } from "./WeddingOverview";
import { PeoplePage } from "./PeoplePage";
import { ServicesPage } from "./ServicesPage";
import { GuestsPage, InvitationPage } from "./InvitationsPage";
import { FunctionsPage } from "./FunctionsPage";
import { TeamsPage } from "./TeamsPage";
import { BudgetPage } from "./BudgetPage";
import { PhotosPage } from "./PhotosPage";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { GuestWebsitePage } from "./GuestWebsitePage";
import { ProviderAccountPage } from "../providers/ProviderAccountPage";

export function AccountRoutes({ user }: { user: AuthUser }) {
  return (
    <Routes>
      <Route path="setup" element={<SetupPage user={user} />} />
      <Route path="provider" element={<ProviderAccountPage user={user} />} />
      <Route path="*" element={<WeddingWorkspace user={user} />} />
    </Routes>
  );
}

function WeddingWorkspace({ user }: { user: AuthUser }) {
  const location = useLocation();
  const editing =
    location.pathname.endsWith("/edit") ||
    location.pathname.endsWith("/settings");
  const query = useQuery({
    queryKey: ["wedding-dashboard", user.id],
    queryFn: ({ signal }) => getDashboard(signal),
    staleTime: 30000,
    refetchInterval: editing ? false : 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !editing,
  });
  if (signedOut(query.error))
    return (
      <Navigate
        to="/login"
        replace
        state={{
          returnTo: location.pathname + location.search + location.hash,
        }}
      />
    );
  if (needsSetup(query.error)) return <Navigate to="/app/setup" replace />;
  if (query.isPending)
    return (
      <main className="ws-empty" role="status">
        Opening your wedding…
      </main>
    );
  if (query.isError && !query.data)
    return (
      <main className="ws-empty">
        <h1>Couldn’t open your wedding</h1>
        <p role="alert">{apiMessage(query.error)}</p>
        <button className="ws-button" onClick={() => query.refetch()}>
          Try again
        </button>
      </main>
    );

  const data = query.data!;
  if (!data.wedding) return <Navigate to="/app/setup" replace />;
  const organizer = canOrganize(data.role);
  const editPage = organizer ? (
    <EditWedding
      userId={user.id}
      data={data}
      onReload={() => query.refetch()}
    />
  ) : (
    <Navigate to="/app/overview" replace />
  );
  return (
    <DashboardLayout user={user} data={data}>
      {query.isError && (
        <p className="celebration-sync-notice" role="status">
          Couldn’t refresh your workspace. Showing your last saved details.
          <button onClick={() => query.refetch()}>Try again</button>
        </p>
      )}
      <Routes>
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route
          path="overview"
          element={<WeddingOverview data={data} userId={user.id} />}
        />
        <Route
          path="functions"
          element={<FunctionsPage data={data} userId={user.id} />}
        />
        <Route path="departments" element={<TeamsPage userId={user.id} />} />
        <Route
          path="attention"
          element={<TeamsPage key="attention" userId={user.id} attentionOnly />}
        />
        <Route
          path="budget"
          element={
            organizer ? (
              <BudgetPage userId={user.id} />
            ) : (
              <Navigate to="/app/overview" replace />
            )
          }
        />
        <Route
          path="guests"
          element={
            organizer ? (
              <GuestsPage userId={user.id} />
            ) : (
              <Navigate to="/app/overview" replace />
            )
          }
        />
        <Route
          path="guests/:guestId/invitation"
          element={
            organizer ? (
              <InvitationPage userId={user.id} data={data} />
            ) : (
              <Navigate to="/app/overview" replace />
            )
          }
        />
        <Route
          path="services"
          element={<ServicesPage wedding={data.wedding} userId={user.id} />}
        />
        <Route
          path="photos"
          element={<PhotosPage userId={user.id} data={data} />}
        />
        <Route
          path="announcements"
          element={
            organizer ? (
              <AnnouncementsPage userId={user.id} />
            ) : (
              <Navigate to="/app/overview" replace />
            )
          }
        />
        <Route
          path="guest-website"
          element={<GuestWebsitePage data={data} />}
        />
        <Route path="members" element={<PeoplePage userId={user.id} />} />
        <Route path="settings" element={editPage} />
        <Route path="wedding/edit" element={editPage} />
        <Route path="*" element={<Navigate to="/app/overview" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function EditWedding({
  data,
  onReload,
  userId,
}: {
  data: Workspace;
  onReload: () => Promise<{ data?: Workspace }>;
  userId: string;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const wedding = data.wedding!;
  const [editVersion, setEditVersion] = useState(wedding.version);
  const [formKey, setFormKey] = useState(0);
  const mutation = useMutation({
    mutationFn: (values: WeddingInput) => editWedding(values, editVersion),
    onSuccess: async (next) => {
      cache.setQueryData(["wedding-dashboard", userId], next);
      cache.setQueryData(["wedding-setup", userId], next);
      await cache.invalidateQueries({
        queryKey: ["guest-wedding", wedding.publicId],
      });
      navigate("/app/overview");
    },
  });
  return (
    <>
      <div className="dash-page-heading">
        <div>
          <h1>Wedding settings</h1>
          <p>Edit the details shared by your dashboard and guest website.</p>
        </div>
        <Link className="ws-button" to="/app/overview">
          Back to overview
        </Link>
      </div>
      <WeddingForm
        key={formKey}
        initial={wedding}
        editing
        onSave={(values) => mutation.mutate(values)}
        saving={mutation.isPending}
        error={mutation.isError ? apiMessage(mutation.error) : undefined}
        onReload={async () => {
          const refreshed = await onReload();
          if (refreshed.data?.wedding) {
            setEditVersion(refreshed.data.wedding.version);
            setFormKey((value) => value + 1);
          }
        }}
      />
    </>
  );
}
