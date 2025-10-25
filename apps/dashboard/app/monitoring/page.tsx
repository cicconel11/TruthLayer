import { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "TruthLayer – Monitoring",
  description: "Pipeline health, annotation accuracy, and run history"
};

const MonitoringView = dynamic(() => import("./view").then((mod) => mod.MonitoringView), {
  ssr: false
});

export default function MonitoringPage() {
  return <MonitoringView />;
}

