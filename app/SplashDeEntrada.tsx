/**
 * Pantalla de entrada animada (Elegancia de Amor).
 *
 * Al abrir la app instalada en el celular, Android muestra primero su pantalla
 * de arranque (fondo `background_color` del manifest + el ícono sin fondo).
 * Esta capa la continúa con el MISMO fondo y la burbuja en el mismo lugar: la
 * burbuja aparece con un rebote, parpadea y la capa se desvanece. Dura ~1,6 s.
 *
 * - Solo en la app instalada (`display-mode: standalone`); en el navegador no sale.
 * - Una vez por sesión: al navegar dentro de la app no se repite (sessionStorage,
 *   leído en el `<head>` antes de pintar, así no parpadea).
 * - Sin JavaScript para quitarla: la animación CSS la deja invisible y sin
 *   recibir toques, y React hidrata el mismo nodo que el servidor mandó.
 */

export const SPLASH_INIT_SCRIPT = `(function(){try{if(sessionStorage.getItem('eleg-splash')){document.documentElement.setAttribute('data-splash-visto','');}else{sessionStorage.setItem('eleg-splash','1');}}catch(e){}})();`;

const CSS = `
#eleg-splash{display:none}
@media (display-mode: standalone){
  #eleg-splash{display:grid;place-items:center;position:fixed;inset:0;z-index:2147483646;background:#0f0d24;pointer-events:auto;
    animation:eleg-splash-fuera .45s cubic-bezier(.4,0,.2,1) 1.25s forwards}
}
html[data-splash-visto] #eleg-splash{display:none!important}
#eleg-splash .brillo{position:absolute;inset:0;margin:auto;width:300px;height:300px;border-radius:50%;
  background:radial-gradient(closest-side,#b9a8ff59,#b9a8ff00);opacity:0;animation:eleg-splash-brillo 1.2s ease-out .1s forwards}
#eleg-splash svg{width:120px;height:auto;overflow:visible;
  animation:eleg-splash-entra .62s cubic-bezier(.34,1.56,.64,1) both, eleg-splash-salto .5s ease-in-out .78s}
#eleg-splash .ojo{transform-box:fill-box;transform-origin:center;animation:eleg-splash-parpadeo .26s ease-in-out .58s}
@keyframes eleg-splash-entra{0%{transform:scale(.82) translateY(6px);opacity:.6}100%{transform:none;opacity:1}}
@keyframes eleg-splash-salto{0%,100%{transform:none}40%{transform:translateY(-10px) rotate(-4deg)}70%{transform:translateY(0) rotate(2deg)}}
@keyframes eleg-splash-parpadeo{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.12)}}
@keyframes eleg-splash-brillo{0%{opacity:0;transform:scale(.6)}60%{opacity:1}100%{opacity:.85;transform:scale(1)}}
@keyframes eleg-splash-fuera{to{opacity:0;visibility:hidden;pointer-events:none}}
@media (prefers-reduced-motion: reduce){
  #eleg-splash,#eleg-splash *{animation-duration:.01s!important;animation-delay:0s!important}
  #eleg-splash{animation:eleg-splash-fuera .3s ease .6s forwards!important}
}
`;

const CUERPO =
  "M196 120 H316 A76 76 0 0 1 392 196 V296 A76 76 0 0 1 377.2 341.1 L390 426 L327.8 371.1 A76 76 0 0 1 316 372 H196 A76 76 0 0 1 120 296 V196 A76 76 0 0 1 196 120 Z";

export function SplashDeEntrada() {
  return (
    <div id="eleg-splash" aria-hidden="true" suppressHydrationWarning>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="brillo" />
      <svg viewBox="96 100 320 340" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="spBody" gradientUnits="userSpaceOnUse" x1="110" y1="100" x2="400" y2="420">
            <stop offset="0" stopColor="#F6C8FF" />
            <stop offset="0.45" stopColor="#B7AEFF" />
            <stop offset="1" stopColor="#6FB8FF" />
          </linearGradient>
          <linearGradient id="spShade" gradientUnits="userSpaceOnUse" x1="0" y1="250" x2="0" y2="430">
            <stop offset="0" stopColor="#2B1F7A" stopOpacity="0" />
            <stop offset="1" stopColor="#2B1F7A" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="spGloss" gradientUnits="userSpaceOnUse" x1="0" y1="95" x2="0" y2="235">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={CUERPO} fill="url(#spBody)" />
        <path d={CUERPO} fill="url(#spShade)" />
        <path d={CUERPO} fill="url(#spGloss)" />
        <rect x="120" y="120" width="272" height="252" rx="76" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="3" />
        <path d="M377.2 341.1 L390 426 L327.8 371.1" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="3" strokeLinejoin="round" />
        <g className="ojo">
          <ellipse cx="212" cy="240" rx="28" ry="42" fill="#120F2C" />
          <ellipse cx="203" cy="223" rx="9" ry="13" fill="#FFFFFF" />
          <circle cx="221" cy="258" r="4.5" fill="#FFFFFF" opacity="0.85" />
        </g>
        <g className="ojo">
          <ellipse cx="300" cy="240" rx="28" ry="42" fill="#120F2C" />
          <ellipse cx="291" cy="223" rx="9" ry="13" fill="#FFFFFF" />
          <circle cx="309" cy="258" r="4.5" fill="#FFFFFF" opacity="0.85" />
        </g>
        <ellipse cx="168" cy="296" rx="17" ry="8" fill="#FF8A7A" opacity="0.55" />
        <ellipse cx="344" cy="296" rx="17" ry="8" fill="#FF8A7A" opacity="0.55" />
      </svg>
    </div>
  );
}
