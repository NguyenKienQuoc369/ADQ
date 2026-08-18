import Script from "next/script";

export function ThemeScript() {
  const code = `(function(){try{document.documentElement.dataset.theme='dark';document.documentElement.classList.add('dark');}catch(e){}})();`;

  return <Script id="adq-theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: code }} />;
}

