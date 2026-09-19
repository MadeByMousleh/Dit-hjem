const appDomain = String(process.env.TESLA_APP_DOMAIN ?? "dit-hjem-five.vercel.app").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
const baseUrl = `https://${appDomain}`;

async function checkStatus() {
  const response = await fetch(`${baseUrl}/api/tesla/status`, { redirect: "manual" });
  const body = await response.text();
  return { name: "status", code: response.status, body };
}

async function checkAuthorize() {
  const response = await fetch(`${baseUrl}/api/tesla/authorize`, { redirect: "manual" });
  return {
    name: "authorize",
    code: response.status,
    location: response.headers.get("location") ?? "",
  };
}

async function checkVehicles() {
  const response = await fetch(`${baseUrl}/api/tesla/vehicles`, { redirect: "manual" });
  const body = await response.text();
  return { name: "vehicles", code: response.status, body };
}

const [status, authorize, vehicles] = await Promise.all([
  checkStatus(),
  checkAuthorize(),
  checkVehicles(),
]);

console.log(`TESLA endpoint check for ${baseUrl}`);
console.log(`- /api/tesla/status: ${status.code} ${status.body}`);
console.log(`- /api/tesla/authorize: ${authorize.code} ${authorize.location}`);
console.log(`- /api/tesla/vehicles: ${vehicles.code} ${vehicles.body}`);

if (status.code !== 200) process.exitCode = 1;
if (authorize.code !== 302 || !authorize.location.includes("fleet-auth.prd.vn.cloud.tesla.com")) process.exitCode = 1;
if (![200, 401].includes(vehicles.code)) process.exitCode = 1;
