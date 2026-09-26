import { isAdmin } from "@/lib/admin-auth";

import { AdminConsole } from "./AdminConsole";
import { AdminLogin } from "./AdminLogin";
import { Rule } from "@/components/Bits";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let authenticated = false;
  let misconfigured = false;

  try {
    authenticated = await isAdmin();
  } catch {
    // isAdmin lève quand ADMIN_CODE est absent : on le dit plutôt que de
    // présenter un formulaire qui refusera tous les codes sans raison.
    misconfigured = true;
  }

  if (misconfigured) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[34rem] px-4 pt-6">
        <span className="t-label">Public vote — Admin</span>
        <Rule thick />
        <h1 className="t-display pt-6">Missing configuration</h1>
        <p className="t-meta mt-3">
          The <code>ADMIN_CODE</code> environment variable is not set. Add it to{" "}
          <code>.env.local</code> locally, or in Vercel &gt; Settings &gt; Environment
          Variables, then redeploy.
        </p>
      </main>
    );
  }

  return authenticated ? <AdminConsole /> : <AdminLogin />;
}
