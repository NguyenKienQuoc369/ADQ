export function ThemeScript() {
  // Chạy trước khi React hydrate để tránh flash theme.
  // Lấy theme từ localStorage (ưu tiên) hoặc theo system preference.
  const code = `(function(){try{var k='adq_theme_preference';var t=localStorage.getItem(k);var s=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var th=(t==='light'||t==='dark')?t:s;document.documentElement.dataset.theme=th;document.documentElement.classList.toggle('dark',th==='dark');}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

