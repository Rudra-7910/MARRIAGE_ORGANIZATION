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
  apiMessage,
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
import { ServicesPage } from "./ServicesPage";
import { GuestsPage, InvitationPage } from "./InvitationsPage";
import {
  BudgetPage,
  FunctionsPage,
  GuestWebsitePage,
  PeoplePage,
  PhotosPage,
  TeamsPage,
} from "./WorkspacePages";

export function AccountRoutes({ user }: { user: AuthUser }) {
  return (
    <Routes>
      <Route path="setup" element={<SetupPage user={user} />} />
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
    queryFn: getDashboard,
    staleTime: 0,
    refetchInterval: editing ? false : 5000,
    refetchOnWindowFocus: !editing,
  });
  if (signedOut(query.error)) return <Navigate to="/login" replace />;
  if (needsSetup(query.error)) return <Navigate to="/app/setup" replace />;
  if (query.isPending)
    return (
      <main className="ws-empty" role="status">
        Opening your wedding…
      </main>
    );
  if (query.isError)
    return (
      <main className="ws-empty">
        <h1>Couldn’t open your wedding</h1>
        <p role="alert">{apiMessage(query.error)}</p>
        <button className="ws-button" onClick={() => query.refetch()}>
          Try again
        </button>
      </main>
    );

  const data = query.data;
  if (!data.wedding) return <Navigate to="/app/setup" replace />;
  const organizer = data.role === "Organizer";
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
      <Routes>
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<WeddingOverview data={data} />} />
        <Route path="functions" element={<FunctionsPage data={data} />} />
        <Route path="departments" element={<TeamsPage />} />
        <Route
          path="budget"
          element={
            organizer ? <BudgetPage /> : <Navigate to="/app/overview" replace />
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
          element={<ServicesPage wedding={data.wedding} />}
        />
        <Route path="photos" element={<PhotosPage />} />
        <Route
          path="guest-website"
          element={<GuestWebsitePage data={data} />}
        />
        <Route
          path="members"
          element={<PeoplePage user={user} data={data} />}
        />
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
  onReload: () => void;
  userId: string;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const wedding = data.wedding!;
  const mutation = useMutation({
    mutationFn: (values: WeddingInput) => editWedding(values, wedding.version),
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
          <span className="dash-kicker">YOUR PLANS CAN GROW WITH YOU</span>
          <h1>Wedding settings</h1>
          <p>Edit the details shared by your dashboard and guest website.</p>
        </div>
        <Link className="ws-button" to="/app/overview">
          Back to overview
        </Link>
      </div>
      <WeddingForm
        key={wedding.version}
        initial={wedding}
        editing
        onSave={(values) => mutation.mutate(values)}
        saving={mutation.isPending}
        error={mutation.isError ? apiMessage(mutation.error) : undefined}
        onReload={onReload}
      />
    </>
  );
}
