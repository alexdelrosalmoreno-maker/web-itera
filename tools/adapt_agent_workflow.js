const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const sourcePath = 'C:\\Users\\Alex\\Desktop\\05_Proyectos_Creativos\\Chatbot-prueba-alex.json';
const currentPath = path.join(process.cwd(), 'n8n-itera-full.workflow.json');
const outputPath = path.join(process.cwd(), 'outputs', 'Chatbot-prueba-alex-ITERA-adaptado.json');

const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

const currentNode = (name) => current.nodes.find((node) => node.name === name);
const cred = (type) => current.nodes.find((node) => node.credentials?.[type])?.credentials;

const openAiCredentials = cred('openAiApi');
const sheetsCredentials = cred('googleSheetsOAuth2Api');
const calendarCredentials = cred('googleCalendarOAuth2Api');
const supabaseCredentials = cred('supabaseApi');
const sheetNode = currentNode('Añade lead chat a Sheets');
const calendarNode = currentNode('Crea cita Calendar') || currentNode('Busca eventos del día');

const sheetDocumentId = sheetNode.parameters.documentId;
const sheetName = sheetNode.parameters.sheetName;
const sheetSchema = sheetNode.parameters.columns.schema || [];
const calendarConfig = calendarNode.parameters.calendar;

const removeNodes = new Set([
  'Postgres Chat Memory',
  'OpenAI Chat Model1',
  'Supabase Vector Store',
  'Embeddings OpenAI',
  'Base de datos',
  'AI Agent Tool',
  'OpenAI Chat Model2',
  'Consultar disponibilidad',
  'Crear evento',
  'Modificar evento',
  'Eliminar evento',
  'Registro citas',
  'Buscar citas',
]);

workflow.name = 'ITERA Agent - Chat, CRM y Calendar';
workflow.active = false;
workflow.id = undefined;
workflow.versionId = undefined;
workflow.nodes = workflow.nodes.filter((node) => !removeNodes.has(node.name));

for (const key of Object.keys(workflow.connections || {})) {
  if (removeNodes.has(key)) delete workflow.connections[key];
}

for (const connection of Object.values(workflow.connections || {})) {
  for (const channel of Object.values(connection)) {
    for (const output of channel) {
      for (let i = output.length - 1; i >= 0; i -= 1) {
        if (removeNodes.has(output[i].node)) output.splice(i, 1);
      }
    }
  }
}

const node = (name) => workflow.nodes.find((item) => item.name === name);

