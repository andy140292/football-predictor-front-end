import { useCallback, useEffect, useState } from "react";

const DEFAULT_OPTIONS = { threshold: 0.15, rootMargin: "0px 0px -10% 0px" };

export default function useInView(options = DEFAULT_OPTIONS) {
  const { threshold = DEFAULT_OPTIONS.threshold, rootMargin = DEFAULT_OPTIONS.rootMargin } = options;
  const [node, setNode] = useState(null);
  const [inView, setInView] = useState(false);

  const ref = useCallback((element) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(entry.target); // reveal once
      }
    }, { threshold, rootMargin });

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold, rootMargin]);

  return [ref, inView];
}
