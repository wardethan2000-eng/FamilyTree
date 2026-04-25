"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { getApiBase } from "./api-base";

export const authClient = createAuthClient({
  baseURL: getApiBase(),
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
