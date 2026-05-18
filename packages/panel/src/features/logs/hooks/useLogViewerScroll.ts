import { useCallback, useEffect, useRef, useState } from "react";

interface UseLogViewerScrollOptions {
  lineCount: number;
  paused: boolean;
}

export function useLogViewerScroll({ lineCount, paused }: UseLogViewerScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevLengthRef = useRef(lineCount);

  useEffect(() => {
    if (!paused && isAtBottom && lineCount !== prevLengthRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLengthRef.current = lineCount;
  }, [paused, isAtBottom, lineCount]);

  const handleScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    setIsAtBottom(element.scrollTop + element.clientHeight >= element.scrollHeight - 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    setIsAtBottom(true);
  }, []);

  return {
    containerRef,
    isAtBottom,
    handleScroll,
    scrollToBottom,
  };
}
