import dynamicImport from "next/dynamic";

const DashboardView = dynamicImport(() => import("./components/dashboard-view").then((mod) => mod.DashboardView), {
  ssr: false
});

export const dynamic = "force-dynamic";

export default function Page() {
  return <DashboardView />;
}
