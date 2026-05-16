# Despliegue estable en EasyPanel

Este repo se despliega como una landing estatica servida por Nginx y conectada a un n8n publico.

## 1. Servicios recomendados

- `itera-web`: App Docker desde este repositorio.
- `itera-n8n`: Template oficial de n8n en EasyPanel.
- Supabase: proyecto gestionado externo.

## 2. App `itera-web`

En EasyPanel:

1. Crea `New` -> `App`.
2. Conecta el repositorio de GitHub.
3. Builder: Dockerfile.
4. Puerto interno: `80`.
5. Dominio recomendado: `https://itera.tudominio.com`.
6. Variables:

```env
N8N_BASE_URL=https://n8n.tudominio.com
N8N_CHAT_WEBHOOK_URL=
N8N_CONTACT_WEBHOOK_URL=
```

El contenedor genera `config.js` al arrancar. Asi puedes cambiar el dominio de n8n desde EasyPanel sin modificar `script.js`.

## 3. Servicio `itera-n8n`

Instala n8n desde el template de EasyPanel y asigna un dominio publico, por ejemplo:

```txt
https://n8n.tudominio.com
```

Variables recomendadas:

```env
WEBHOOK_URL=https://n8n.tudominio.com/
N8N_EDITOR_BASE_URL=https://n8n.tudominio.com/
N8N_PROTOCOL=https
N8N_HOST=n8n.tudominio.com
N8N_PORT=5678
GENERIC_TIMEZONE=Europe/Madrid
TZ=Europe/Madrid
N8N_ENCRYPTION_KEY=valor-largo-aleatorio-y-estable
```

Genera `N8N_ENCRYPTION_KEY` una vez y no la cambies despues; n8n la usa para proteger credenciales guardadas.

Despues importa `n8n-itera-full.workflow.json`, reconecta credenciales y activa el workflow.

## 4. Supabase

1. Crea o abre el proyecto de Supabase.
2. Ejecuta `supabase_schema.sql` en SQL Editor.
3. En n8n, crea la credencial de Supabase usando la `service_role key`.
4. No pegues la `service_role key` en la web, GitHub ni variables del contenedor de la landing.

Las tablas tienen RLS activado. El frontend no accede directamente a Supabase; solo n8n lo hace.

## 5. Webhooks esperados

La landing llama a:

```txt
https://n8n.tudominio.com/webhook/chat_landing
https://n8n.tudominio.com/webhook/contact_landing
```

El workflow incluido ya define esos paths. Si cambias los paths en n8n, usa `N8N_CHAT_WEBHOOK_URL` y `N8N_CONTACT_WEBHOOK_URL` en la app web.

## 6. Checklist de verificacion

1. `https://itera.tudominio.com/healthz` responde `ok`.
2. `https://itera.tudominio.com/config.js` muestra el dominio correcto de n8n.
3. El workflow de n8n esta activo.
4. El chat responde desde la URL publica, no desde la URL de test.
5. El formulario crea un lead.
6. Supabase recibe datos en `leads` y `conversaciones`.
7. Google Sheets recibe la fila operativa.
8. Google Calendar solo crea cita cuando el lead tiene datos completos.

## 7. Seguridad minima

- Mantener claves privadas solo en n8n/Supabase.
- Usar HTTPS en landing y n8n.
- No exponer el editor de n8n en un dominio facil de adivinar si puedes protegerlo con login fuerte.
- Activar backups/snapshots del volumen de n8n desde tu proveedor/VPS.
- Revisar ejecuciones fallidas en n8n durante las primeras 24 horas tras activar el workflow.
