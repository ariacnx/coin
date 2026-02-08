const required = (key: string): string => {
  const v = process.env[key];
  if (!v || v === "...") {
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
};

export const env = {
  get APP_BASE_URL() {
    return required("APP_BASE_URL");
  },
  get POSTGRES_URL() {
    return required("POSTGRES_URL");
  },
  get AUTH_TOKEN_SECRET() {
    return required("AUTH_TOKEN_SECRET");
  },
  get UPSTASH_REDIS_REST_URL() {
    return required("UPSTASH_REDIS_REST_URL");
  },
  get UPSTASH_REDIS_REST_TOKEN() {
    return required("UPSTASH_REDIS_REST_TOKEN");
  },
  get OPENAI_API_KEY() {
    return required("OPENAI_API_KEY");
  },
} as const;
