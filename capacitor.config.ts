import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.finyu.app",
  appName: "Finyu",
  webDir: "dist",
  server: {
    androidScheme: "https",
    hostname: "finyu.web.id",
  },
};

export default config;
