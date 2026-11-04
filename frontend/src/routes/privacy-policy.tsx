import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicyPage } from "./privacy";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
});