const mainPrompt = `Eres el asistente comercial oficial de ITERA.

ITERA ayuda a empresas con automatizaciones de IA, chatbots, agentes de trabajo, integraciones con n8n, CRM y consultoria estrategica.

Tu objetivo principal es convertir conversaciones en leads claros y, cuando el usuario quiera una cita, conseguir todos los datos necesarios y agendarla.

DATOS OBLIGATORIOS PARA AGENDAR:
- nombre
- email
- telefono
- empresa
- servicio o area de interes
- fecha y hora

REGLAS DE CONTEXTO:
- Usa la memoria de la conversacion y las herramientas CRM. Si ya tienes un dato, no lo vuelvas a pedir.
- Si faltan varios datos, pidelos todos juntos en una sola respuesta.
- Si el usuario da datos en varios mensajes, acumula esos datos y continua desde ahi.
- El input que recibes es JSON con message, sessionId y now. Usa siempre sessionId al crear o actualizar registros.
- No digas que una cita esta agendada. El workflow lo hara despues de que Google Calendar cree el evento.
- Cuando tengas datos nuevos del cliente, usa el Agente CRM para crear o actualizar el contacto.
- Cuando tengas todos los datos obligatorios y el usuario quiera cita, marca ready_to_book=true en tu JSON.
- No menciones herramientas internas, Google Sheets, APIs, IDs internos ni errores tecnicos al usuario.

FORMATO DE SALIDA OBLIGATORIO:
Responde SIEMPRE y SOLO con JSON valido, sin markdown:
{
  "reply": "texto para el usuario",
  "lead": {
    "nombre": "",
    "email": "",
    "telefono": "",
    "empresa": "",
    "servicio": ""
  },
  "wants_meeting": false,
  "ready_to_book": false,
  "missing_fields": [],
  "start_iso": "",
  "end_iso": "",
  "session_id": ""
}

REGLAS DEL JSON:
- reply debe ser breve y natural.
- Si faltan datos, missing_fields debe incluirlos y reply debe pedirlos todos juntos.
- Si estan nombre, email, telefono, empresa, servicio y fecha/hora, ready_to_book=true.
- Si ready_to_book=true, start_iso y end_iso deben ser ISO 8601 con zona Europe/Madrid. La cita dura 15 minutos.
- Si el usuario dice "manana a las 5 de la tarde", usa la fecha de now + 1 dia a las 17:00 Europe/Madrid.
- session_id debe ser el sessionId recibido en el input.

SERVICIOS VALIDOS:
- Chatbots e IA Conversacional
- Automatizacion de Flujos
- Agentes Autonomos de Trabajo
- CRM y gestion de leads
- Consultoria Estrategica de IA
- Otro proyecto a medida

FLUJO DE CITA:
1. Detecta intencion de agendar.
2. Revisa que tienes nombre, email, telefono, empresa, servicio y fecha/hora.
3. Si falta algo, pidelo todo junto.
4. Si esta todo, no digas "cita confirmada"; di en reply que vas a reservarla y marca ready_to_book=true.`;

const crmPrompt = `Eres el Agente CRM de ITERA.

Responsabilidad:
- Crear o actualizar la ficha del lead en Google Sheets.
- Evitar duplicados usando Session si existe y email si no existe Session.
- Guardar solo datos aportados por el usuario o por el agente principal.
- Si recibes sessionId del agente principal, guardalo siempre en la columna Session.

Campos disponibles:
Fecha, Origen, Nombre, Email, Telefono, Empresa, Servicio, Necesidad, Estado, Score, Session.

Estados recomendados:
- nuevo
- datos_incompletos
- demo_solicitada
- cita_confirmada

Responde de forma breve al agente principal indicando si has creado o actualizado el contacto.`;

node('Webhook').parameters.path = 'chat_landing_agent';
node('Webhook').parameters.options = { allowedOrigins: '*' };

node('AI Agent').parameters.text =
  '={{ JSON.stringify({ message: $json.body.message, sessionId: $json.body.sessionId || $json.body.session_id || "", now: $now }) }}';
node('AI Agent').parameters.options.systemMessage = mainPrompt;
node('Agente CRM').parameters.options.systemMessage = crmPrompt;

for (const item of workflow.nodes) {
  if (item.credentials?.openAiApi && openAiCredentials) item.credentials = openAiCredentials;
  if (item.credentials?.googleSheetsOAuth2Api && sheetsCredentials) item.credentials = sheetsCredentials;
  if (item.credentials?.googleCalendarOAuth2Api && calendarCredentials) item.credentials = calendarCredentials;
  if (item.credentials?.supabaseApi && supabaseCredentials) item.credentials = supabaseCredentials;

  if (item.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi') {
    item.parameters.model = {
      __rl: true,
      mode: 'list',
      value: item.name === 'OpenAI Chat Model3' ? 'gpt-4.1-mini' : 'gpt-5-mini',
    };
  }

  if (item.type === 'n8n-nodes-base.googleCalendarTool') {
    item.parameters.calendar = calendarConfig;
    if (item.name === 'Crear evento') {
      item.parameters.additionalFields = {
        description: "={{ $fromAI('Description', `Nombre, email, telefono, empresa y servicio`, 'string') }}",
        sendUpdates: 'all',
        summary: "={{ $fromAI('Summary', `Demo ITERA - servicio - nombre`, 'string') }}",
      };
    }
  }
}

