// This branch is explicitly for commit/push review, without a Cloudflare deployment.
if (process.env.WORKERS_CI === "1" && process.env.WORKERS_CI_BRANCH === "improve/storefront-performance") {
  throw new Error("Deployment is disabled for the storefront performance review branch.");
}
