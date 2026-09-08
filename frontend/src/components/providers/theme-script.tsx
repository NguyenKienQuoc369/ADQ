export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('adq_theme')||'dark';document.documentElement.dataset.theme=t;if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');document.documentElement.style.colorScheme='light';}else{document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

  return (
    <script
      id="adq-theme-script"
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}