const leadColumns = {
  Fecha: "={{ $fromAI('Fecha', `Fecha actual o fecha de registro`, 'string') }}",
  Origen: "={{ $fromAI('Origen', `chat_agent`, 'string') }}",
  Nombre: "={{ $fromAI('Nombre', `Nombre completo del lead`, 'string') }}",
  Email: "={{ $fromAI('Email', `Email del lead`, 'string') }}",
  Telefono: "={{ $fromAI('Telefono', `Telefono del lead`, 'string') }}",
  Empresa: "={{ $fromAI('Empresa', `Empresa del lead`, 'string') }}",
  Servicio: "={{ $fromAI('Servicio', `Servicio o interes principal`, 'string') }}",
  Necesidad: "={{ $fromAI('Necesidad', `Resumen de necesidad, fecha/hora de cita o notas`, 'string') }}",
  Estado: "={{ $fromAI('Estado', `nuevo, datos_incompletos, demo_solicitada o cita_confirmada`, 'string') }}",
  Score: "={{ $fromAI('Score', `Numero de 0 a 100`, 'number') }}",
  Session: "={{ $fromAI('Session', `ID de sesion del chat`, 'string') }}",
};

const configureSheetTool = (item, operation = 'appendOrUpdate') => {
  if (!item) return;
  item.parameters.operation = operation;
  item.parameters.documentId = sheetDocumentId;
  item.parameters.sheetName = sheetName;
  item.parameters.columns = {
    mappingMode: 'defineBelow',
    value: leadColumns,
    matchingColumns: ['Session'],
    schema: sheetSchema,
    attemptToConvertTypes: false,
    convertFieldsToString: false,
  };
  item.parameters.options = item.parameters.options || {};
};

for (const name of ['Registro citas', 'Crear/ Actualizar contacto']) {
  configureSheetTool(node(name));
}

for (const name of ['Buscar citas', 'Consultar contactos']) {
  const item = node(name);
  if (!item) continue;
  item.parameters.documentId = sheetDocumentId;
  item.parameters.sheetName = sheetName;
  item.parameters.filtersUI = {
    values: [
      {
        lookupColumn: 'Email',
        lookupValue: "={{ $fromAI('Email', `Email del lead a buscar`, 'string') }}",
      },
    ],
  };
  item.parameters.options = item.parameters.options || {};
}

