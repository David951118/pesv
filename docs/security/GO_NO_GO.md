# Checklist Go/No-Go de Release — AION Defensa Predictiva S.A.S

> Lista de verificacion obligatoria antes de autorizar cualquier despliegue a produccion. Cada item debe ser verificado y marcado por al menos un miembro del equipo. Un solo item en "No-Go" bloquea el release.

---

## Instrucciones

- Marcar cada item con `[x]` cuando este verificado.
- Si un item no aplica para este release, marcarlo con `[N/A]` y justificar.
- El release solo se autoriza cuando **todos** los items estan en `[x]` o `[N/A]`.
- Fecha del checklist: _______________
- Version del release: _______________
- Responsable de la verificacion: _______________

---

## A. Build y Codigo (Items 1-6)

- [ ] **1. Build de produccion exitoso**: `npm run build` completa sin errores ni warnings criticos.
- [ ] **2. Sin referencias a marca anterior**: Ejecutar `./scripts/brand-verify.sh` y confirmar 0 FAIL. El script verifica que no existan referencias a generadores o marcas previas en codigo fuente, titulos ni metadatos.
- [ ] **3. Sin secretos en codigo cliente**: Verificar que no existen API keys, service_role keys, contrasenas ni tokens hardcodeados en el codigo fuente. Ejecutar `rg -i "(service_role|secret|password|private_key)" src/`.
- [ ] **4. Variables de entorno configuradas**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` apuntan al proyecto de produccion correcto. El archivo `.env` NO esta incluido en el repositorio.
- [ ] **5. Sin errores en consola**: Abrir la aplicacion en el navegador con la build de produccion (`npm run preview`) y verificar que no hay errores de JavaScript en la consola del navegador (DevTools → Console).
- [ ] **6. Dependencias actualizadas y sin vulnerabilidades criticas**: Ejecutar `npm audit` y confirmar que no existen vulnerabilidades de severidad alta o critica.

---

## B. Autenticacion y Seguridad (Items 7-13)

- [ ] **7. Inicio de sesion funciona**: Un usuario puede iniciar sesion con email y contrasena correctos y es redirigido al dashboard correspondiente.
- [ ] **8. Cierre de sesion funciona**: Al cerrar sesion, el usuario es redirigido al login, el token se invalida y no es posible acceder a rutas protegidas sin re-autenticarse.
- [ ] **9. Acceso basado en roles — Admin**: Un usuario con rol `admin` puede acceder a todas las secciones: dashboard, vehiculos, conductores, documentos, FUEC, RNDC, preoperativas, mantenimiento, usuarios, reportes y configuracion.
- [ ] **10. Acceso basado en roles — Conductor**: Un usuario con rol `conductor` solo puede acceder a las secciones permitidas (preoperativas, sus documentos, su perfil) y NO puede ver gestion de usuarios, reportes administrativos ni configuracion global.
- [ ] **11. RLS activo en todas las tablas sensibles**: Verificar en Supabase Dashboard que Row Level Security esta habilitado en todas las tablas que contienen datos de tenants. Ningun usuario debe poder ver datos de otro tenant.
- [ ] **12. HTTPS forzado**: Todas las solicitudes HTTP se redirigen a HTTPS. Verificar que el certificado SSL es valido y no esta expirado.
- [ ] **13. Sin secretos en el cliente**: Abrir las DevTools del navegador (Sources / Network) y confirmar que la `service_role key` de Supabase no aparece en ningun archivo JavaScript, respuesta de red ni localStorage.

---

## C. Navegacion y Rutas (Items 14-16)

- [ ] **14. Todas las rutas son accesibles**: Navegar por cada ruta del router y verificar que todas cargan correctamente sin errores 404 ni pantallas en blanco. Incluir rutas: `/dashboard`, `/vehiculos`, `/conductores`, `/documentos`, `/fuec`, `/rndc`, `/preoperativas`, `/mantenimiento`, `/usuarios`, `/reportes`, `/configuracion`, `/mapa`.
- [ ] **15. Rutas protegidas redirigen al login**: Al acceder directamente a una ruta protegida sin autenticacion (ej: `/dashboard`), el usuario es redirigido al formulario de login.
- [ ] **16. Navegacion responsiva en movil**: Abrir la aplicacion en un dispositivo movil (o emulador de Chrome DevTools) y verificar que el menu de navegacion funciona correctamente, los formularios son usables y las tablas se adaptan al tamano de pantalla.

---

## D. Modulos Funcionales (Items 17-23)

- [ ] **17. Modulo FUEC funcional**: Se puede crear, visualizar, editar y descargar un Formato Unico de Extracto del Contrato (FUEC). El PDF generado contiene todos los campos requeridos por la normativa colombiana.
- [ ] **18. Modulo RNDC funcional**: La integracion con el Registro Nacional de Despacho de Carga funciona correctamente: se pueden consultar, registrar y actualizar manifiestos (si aplica al tipo de empresa).
- [ ] **19. Mapa y rastreo GPS funcional**: El modulo de mapa carga correctamente, muestra las ubicaciones de los vehiculos y actualiza las posiciones en tiempo real (o segun la frecuencia configurada).
- [ ] **20. Preoperativas funcional**: Un conductor puede llenar el formulario de inspeccion preoperativa completo, incluyendo fotos si es requerido, y el formulario se guarda correctamente en la base de datos.
- [ ] **21. Gestion de documentos funcional**: Se pueden subir, visualizar, descargar y gestionar documentos de vehiculos y conductores (SOAT, tecnicomecanica, licencias, etc.). Las alertas de vencimiento se muestran correctamente.
- [ ] **22. Gestion de usuarios funcional**: Un administrador puede crear, editar, desactivar y asignar roles a usuarios del tenant. Los cambios de rol se reflejan inmediatamente en los permisos del usuario.
- [ ] **23. Auditoria y trazabilidad funcional**: Las acciones criticas (creacion, edicion, eliminacion de registros) quedan registradas en el log de auditoria con timestamp, usuario y detalle del cambio.

---

## E. Edge Functions y Backend (Items 24-26)

- [ ] **24. Edge Functions desplegadas**: Ejecutar `supabase functions list` y confirmar que todas las funciones requeridas estan desplegadas y en estado activo.
- [ ] **25. Edge Functions responden correctamente**: Invocar cada Edge Function con datos de prueba y verificar que retorna la respuesta esperada (codigos HTTP correctos, datos validos).
- [ ] **26. Secretos configurados**: Ejecutar `supabase secrets list` y confirmar que todos los secretos necesarios estan definidos (claves de API de terceros, credenciales SMTP, etc.).

---

## F. Rendimiento y Experiencia de Usuario (Items 27-30)

- [ ] **27. Tiempo de carga aceptable**: La pagina principal (dashboard) carga completamente en menos de 3 segundos con una conexion de internet promedio en Colombia (10 Mbps). Medir con Lighthouse o DevTools → Performance.
- [ ] **28. Favicons y logos correctos**: El favicon del navegador muestra el icono de AION (no el icono por defecto de Vite). El logo en el header/sidebar de la aplicacion se muestra correctamente. El `manifest.json` referencia los iconos de AION.
- [ ] **29. Manejo de errores graceful**: Cuando ocurre un error (red, servidor, datos invalidos), la aplicacion muestra un mensaje de error comprensible al usuario en lugar de una pantalla en blanco o un error tecnico crudo.
- [ ] **30. Sin fugas de memoria evidentes**: Navegar por la aplicacion durante 5 minutos, cambiando entre secciones, y verificar que el uso de memoria en el tab del navegador se mantiene estable (DevTools → Memory).

---

## G. Seguridad Avanzada — Desktop (Items 31-33)

> Los siguientes items aplican unicamente si se despliega la version de escritorio (Tauri).

- [ ] **31. Reglas DLP activas**: Si la aplicacion de escritorio implementa Data Loss Prevention, verificar que las reglas estan configuradas y activas (ej: no se pueden copiar datos sensibles al portapapeles sin autorizacion).
- [ ] **32. Cifrado en reposo verificado**: Los archivos almacenados localmente por la aplicacion de escritorio estan cifrados con AES-256-GCM (o equivalente). Verificar que los archivos en disco no son legibles en texto plano.
- [ ] **33. Actualizador automatico configurado**: El mecanismo de actualizacion automatica de Tauri (Tauri Updater) esta configurado y apuntando al servidor de actualizaciones correcto.

---

## H. Datos y Respaldos (Items 34-37)

- [ ] **34. Flujo de respaldo probado**: Si el sistema de respaldo a Google Drive esta habilitado, ejecutar un respaldo completo de prueba y verificar que los archivos aparecen correctamente en la carpeta del Drive del tenant.
- [ ] **35. Retencion de datos configurada**: Las politicas de retencion de datos estan definidas y la limpieza automatica de respaldos antiguos funciona segun lo especificado en la politica del tenant.
- [ ] **36. Datos de prueba eliminados**: No existen registros de prueba (usuarios ficticios, vehiculos de prueba, etc.) en la base de datos de produccion.
- [ ] **37. Migraciones aplicadas**: Todas las migraciones de base de datos estan aplicadas en el entorno de produccion (`supabase migration list` no muestra migraciones pendientes).

---

## I. Cumplimiento y Documentacion (Items 38-40)

- [ ] **38. Politica de privacidad y terminos de uso**: Los enlaces a la politica de privacidad y terminos de uso estan visibles y apuntan a documentos actualizados que cumplen con la Ley 1581 de 2012 (Habeas Data) de Colombia.
- [ ] **39. Documentacion operativa actualizada**: Los documentos en `docs/` reflejan el estado actual del sistema (SUPABASE_SETUP.md, RUN_MAC_WINDOWS.md, etc.).
- [ ] **40. Plan de rollback definido**: Existe un procedimiento documentado para revertir el despliegue en caso de errores criticos en produccion (version anterior del frontend, migraciones de rollback, etc.).

---

## Resultado Final

| Seccion                                   | Items verificados | Total items | Estado     |
| ----------------------------------------- | ----------------- | ----------- | ---------- |
| A. Build y Codigo                         | __ / 6            | 6           |            |
| B. Autenticacion y Seguridad              | __ / 7            | 7           |            |
| C. Navegacion y Rutas                     | __ / 3            | 3           |            |
| D. Modulos Funcionales                    | __ / 7            | 7           |            |
| E. Edge Functions y Backend               | __ / 3            | 3           |            |
| F. Rendimiento y Experiencia de Usuario   | __ / 4            | 4           |            |
| G. Seguridad Avanzada — Desktop           | __ / 3            | 3           |            |
| H. Datos y Respaldos                      | __ / 4            | 4           |            |
| I. Cumplimiento y Documentacion           | __ / 3            | 3           |            |
| **TOTAL**                                 | **__ / 40**       | **40**      |            |

### Decision

- [ ] **GO** — Todos los items verificados. El release esta autorizado.
- [ ] **NO-GO** — Uno o mas items fallaron. El release esta bloqueado hasta que se resuelvan.

**Firma del responsable**: _______________

**Fecha de autorizacion**: _______________

---

*Documento interno — AION Defensa Predictiva S.A.S — Ultima actualizacion: 2026-02*
