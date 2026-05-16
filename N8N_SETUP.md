# ITERA n8n + Supabase + Google Sheets

## Archivos

- `n8n-itera-full.workflow.json`: workflow listo para importar en n8n.
- `supabase_schema.sql`: tablas necesarias en Supabase.
- `tools/generate_n8n_workflow.js`: generador que toma como base el export actual de n8n en `C:\Users\Alex\Downloads\ITERA Landing - Chat, Leads, Supabase y Google Sheets.json`.

## Pasos

1. En Supabase, abre SQL Editor y ejecuta `supabase_schema.sql`.
2. En n8n, importa `n8n-itera-full.workflow.json`.
3. Este JSON conserva las credenciales e IDs del export de n8n:
   - OpenAI: `OpenAI account`, modelo `gpt-4.1-mini`.
   - Supabase: `Supabase account`.
   - Google Sheets: documento `1rViutg_M2NxV2_-ojCstpvVj3kFCYO5ea38oeZtFRMY`, hoja `Leads`.
   - Google Calendar: `alexdelrosalmoreno@gmail.com`.
4. Si n8n pide reconectar alguna credencial tras importar, selecciona la misma credencial que aparece en el nodo.
5. La hoja `Leads` debe tener estas columnas:
   - Fecha
   - Origen
   - Nombre
   - Email
   - Telefono
   - Empresa
   - Servicio
   - Necesidad
   - Estado
   - Score
   - Session
6. Activa el workflow.

## Webhooks esperados por la web

- Chat: `https://TU_DOMINIO_N8N/webhook/chat_landing`
- Formulario: `https://TU_DOMINIO_N8N/webhook/contact_landing`

En EasyPanel configura la landing con `N8N_BASE_URL=https://TU_DOMINIO_N8N`.

## OpenAI con API key propia

Si se acaban los creditos gratuitos de n8n, crea una credencial propia:

1. En n8n ve a `Credentials`.
2. Crea una credencial nueva de `OpenAI`.
3. Pega tu API key de OpenAI. No la pegues en el frontend ni en archivos del proyecto.
4. Ponle un nombre claro, por ejemplo `OpenAI ITERA API`.
5. Abre estos nodos y cambia la credencial antigua por `OpenAI ITERA API`:
   - `Interpreta lead del chat`
   - `Interpreta solicitud de cita`
   - `Agente comercial ITERA`
6. Guarda el workflow y ejecuta una prueba del chat.

Modelo actual del workflow: `gpt-4.1-mini`.

## Que hace

- El chat guarda mensajes en `conversaciones` con `session_id`.
- El chat lee el ultimo lead guardado de esa `session_id` desde Supabase antes de interpretar cada mensaje.
- El chat fusiona datos nuevos con la ficha persistente de Supabase, crea un snapshot de lead y lo copia a Google Sheets solo cuando detecta campos nuevos.
- El agente responde usando el historial reciente y la ficha persistente del lead de esa sesion.
- Si el usuario pide una cita, el chat no consulta Google Calendar hasta tener nombre, email, telefono, empresa, servicio/interes y fecha+hora.
- Cuando tiene todos los datos, consulta Google Calendar y crea una cita de 15 minutos si el hueco esta libre.
- Si el hueco esta ocupado, propone otro hueco libre del mismo dia entre 09:00 y 18:00.
- El formulario crea leads directos con empresa, telefono, servicio, UTMs y calculadora.
- Google Sheets recibe una copia operativa de cada lead.

## Prueba rapida del chat

Envia en el chat algo como:

`Me llamo Pedro Sanchez Perro, mi email es pedro@empresa.com, mi telefono es 600000000, mi empresa es Empresa S.A., quiero chatbots y me vendria bien manana a las 5 de la tarde.`

La ejecucion deberia guardar lead en Supabase/Sheets y solo pasar a Calendar cuando `ready_to_book` sea `true`.

## Nota de seguridad

No pongas claves privadas de Supabase ni Google en `script.js`. Las credenciales deben vivir en n8n o en Supabase.
