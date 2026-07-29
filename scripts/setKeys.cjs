const { generateKeyPairSync } = require("crypto");
const { spawn } = require("child_process");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const pem = privateKey.trim();

function setEnv(name, value) {
  return new Promise((resolve, reject) => {
    const child = spawn("bunx", ["convex", "env", "set", name, value], {
      stdio: "inherit",
      cwd: __dirname.replace(/[\\/]scripts$/, ""),
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Exit code ${code}`));
    });
  });
}

(async () => {
  console.log("Setting JWT_PRIVATE_KEY...");
  await setEnv("JWT_PRIVATE_KEY", pem);
  console.log("Setting AUTH_PRIVATE_KEY...");
  await setEnv("AUTH_PRIVATE_KEY", pem);
  console.log("\n✅ Done! Both keys set successfully.");
})();
