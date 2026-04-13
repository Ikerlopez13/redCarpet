// Global Fail-safe for Framer Motion Purge
// Prevents ReferenceError: motion if any stale components remain in cache
if (typeof window !== 'undefined') {
  (window as any).motion = {
    div: 'div',
    button: 'button',
    span: 'span',
    form: 'form',
    input: 'input',
    label: 'label',
    li: 'li',
    ul: 'ul',
    nav: 'nav',
    p: 'p',
    section: 'section',
    header: 'header',
    footer: 'footer',
    main: 'main',
    article: 'article',
    aside: 'aside',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
  };
  (window as any).AnimatePresence = ({ children }: any) => children;
  console.log("🛠️ Framer Motion Fail-safe Active");
}
export {};
