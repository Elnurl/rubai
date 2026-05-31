const apiKey = process.env.REVENUECAT_V2_SECRET_KEY;
console.log("key prefix:", apiKey ? apiKey.substring(0,8) : "MISSING");
console.log("key length:", apiKey?.length);

const resp = await fetch("https://api.revenuecat.com/v2/projects?limit=5", {
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
});
const json = await resp.json();
console.log("status:", resp.status);
console.log("projects:", JSON.stringify(json).substring(0, 200));
