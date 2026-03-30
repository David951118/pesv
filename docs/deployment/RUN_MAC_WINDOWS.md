# Ejecutar en macOS / Windows — AION Defensa Predictiva S.A.S

> Guia paso a paso para ejecutar la plataforma AION en entornos macOS y Windows, tanto la version web (SPA) como la version de escritorio (Tauri).

---

## 1. Requisitos Previos

### 1.1 Version Web (SPA — Vite + React + TypeScript)

| Requisito    | Version minima | Verificar con           |
| ------------ | -------------- | ----------------------- |
| **Node.js**  | 20+ LTS        | `node --version`        |
| **npm**      | 9+             | `npm --version`         |
| **Git**      | 2.30+          | `git --version`         |

#### Instalar Node.js

- **macOS**: `brew install node@20` o descargar desde [nodejs.org](https://nodejs.org)
- **Windows**: Descargar el instalador LTS desde [nodejs.org](https://nodejs.org) o usar `winget install OpenJS.NodeJS.LTS`

> **Nota**: Se recomienda usar [nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) o [nvm-windows](https://github.com/coreybutler/nvm-windows) para gestionar multiples versiones de Node.js.

### 1.2 Version de Escritorio (Tauri)

Ademas de los requisitos de la version web, se necesita:

| Requisito          | Version minima | Verificar con         |
| ------------------ | -------------- | --------------------- |
| **Rust**           | 1.75+          | `rustc --version`     |
| **Cargo**          | 1.75+          | `cargo --version`     |
| **Platform SDK**   | Ver abajo      | —                     |

#### macOS — SDK de plataforma

```bash
# Instalar Xcode Command Line Tools (obligatorio)
xcode-select --install

# Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### Windows — SDK de plataforma

1. Instalar [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con:
   - "Desktop development with C++"
   - Windows 10/11 SDK
2. Instalar [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (ya incluido en Windows 11)
3. Instalar Rust desde [rustup.rs](https://rustup.rs)

---

## 2. Clonar el Repositorio

```bash
git clone https://github.com/aion-defensa-predictiva/aion-defensa-predictiva.git
cd aion-defensa-predictiva
```

---

## 3. Configurar Variables de Entorno

Copiar el archivo de ejemplo y completar los valores:

```bash
cp .env.example .env
```

Editar `.env` con los valores reales:

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

> Consultar `docs/deployment/SUPABASE_SETUP.md` para obtener estos valores.

---

## 4. Comandos para la Version Web

### 4.1 Instalar dependencias

```bash
npm install
```

Este comando lee `package.json` e instala todas las dependencias del proyecto en `node_modules/`.

### 4.2 Iniciar servidor de desarrollo

```bash
npm run dev
```

- Inicia Vite en modo desarrollo con Hot Module Replacement (HMR).
- Por defecto escucha en `http://localhost:5173`.
- Los cambios en el codigo se reflejan instantaneamente en el navegador.

### 4.3 Compilar para produccion

```bash
npm run build
```

- Genera los archivos optimizados en el directorio `dist/`.
- Realiza tree-shaking, minificacion y code-splitting automaticamente.
- Los archivos resultantes estan listos para desplegar en cualquier servicio de hosting estatico.

### 4.4 Vista previa de produccion

```bash
npm run preview
```

- Sirve localmente los archivos compilados del directorio `dist/`.
- Util para verificar que el build de produccion funciona correctamente antes de desplegar.
- Por defecto escucha en `http://localhost:4173`.

---

## 5. Comandos para la Version de Escritorio (Tauri)

### 5.1 Instalar dependencias del modulo desktop

```bash
cd apps/desktop
npm install
```

### 5.2 Iniciar en modo desarrollo

```bash
cargo tauri dev
```

- Compila el backend de Rust y lanza la ventana de escritorio.
- El frontend web se carga con HMR dentro del WebView.
- La primera compilacion puede tardar varios minutos (Rust compila las dependencias).
- Las compilaciones subsiguientes son incrementales y mucho mas rapidas.

### 5.3 Compilar para distribucion

```bash
cargo tauri build
```

- **macOS**: Genera un `.dmg` y un `.app` en `target/release/bundle/`.
- **Windows**: Genera un `.msi` y un `.exe` en `target/release/bundle/`.

### 5.4 Volver al directorio raiz

```bash
cd ../..
```

---

## 6. Resumen de Comandos

| Accion                         | Comando                                  | Directorio          |
| ------------------------------ | ---------------------------------------- | ------------------- |
| Instalar dependencias web      | `npm install`                            | Raiz del proyecto   |
| Desarrollo web                 | `npm run dev`                            | Raiz del proyecto   |
| Build de produccion            | `npm run build`                          | Raiz del proyecto   |
| Vista previa produccion        | `npm run preview`                        | Raiz del proyecto   |
| Instalar dependencias desktop  | `npm install`                            | `apps/desktop/`     |
| Desarrollo desktop             | `cargo tauri dev`                        | `apps/desktop/`     |
| Build desktop                  | `cargo tauri build`                      | `apps/desktop/`     |

---

## 7. Solucion de Problemas (Troubleshooting)

### 7.1 Conflicto de puertos

**Sintoma**: `Error: Port 5173 is already in use`

**Solucion**:

```bash
# macOS — identificar el proceso que usa el puerto
lsof -i :5173
kill -9 <PID>

# Windows — identificar el proceso que usa el puerto
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

Alternativamente, iniciar Vite en un puerto diferente:

```bash
npm run dev -- --port 3000
```

### 7.2 Variables de entorno no definidas

**Sintoma**: Pantalla en blanco o errores de conexion a Supabase en la consola del navegador.

**Solucion**:

1. Verificar que el archivo `.env` existe en la raiz del proyecto.
2. Verificar que las variables comienzan con `VITE_` (obligatorio para que Vite las exponga al cliente).
3. Reiniciar el servidor de desarrollo despues de modificar `.env`:
   ```bash
   # Ctrl+C para detener, luego:
   npm run dev
   ```

### 7.3 Version de Node.js incorrecta

**Sintoma**: Errores de sintaxis o dependencias que no se instalan correctamente.

**Solucion**:

```bash
# Verificar version actual
node --version

# Si es menor a v20, actualizar:
# macOS con nvm
nvm install 20
nvm use 20

# Windows con nvm-windows
nvm install 20.11.0
nvm use 20.11.0
```

### 7.4 Error de compilacion en Tauri (Rust)

**Sintoma**: Errores del compilador de Rust durante `cargo tauri dev`.

**Solucion**:

```bash
# Actualizar Rust a la ultima version estable
rustup update stable

# Limpiar cache de compilacion (si hay errores persistentes)
cargo clean

# Reinstalar dependencias del sistema (macOS)
xcode-select --install

# Reinstalar dependencias del sistema (Windows)
# Reparar Visual Studio Build Tools desde el instalador
```

### 7.5 WebView2 no encontrado (Windows)

**Sintoma**: `Error: WebView2 runtime not found`

**Solucion**:

Descargar e instalar WebView2 Runtime desde:
[https://developer.microsoft.com/en-us/microsoft-edge/webview2/](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

> En Windows 11, WebView2 viene preinstalado. Este error es mas comun en Windows 10.

### 7.6 npm install falla con errores de permisos

**Sintoma**: `EACCES: permission denied` al ejecutar `npm install`.

**Solucion**:

```bash
# macOS — NO usar sudo con npm. En su lugar, configurar el directorio global:
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
# Agregar a ~/.zshrc o ~/.bash_profile:
# export PATH=~/.npm-global/bin:$PATH

# Windows — ejecutar la terminal como Administrador
# O usar nvm-windows que maneja los permisos correctamente
```

### 7.7 Build de produccion genera pagina en blanco

**Sintoma**: `npm run build` completa sin errores, pero `npm run preview` muestra una pagina en blanco.

**Solucion**:

1. Verificar la consola del navegador para errores de JavaScript.
2. Confirmar que las rutas del router (React Router) estan configuradas con `basename` correcto si se despliega en un subdirectorio.
3. Verificar que las variables de entorno de produccion estan definidas (no solo las de `.env.local`).

---

## 8. Editores de Codigo Recomendados

| Editor           | Extensiones recomendadas                                                |
| ---------------- | ----------------------------------------------------------------------- |
| **VS Code**      | ESLint, Prettier, Tailwind CSS IntelliSense, TypeScript Vue Plugin      |
| **WebStorm**     | Soporte integrado para TypeScript, React y Tailwind                     |
| **Cursor**       | Mismas extensiones de VS Code + asistente IA integrado                  |

---

*Documento interno — AION Defensa Predictiva S.A.S — Ultima actualizacion: 2026-02*
