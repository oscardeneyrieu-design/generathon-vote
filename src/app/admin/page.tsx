import { isAdmin } from "@/lib/admin-auth";
import { PageHeader } from "@/components/Bits";

import { AdminConsole } from "./AdminConsole";
import { AdminLogin } from "./AdminLogin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let authenticated = false;

  try {
    authenticated = await isAdmin();
  } catch {
    // isAdmin lève quand ADMIN_CODE est absent : on le dit plutôt que de
    // présenter un formulaire qui refusera tous les codes sans raison.
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12">
        <PageHeader
          title="Configuration manquante"
          intro="La variable ADMIN_CODE n'est pas définie. Ajoute-la dans .env.local en local, ou dans Vercel > Settings > Environment Variables, puis redéploie."
        />
      </main>
    );
  }

  return authenticated ? <AdminConsole /> : <AdminLogin />;
}
