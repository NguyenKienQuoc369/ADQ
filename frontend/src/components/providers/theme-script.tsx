export function ThemeScript() {
  const code = `(function(){try{localStorage.removeItem('adq_theme');document.documentElement.dataset.theme='dark';document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}catch(e){}})();`;

  return (
    <script
      id="adq-theme-script"
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
