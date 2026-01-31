# 🦄 Modo Unicornio - Documentación

## ¿Qué es el Modo Unicornio?

El **Modo Unicornio** (internamente llamado `unicorn`) es el tercer tema visual de Vibe Arena, diseñado como un modo "party" festivo y colorido. Es un tema especial que transforma la interfaz en una experiencia visual vibrante con:

- 🌈 Gradientes arcoíris animados
- ✨ Partículas flotantes brillantes
- 💫 Emojis animados subiendo por la pantalla
- 🎨 Paleta de colores neón (rosa, púrpura, verde menta)

---

## Cómo Activar el Modo Unicornio

### Para Usuarios
1. Haz clic en el botón de tema (esquina superior derecha)
2. Cicla entre los temas: **Dark** → **Light** → **Party!** 🦄
3. El modo queda guardado en `localStorage` bajo la clave `arena-theme`

### Ciclo de Temas
```
Dark 🌙 → Light ☀️ → Party! 🦄 → Dark 🌙 (repite)
```

---

## Arquitectura Técnica

### Archivos Involucrados

| Archivo | Propósito |
|---------|-----------|
| `app/context/ThemeContext.tsx` | Contexto React que maneja el estado del tema |
| `app/components/ThemeToggle.tsx` | Botón de toggle entre temas |
| `app/components/UnicornBackground.tsx` | Canvas animado + emojis flotantes |
| `app/components/ClientLayout.tsx` | Layout que incluye el fondo unicornio |
| `app/globals.css` | Variables CSS para el tema unicornio |

---

## Componentes del Modo Unicornio

### 1. UnicornBackground.tsx
Este componente renderiza los efectos visuales cuando el tema está activo:

#### Capas Visuales (z-index)
```
z=0: Gradiente base (rosa/púrpura/verde menta semi-transparente)
z=1: Canvas con partículas animadas (80 partículas)
z=2: Emojis flotantes animados con Framer Motion
```

#### Tipos de Partículas
1. **Stars** (⭐): Estrellas de 5 puntas con colores HSL cambiantes
2. **Circles** (○): Círculos con efecto glow radial
3. **Sparkles** (✦): Cruces brillantes tipo destello

#### Emojis Flotantes
Los siguientes emojis flotan desde abajo hacia arriba:
```javascript
['🦄', '✨', '🌈', '💖', '⭐', '🎉', '💫', '🔮']
```

Animación:
- Duración: 10-20 segundos por ciclo
- Rotación: 360° completo
- Estilo: Loop infinito escalonado

---

### 2. Variables CSS del Tema

Definidas en `globals.css` bajo `[data-theme="unicorn"]`:

```css
/* 🦄 Unicorn Mode - Party Time! */
[data-theme="unicorn"],
.unicorn {
  --primary-green: #7873f5;        /* Púrpura neón */
  --primary-green-hover: #ff6ec4;  /* Rosa neón */
  --accent-red: #ff6ec4;           /* Rosa brillante */
  --white: #1a1030;                /* Fondo oscuro púrpura */
  --off-white: #251845;            /* Fondo alternativo */
  --surface: rgba(40, 30, 80, 0.9);    /* Superficies glassmorphism */
  --surface-alt: rgba(60, 40, 100, 0.8);
  --border: rgba(255, 255, 255, 0.15);
  --shadow: 0 4px 20px rgba(120, 115, 245, 0.3);
  --shadow-hover: 0 8px 40px rgba(255, 110, 196, 0.4);
  --text-primary: #ffffff;
  --text-secondary: #d0c5f5;       /* Lavanda claro */
  --text-muted: #a090d0;           /* Púrpura suave */
}
```

#### Paleta de Colores Principal
| Color | Hex | Uso |
|-------|-----|-----|
| Rosa Neón | `#ff6ec4` | Acentos, hovers, bordes |
| Púrpura Neón | `#7873f5` | Color primario |
| Verde Menta | `#4fffb0` | Acentos secundarios |
| Púrpura Oscuro | `#1a1030` | Fondo base |

---

### 3. ThemeToggle - Estilos Especiales

Cuando el modo unicornio está activo, el botón de toggle tiene un estilo especial:

```javascript
// Botón con gradiente arcoíris
background: 'linear-gradient(135deg, #ff6ec4, #7873f5, #4fffb0)'

// Borde semi-transparente
border: '2px solid rgba(255,255,255,0.3)'

// Sombra con glow neón
boxShadow: '0 4px 30px rgba(255,110,196,0.5), 0 0 60px rgba(120,115,245,0.3)'
```

El icono cambia de 🌙/☀️ a 🦄 y el label dice "Party!"

---

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario hace clic                         │
│                   en ThemeToggle                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    cycleTheme()                              │
│          dark → light → unicorn → dark (ciclo)               │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              localStorage.setItem('arena-theme')             │
│         document.documentElement.setAttribute()              │
└─────────────────────────────┬───────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   CSS Variables Update   │    │  UnicornBackground.tsx   │
│   (globals.css activa    │    │  detecta theme=unicorn   │
│    :unicorn selector)    │    │  y renderiza efectos     │
└──────────────────────────┘    └──────────────────────────┘
```

---

## Consideraciones de Performance

### Canvas Animation
- **80 partículas** se animan a 60fps via `requestAnimationFrame`
- El canvas se limpia y redibuja cada frame
- Cleanup automático en `useEffect` return

### Framer Motion
- 8 emojis con animaciones independientes
- Delay escalonado para evitar saturación visual

### Optimizaciones Implementadas
```javascript
// Solo renderiza si el tema es unicorn
if (theme !== 'unicorn') return null

// Cleanup de animación al cambiar tema
return () => {
  window.removeEventListener('resize', resize)
  cancelAnimationFrame(animationId)
}
```

---

## Accesibilidad

### Reduced Motion
El sistema respeta las preferencias de usuario:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Contraste
- Texto blanco sobre fondo púrpura oscuro mantiene buen contraste
- Los elementos interactivos tienen estados focus visibles

---

## Extensibilidad

### Agregar Nuevos Emojis
En `UnicornBackground.tsx`, modifica el array:
```javascript
{['🦄', '✨', '🌈', '💖', '⭐', '🎉', '💫', '🔮', '🎀', '🌟'].map(...)}
```

### Agregar Nuevos Tipos de Partículas
En el switch dentro de `animate()`:
```javascript
if (p.type === 'heart') {
  // Dibujar corazón
}
```

### Modificar Colores del Gradiente
En `globals.css`, ajusta las variables bajo `.unicorn`

---

## Easter Egg

El modo unicornio es técnicamente un "easter egg" escondido a simple vista. Los usuarios que ciclen más allá del modo light descubrirán esta experiencia festiva sorpresa. 🎊

---

*Documentación generada: Enero 2026*
*Vibe Arena - Sistema de Temas*
