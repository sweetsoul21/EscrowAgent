export const THEME_KEY = "ea-theme";

/**
 * Runs inline in <head> before the first paint, so a dark-mode visitor never sees a white flash.
 * Kept tiny and dependency-free on purpose.
 */
export const THEME_SCRIPT = `try{var p=localStorage.getItem("${THEME_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;
