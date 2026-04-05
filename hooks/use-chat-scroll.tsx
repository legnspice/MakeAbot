import { useCallback, useRef } from "react";

export function useChatScroll() {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const scrollToTop = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { containerRef, scrollToBottom, scrollToTop };
}
