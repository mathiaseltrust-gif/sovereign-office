import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const excludedPrefixes = [
  "attached_assets/",
  "node_modules/",
];

const rules = [
  {
    name: "inline service/application secret",
    pattern: /\b(?:M365_SERVICE_KEY|SERVICE_KEY|SESSION_SECRET|ACR_PASSWORD|SMTP_PASSWORD)\s*=\s*["'][^"'\n$]{8,}["']/i,
  },
  {
    name: "private key material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "GitHub personal access token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
  },
  {
    name: "OpenAI-style secret key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/,
  },
];

const findings = [];

for (const file of files) {
  if (excludedPrefixes.some((prefix) => file.startsWith(prefix))) continue;

  let content;
  try {
    const buf = readFileSync(file);
    if (buf.includes(0)) continue;
    content = buf.toString("utf8");
  } catch {
    continue;
  }

  for (const rule of rules) {
    if (rule.pattern.test(content)) {
      findings.push({ file, rule: rule.name });
    }
  }
}

if (findings.length) {
  console.error("Tracked credential scan failed:");
  for (const finding of findings) {
    console.error(` - ${finding.file}: ${finding.rule}`);
  }
  console.error("Move credentials to the deployment secret store and rotate any credential that was previously committed.");
  process.exit(1);
}

console.log(`Tracked credential scan passed (${files.length} tracked files checked).`);
