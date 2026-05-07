"use client";

import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => {
        toast.error(getErrorMessage(err));
      },
    },
  },
});
