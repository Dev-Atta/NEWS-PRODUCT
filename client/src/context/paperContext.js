import { createContext, useContext } from "react";

export const PaperContext = createContext(null);

export function usePaper() {
  const ctx = useContext(PaperContext);
  if (!ctx) throw new Error("usePaper must be used inside <PaperProvider>");
  return ctx;
}