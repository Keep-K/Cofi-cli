import Conf from "conf";

interface CofiConfig {
  lang?: "ko" | "en";
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
  provider?: "google" | "apple" | "github" | "pat";
}

const conf = new Conf<CofiConfig>({
  projectName: "cofi",
  schema: {
    lang: { type: "string", enum: ["ko", "en"] },
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    userId: { type: "string" },
    email: { type: "string" },
    provider: { type: "string", enum: ["google", "apple", "github", "pat"] },
  },
});

export const config = {
  get: <K extends keyof CofiConfig>(key: K) => conf.get(key),
  set: <K extends keyof CofiConfig>(key: K, value: CofiConfig[K]) => conf.set(key, value),
  clear: () => conf.clear(),
  getAll: () => conf.store,
  isLoggedIn: () => Boolean(conf.get("accessToken")),
};
