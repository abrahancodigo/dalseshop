import snapshot from "@/data/storefront-bootstrap.json";
import { storefrontCacheScope } from "./storefrontEnvironment.mjs";

export function getStorefrontBootstrap() {
  return snapshot.projectId === storefrontCacheScope ? snapshot : null;
}