workflow.nodes.push(
  {
    parameters: {
      jsCode: `const raw = $json.output || '{}';
let data = {};
try {
  data = typeof raw === 'string' ? JSON.parse(raw) : raw;
} catch (error) {
  data = { reply: String(raw || ''), ready_to_book: false };
}

const lead = data.lead || {};
const start = data.start_iso ? new Date(data.start_iso) : null;
const hasStart = start && !Number.isNaN(start.getTime());
const end = data.end_iso ? new Date(data.end_iso) : (hasStart ? new Date(start.getTime() + 15 * 60 * 1000) : null);
const hasEnd = end && !Number.isNaN(end.getTime());
const missing = [
  !lead.nombre && 'nombre',
  !lead.email && 'email',
  !lead.telefono && 'telefono',
  !lead.empresa && 'empresa',
  !lead.servicio && 'servicio',
  !hasStart && 'fecha_hora'
].filter(Boolean);
const shouldCreateEvent = Boolean(data.wants_meeting && data.ready_to_book && missing.length === 0);

return [{
  json: {
    reply: data.reply || (shouldCreateEvent ? 'Perfecto, voy a reservar la cita.' : 'Perfecto, te leo.'),
    should_create_event: shouldCreateEvent,
    missing_fields: missing,
    session_id: data.session_id || '',
    lead,
    event_start_iso: hasStart ? start.toISOString() : '',
    event_end_iso: hasEnd ? end.toISOString() : '',
    summary: 'Demo ITERA - ' + (lead.servicio || 'Servicio') + ' - ' + (lead.nombre || 'Lead'),
    description: [
      'Lead desde la landing ITERA',
      'Nombre: ' + (lead.nombre || ''),
      'Email: ' + (lead.email || ''),
      'Telefono: ' + (lead.telefono || ''),
      'Empresa: ' + (lead.empresa || ''),
      'Servicio: ' + (lead.servicio || ''),
      'SessionID: ' + (data.session_id || '')
    ].join('\\n')
  }
}];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [560, 0],
    id: randomUUID(),
    name: 'Prepara cita directa',
  },
  {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
        },
        conditions: [
          {
            id: 'should-create-event',
            leftValue: '={{ $json.should_create_event }}',
            rightValue: true,
            operator: {
              type: 'boolean',
              operation: 'equals',
            },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [780, 0],
    id: randomUUID(),
    name: '¿Crear cita directa?',
  },
  {
    parameters: {
      operation: 'create',
      calendar: calendarConfig,
      start: '={{ $json.event_start_iso }}',
      end: '={{ $json.event_end_iso }}',
      additionalFields: {
        description: '={{ $json.description }}',
        sendUpdates: 'all',
        summary: '={{ $json.summary }}',
      },
    },
    type: 'n8n-nodes-base.googleCalendar',
    typeVersion: 1.3,
    position: [1000, -100],
    id: randomUUID(),
    name: 'Crear cita directa Calendar',
    credentials: calendarCredentials,
  },
  {
    parameters: {
      assignments: {
        assignments: [
          {
            id: 'reply-created',
            name: 'reply',
            value:
              '={{ "Cita confirmada. " + $("Prepara cita directa").item.json.lead.servicio + " el " + $("Prepara cita directa").item.json.event_start_iso + "." }}',
            type: 'string',
          },
        ],
      },
      options: {},
    },
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position: [1220, -100],
    id: randomUUID(),
    name: 'Respuesta cita creada',
  },
  {
    parameters: {
      assignments: {
        assignments: [
          {
            id: 'reply-no-event',
            name: 'reply',
            value: '={{ $json.reply }}',
            type: 'string',
          },
        ],
      },
      options: {},
    },
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position: [1000, 120],
    id: randomUUID(),
    name: 'Respuesta sin cita',
  },
);

workflow.nodes.push(
  {
    parameters: {
      httpMethod: 'POST',
      path: 'contact_landing',
      responseMode: 'responseNode',
      options: {
        allowedOrigins: '*',
      },
    },
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [0, 360],
    id: randomUUID(),
    name: 'Contact Webhook',
  },
  {
    parameters: {
      jsCode: `const body = $json.body || {};
const serviceMap = {
  chatbots: 'Chatbots e IA Conversacional',
  agents: 'Agentes Autonomos de Trabajo',
  workflow: 'Automatizacion de Flujos',
  consulting: 'Consultoria Estrategica de IA',
  other: 'Otro Proyecto a Medida'
};

const calculator = body.calculator || {};
const calculatorSummary = Object.keys(calculator).length
  ? '\\nCalculadora: ' + JSON.stringify(calculator)
  : '';

return [{
  json: {
    fecha: new Date().toISOString(),
    origen: 'formulario',
    session_id: body.sessionId || body.session_id || 'contact_' + Date.now(),
    nombre: body.name || body.nombre || '',
    email: body.email || '',
    telefono: body.phone || body.telefono || '',
    empresa: body.company || body.empresa || '',
    servicio_interes: serviceMap[body.service] || body.service || '',
    necesidad: (body.message || body.mensaje || '') + calculatorSummary,
    estado: 'nuevo',
    score: body.email ? 55 : 35,
    source: body.source || 'itera_landing',
    page: body.page || '',
    url: body.url || '',
    referrer: body.referrer || '',
    utm: body.utm || {},
    metadata: body
  }
}];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [220, 360],
    id: randomUUID(),
    name: 'Normaliza contacto',
  },
  {
    parameters: {
      assignments: {
        assignments: [
          { id: 'fecha-contact', name: 'Fecha', value: '={{ $json.fecha }}', type: 'string' },
          { id: 'origen-contact', name: 'Origen', value: '={{ $json.origen }}', type: 'string' },
          { id: 'nombre-contact', name: 'Nombre', value: '={{ $json.nombre }}', type: 'string' },
          { id: 'email-contact', name: 'Email', value: '={{ $json.email }}', type: 'string' },
          { id: 'telefono-contact', name: 'Telefono', value: '={{ $json.telefono }}', type: 'string' },
          { id: 'empresa-contact', name: 'Empresa', value: '={{ $json.empresa }}', type: 'string' },
          { id: 'servicio-contact', name: 'Servicio', value: '={{ $json.servicio_interes }}', type: 'string' },
          { id: 'necesidad-contact', name: 'Necesidad', value: '={{ $json.necesidad }}', type: 'string' },
          { id: 'estado-contact', name: 'Estado', value: '={{ $json.estado }}', type: 'string' },
          { id: 'score-contact', name: 'Score', value: '={{ $json.score }}', type: 'number' },
          { id: 'session-contact', name: 'Session', value: '={{ $json.session_id }}', type: 'string' },
        ],
      },
      options: {},
    },
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position: [440, 360],
    id: randomUUID(),
    name: 'Prepara fila Sheets contacto',
  },
  {
    parameters: {
      operation: 'append',
      documentId: sheetDocumentId,
      sheetName,
      columns: sheetNode.parameters.columns,
      options: {},
    },
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: 4.7,
    position: [660, 360],
    id: randomUUID(),
    name: 'Añade contacto a Sheets',
    credentials: sheetsCredentials,
  },
  {
    parameters: {
      respondWith: 'json',
      responseBody:
        '={{ ({ ok: true, message: "Solicitud recibida correctamente", sessionId: $("Normaliza contacto").item.json.session_id }).toJsonString() }}',
      options: {
        responseCode: 200,
      },
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.5,
    position: [880, 360],
    id: randomUUID(),
    name: 'Respond Contact',
  },
);

const respondNode = node('Respond to Webhook');
respondNode.position = [1440, 0];
respondNode.parameters.respondWith = 'text';
respondNode.parameters.responseBody = '={{ $json.reply }}';

workflow.connections['AI Agent'] = {
  main: [[{ node: 'Prepara cita directa', type: 'main', index: 0 }]],
};
workflow.connections['Prepara cita directa'] = {
  main: [[{ node: '¿Crear cita directa?', type: 'main', index: 0 }]],
};
workflow.connections['¿Crear cita directa?'] = {
  main: [
    [{ node: 'Crear cita directa Calendar', type: 'main', index: 0 }],
    [{ node: 'Respuesta sin cita', type: 'main', index: 0 }],
  ],
};
workflow.connections['Crear cita directa Calendar'] = {
  main: [[{ node: 'Respuesta cita creada', type: 'main', index: 0 }]],
};
workflow.connections['Respuesta cita creada'] = {
  main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]],
};
workflow.connections['Respuesta sin cita'] = {
  main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]],
};
workflow.connections['Contact Webhook'] = {
  main: [[{ node: 'Normaliza contacto', type: 'main', index: 0 }]],
};
workflow.connections['Normaliza contacto'] = {
  main: [[{ node: 'Prepara fila Sheets contacto', type: 'main', index: 0 }]],
};
workflow.connections['Prepara fila Sheets contacto'] = {
  main: [[{ node: 'Añade contacto a Sheets', type: 'main', index: 0 }]],
};
workflow.connections['Añade contacto a Sheets'] = {
  main: [[{ node: 'Respond Contact', type: 'main', index: 0 }]],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(outputPath);
