import { createClient } from "@replit/revenuecat-sdk/client";
import { listProjects, createProject } from "@replit/revenuecat-sdk";

const apiKey = process.env.REVENUECAT_V2_SECRET_KEY!;
const client = createClient({
  baseUrl: "https://api.revenuecat.com/v2",
  headers: { Authorization: `Bearer ${apiKey}` },
});

const { data, error } = await listProjects({ client, query: { limit: 20 } });
console.log("listProjects error:", JSON.stringify(error));
console.log("projects:", JSON.stringify(data?.items?.map(p => ({ id: p.id, name: p.name }))));

// Try createProject
const { data: newP, error: createErr } = await createProject({ client, body: { name: "RubAI Test" } });
console.log("createProject error:", JSON.stringify(createErr));
console.log("createProject data:", JSON.stringify(newP));
