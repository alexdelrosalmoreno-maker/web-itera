const fs = require('fs');
const path = require('path');

const originalPath = 'C:\\Users\\Alex\\Downloads\\ITERA Landing - Chat, Leads, Supabase y Google Sheets.json';
const outputPath = path.join(process.cwd(), 'n8n-itera-full.workflow.json');
const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
const sourceNode = (name) => original.nodes.find((node) => node.name === name);

const supabaseCredentials =
  original.nodes.find((node) => node.credentials?.supabaseApi)?.credentials || {
    supabaseApi: {
      id: 'REPLACE_WITH_SUPABASE_CREDENTIAL_ID',
      name: 'Supabase account',
    },
  };

const openAiCredentials =
  original.nodes.find((node) => node.credentials?.openAiApi)?.credentials || {
    openAiApi: {
      id: 'REPLACE_WITH_OPENAI_CREDENTIAL_ID',
      name: 'OpenAI account',
    },
  };

const googleSheetsCredentials =
  original.nodes.find((node) => node.credentials?.googleSheetsOAuth2Api)?.credentials || {
    googleSheetsOAuth2Api: {
      id: 'REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID',
      name: 'Google Sheets account',
    },
  };

const googleCalendarCredentials =
  original.nodes.find((node) => node.credentials?.googleCalendarOAuth2Api)?.credentials || {
    googleCalendarOAuth2Api: {
      id: 'REPLACE_WITH_GOOGLE_CALENDAR_CREDENTIAL_ID',
      name: 'Google Calendar account',
    },
  };

const sheetDocumentId = sourceNode('Añade lead chat a Sheets')?.parameters?.documentId || {
  __rl: true,
  value: 'REPLACE_WITH_GOOGLE_SHEET_ID',
  mode: 'id',
};
const sheetName = sourceNode('Añade lead chat a Sheets')?.parameters?.sheetName || {
  __rl: true,
  value: 'Leads',
  mode: 'name',
};
const sheetColumns = sourceNode('Añade lead chat a Sheets')?.parameters?.columns || {
  mappingMode: 'autoMapInputData',
  value: {},
};
const calendarConfig = sourceNode('Busca eventos del día')?.parameters?.calendar || {
  __rl: true,
  value: 'primary',
  mode: 'id',
};

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({
  parameters,
  type,
  typeVersion,
  position,
  id: extra.id || crypto.randomUUID(),
  name,
  ...extra,
});

const supabaseCreate = (name, position, tableId, fields, extra = {}) =>
  node(
    name,
    'n8n-nodes-base.supabase',
    1,
    position,
    {
      tableId,
      fieldsUi: {
        fieldValues: Object.entries(fields).map(([fieldId, fieldValue]) => ({
          fieldId,
          fieldValue,
        })),
      },
    },
    {
      credentials: supabaseCredentials,
      ...extra,
    },
  );

const workflow = {
  name: 'ITERA Landing - Chat, Leads, Supabase y Google Sheets',
  nodes: [
    node('Chat Webhook', 'n8n-nodes-base.webhook', 2.1, [0, -420], {
      httpMethod: 'POST',
      path: 'chat_landing',
      responseMode: 'responseNode',
      options: {},
    }),
    node('Contact Webhook', 'n8n-nodes-base.webhook', 2.1, [0, 260], {
      httpMethod: 'POST',
      path: 'contact_landing',
      responseMode: 'responseNode',
      options: {},
    }),
    node('Normaliza chat', 'n8n-nodes-base.code', 2, [220, -420], {
      jsCode: `const body = $json.body || {};
const message = String(body.message || '').trim();
const providedSessionId = body.sessionId || body.session_id || 'anonymous_' + Date.now();
const startsNewLead = /\\b(soy otro cliente|nuevo cliente|otra persona|empezar de cero|nueva conversaci[oó]n)\\b/i.test(message);
const sessionId = startsNewLead
  ? providedSessionId + '_lead_' + Date.now()
  : providedSessionId;

return [{
  json: {
    session_id: sessionId,
    message,
    source: body.source || 'itera_landing',
    page: body.page || '',
    url: body.url || '',
    referrer: body.referrer || '',
    utm: body.utm || {},
    raw: body
  }
}];`,
    }),
    node('Normaliza contacto', 'n8n-nodes-base.code', 2, [220, 260], {
      jsCode: `const body = $json.body || {};
const serviceMap = {
  chatbots: 'Chatbots e IA Conversacional',
  agents: 'Agentes Autónomos de Trabajo',
  workflow: 'Automatización de Flujos',
  consulting: 'Consultoría Estratégica de IA',
  other: 'Otro Proyecto a Medida'
};
return [{
  json: {
    session_id: body.sessionId || body.session_id || 'contact_' + Date.now(),
    nombre: body.name || body.nombre || '',
    email: body.email || '',
    telefono: body.phone || body.telefono || '',
    empresa: body.company || body.empresa || '',
    servicio_interes: serviceMap[body.service] || body.service || '',
    mensaje: body.message || body.mensaje || '',
    estado_lead: 'nuevo',
    lead_score: body.email ? 55 : 35,
    source: body.source || 'itera_landing',
    page: body.page || '',
    url: body.url || '',
    referrer: body.referrer || '',
    utm: body.utm || {},
    calculator: body.calculator || {},
    metadata: body
  }
}];`,
    }),
    supabaseCreate('Guarda mensaje usuario', [440, -420], 'conversaciones', {
      session_id: '={{ $json.session_id }}',
      role: 'user',
      mensaje: '={{ $json.message }}',
      metadata: '={{ $json.raw }}',
    }),
    node(
      'Busca conversaciones',
      'n8n-nodes-base.supabase',
      1,
      [660, -420],
      {
        operation: 'getAll',
        tableId: 'conversaciones',
        filterType: 'none',
        options: {},
      },
      {
        alwaysOutputData: true,
        credentials: supabaseCredentials,
      },
    ),
    node(
      'Busca leads sesión',
      'n8n-nodes-base.supabase',
      1,
      [880, -420],
      {
        operation: 'getAll',
        tableId: 'leads',
        filterType: 'none',
        options: {},
      },
      {
        alwaysOutputData: true,
        credentials: supabaseCredentials,
      },
    ),
    node('Construye contexto', 'n8n-nodes-base.code', 2, [1100, -420], {
      jsCode: `const sessionId = $('Normaliza chat').first().json.session_id;
const conversationRows = $('Busca conversaciones').all()
  .map(item => item.json)
  .filter(row => row.session_id === sessionId)
  .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
  .slice(-10);
const leadRows = $input.all()
  .map(item => item.json)
  .filter(row => row.session_id === sessionId)
  .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
const latestLead = leadRows[0] || {};

return [{
  json: {
    session_id: sessionId,
    message: $('Normaliza chat').first().json.message,
    lead_state: {
      nombre: latestLead.nombre || '',
      email: latestLead.email || '',
      telefono: latestLead.telefono || '',
      empresa: latestLead.empresa || '',
      cargo: latestLead.cargo || '',
      necesidad: latestLead.necesidad || '',
      servicio_interes: latestLead.servicio_interes || '',
      presupuesto: latestLead.presupuesto || '',
      urgencia: latestLead.urgencia || '',
      tamano_empresa: latestLead.tamano_empresa || '',
      estado_lead: latestLead.estado_lead || '',
      lead_score: latestLead.lead_score || 0,
      resumen: latestLead.resumen || ''
    },
    history: conversationRows.map(row => ({
      role: row.role,
      content: row.mensaje
    }))
  }
}];`,
    }),
    node(
      'Interpreta lead del chat',
      '@n8n/n8n-nodes-langchain.openAi',
      2.3,
      [1100, -540],
      {
        modelId: {
          __rl: true,
          value: 'gpt-4o-mini',
          mode: 'list',
          cachedResultName: 'GPT-4O-MINI',
        },
        responses: {
          values: [
            {
              role: 'system',
              content:
                'Extrae, acumula y clasifica información comercial de toda la conversación. Devuelve SOLO JSON válido con campos: nombre, email, telefono, empresa, cargo, necesidad, servicio_interes, presupuesto, urgencia, tamano_empresa, estado_lead, lead_score, resumen. Si un dato no aparece, usa cadena vacía. lead_score debe ser 0-100. estado_lead: nuevo, frio, templado, caliente, demo_solicitada. No inventes citas ni datos no proporcionados.',
            },
            {
              content: '={{ JSON.stringify($("Construye contexto").item.json) }}',
            },
          ],
        },
        builtInTools: {},
        options: {
          textFormat: {
            textOptions: {
              type: 'json_object',
            },
          },
        },
      },
      {
        credentials: openAiCredentials,
      },
    ),
    node('Prepara lead chat', 'n8n-nodes-base.code', 2, [1320, -540], {
      jsCode: `const raw = $json.output?.[0]?.content?.[0]?.text || '{}';
let extracted = {};
try {
  extracted = JSON.parse(raw);
} catch (error) {}

const context = $('Construye contexto').first().json;
const current = $('Normaliza chat').first().json;
const state = context.lead_state || {};
const currentText = current.message || '';
const historyText = [
  ...(context.history || []).map(item => item.content || ''),
  currentText
].join('\\n');

const findEmail = text => text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i)?.[0] || '';
const findPhone = text => text.match(/(?:\\+?\\d[\\d\\s().-]{7,}\\d)/)?.[0]?.trim() || '';
const findCompany = text => {
  const explicit = text.match(/(?:mi empresa es|empresa es|somos|trabajo en|empresa:)\\s*([^\\n.,;]+)/i)?.[1]?.trim();
  if (explicit) return explicit;
  return /\\b[A-ZÃÃ‰ÃÃ“ÃšÃ‘a-zÃ¡Ã©Ã­Ã³ÃºÃ±0-9 .-]+\\s+s\\.?\\s*[al]\\.?\\b/i.exec(text)?.[0]?.trim() || '';
};
const findName = text => text.match(/(?:soy|me llamo|mi nombre es)\\s+([^\\n.,;]+)/i)?.[1]?.trim() || '';
const findKnownName = text => text.match(/[¡!]?Hola,?\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\\b/)?.[1]?.trim() || '';
const findStandaloneName = text => {
  const clean = text.trim();
  if (!/^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\\s+(?:de|del|la|las|los|y|[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+)){1,5}$/i.test(clean)) return '';
  if (/@|\\d|cita|demo|agendar|mañana|tarde|hora|empresa|email|tel[eé]fono/i.test(clean)) return '';
  return clean;
};

const findService = text => {
  if (/chatbot|chat bot|asistente|ia conversacional/i.test(text)) return 'Chatbots e IA Conversacional';
  if (/automatiz|workflow|flujo|n8n|make/i.test(text)) return 'AutomatizaciÃ³n de Flujos';
  if (/crm|gesti[oÃ³]n de leads|captaci[oÃ³]n de leads/i.test(text)) return 'CRM y gestiÃ³n de leads';
  return '';
};
const currentEmail = findEmail(currentText);
const currentPhone = findPhone(currentText);
const currentCompany = findCompany(currentText);
const currentName = findName(currentText) || findStandaloneName(currentText);
const currentService = findService(currentText);

const email = currentEmail || extracted.email || state.email || findEmail(historyText);
const telefono = currentPhone || extracted.telefono || state.telefono || findPhone(historyText);
const empresa = currentCompany || extracted.empresa || state.empresa || findCompany(historyText);
const nombre = currentName || extracted.nombre || state.nombre || findName(historyText) || findKnownName(historyText);
const inferredService = currentService || extracted.servicio_interes || state.servicio_interes || findService(historyText);
const necesidad = extracted.necesidad || state.necesidad || currentText;
const newDataFields = [
  currentEmail && 'email',
  currentPhone && 'telefono',
  currentCompany && 'empresa',
  currentName && 'nombre',
  currentService && 'servicio_interes'
].filter(Boolean);
const hasNewLeadData = newDataFields.length > 0;
const hasStrongData = Boolean(email || telefono || empresa || nombre);
const scoreBase = Number(extracted.lead_score || 0);
const leadScore = Math.max(Number(state.lead_score || 0), scoreBase, (email ? 30 : 0) + (telefono ? 25 : 0) + (empresa ? 20 : 0) + (inferredService ? 15 : 0) + 10);

return [{
  json: {
    session_id: current.session_id,
    nombre,
    email,
    telefono,
    empresa,
    cargo: extracted.cargo || state.cargo || '',
    necesidad,
    servicio_interes: inferredService,
    presupuesto: extracted.presupuesto || state.presupuesto || '',
    urgencia: extracted.urgencia || state.urgencia || '',
    tamano_empresa: extracted.tamano_empresa || state.tamano_empresa || '',
    estado_lead: extracted.estado_lead || state.estado_lead || (hasStrongData ? 'caliente' : 'templado'),
    lead_score: Math.min(100, leadScore),
    has_new_lead_data: hasNewLeadData,
    new_data_fields: newDataFields,
    resumen: extracted.resumen || necesidad,
    source: current.source,
    page: current.page,
    url: current.url,
    referrer: current.referrer,
    utm: current.utm,
    metadata: {
      ...current.raw,
      extraction: extracted,
      history: context.history || []
    }
  }
}];`,
    }),
    node('Hay datos nuevos de lead?', 'n8n-nodes-base.if', 2.2, [1540, -540], {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
        },
        conditions: [
          {
            id: 'has-new-lead-data',
            leftValue: '={{ $json.has_new_lead_data }}',
            rightValue: true,
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true,
            },
          },
        ],
        combinator: 'and',
      },
      options: {},
    }),
    supabaseCreate('Guarda lead chat', [1760, -640], 'leads', {
      session_id: '={{ $json.session_id }}',
      nombre: '={{ $json.nombre }}',
      email: '={{ $json.email }}',
      telefono: '={{ $json.telefono }}',
      empresa: '={{ $json.empresa }}',
      cargo: '={{ $json.cargo }}',
      necesidad: '={{ $json.necesidad }}',
      servicio_interes: '={{ $json.servicio_interes }}',
      presupuesto: '={{ $json.presupuesto }}',
      urgencia: '={{ $json.urgencia }}',
      tamano_empresa: '={{ $json.tamano_empresa }}',
      estado_lead: '={{ $json.estado_lead }}',
      lead_score: '={{ $json.lead_score }}',
      resumen: '={{ $json.resumen }}',
      source: '={{ $json.source }}',
      page: '={{ $json.page }}',
      url: '={{ $json.url }}',
      referrer: '={{ $json.referrer }}',
      utm: '={{ $json.utm }}',
      metadata: '={{ $json.metadata }}',
    }),
    node('Prepara fila Sheets chat', 'n8n-nodes-base.set', 3.4, [1980, -640], {
      assignments: {
        assignments: [
          { id: 'fecha-chat', name: 'Fecha', value: '={{ $now }}', type: 'string' },
          { id: 'origen-chat', name: 'Origen', value: 'chat', type: 'string' },
          { id: 'nombre-chat', name: 'Nombre', value: '={{ $("Prepara lead chat").item.json.nombre }}', type: 'string' },
          { id: 'email-chat', name: 'Email', value: '={{ $("Prepara lead chat").item.json.email }}', type: 'string' },
          { id: 'telefono-chat', name: 'Telefono', value: '={{ $("Prepara lead chat").item.json.telefono }}', type: 'string' },
          { id: 'empresa-chat', name: 'Empresa', value: '={{ $("Prepara lead chat").item.json.empresa }}', type: 'string' },
          { id: 'servicio-chat', name: 'Servicio', value: '={{ $("Prepara lead chat").item.json.servicio_interes }}', type: 'string' },
          { id: 'necesidad-chat', name: 'Necesidad', value: '={{ $("Prepara lead chat").item.json.necesidad }}', type: 'string' },
          { id: 'estado-chat', name: 'Estado', value: '={{ $("Prepara lead chat").item.json.estado_lead }}', type: 'string' },
          { id: 'score-chat', name: 'Score', value: '={{ $("Prepara lead chat").item.json.lead_score }}', type: 'number' },
          { id: 'session-chat', name: 'Session', value: '={{ $("Prepara lead chat").item.json.session_id }}', type: 'string' },
        ],
      },
      options: {},
    }),
    node(
      'Añade lead chat a Sheets',
      'n8n-nodes-base.googleSheets',
      4.7,
      [2200, -640],
      {
        operation: 'append',
        documentId: sheetDocumentId,
        sheetName,
        columns: sheetColumns,
        options: {},
      },
      {
        credentials: googleSheetsCredentials,
      },
    ),
    node(
      'Interpreta solicitud de cita',
      '@n8n/n8n-nodes-langchain.openAi',
      2.3,
      [2420, -540],
      {
        modelId: {
          __rl: true,
          value: 'gpt-4o-mini',
          mode: 'list',
          cachedResultName: 'GPT-4O-MINI',
        },
        responses: {
          values: [
            {
              role: 'system',
              content:
                'Detecta si el usuario quiere agendar una llamada/cita/demo o si ya hay una solicitud de cita pendiente en el historial. Devuelve SOLO JSON válido: {"wants_meeting": boolean, "requested_start_iso": "", "requested_date": "", "requested_time": "", "timezone": "Europe/Madrid", "missing": [], "notes": ""}. Si en el historial ya hay una cita pendiente y el mensaje actual solo aporta un dato faltante, mantiene wants_meeting=true y conserva la fecha/hora ya indicada anteriormente. Si el usuario confirma una hora propuesta antes en el historial, usa esa fecha/hora como requested_start_iso. Si el usuario dice "mañana", interpreta mañana respecto a now en Europe/Madrid. Si no hay fecha u hora claras, wants_meeting puede ser true pero requested_start_iso debe ir vacío y missing debe incluir fecha_hora. La cita siempre dura 15 minutos.',
            },
            {
              content:
                '={{ JSON.stringify({ now: $now, contexto: $("Construye contexto").item.json, lead: $("Prepara lead chat").item.json }) }}',
            },
          ],
        },
        builtInTools: {},
        options: {
          textFormat: {
            textOptions: {
              type: 'json_object',
            },
          },
        },
      },
      {
        credentials: openAiCredentials,
      },
    ),
    node('Prepara consulta Calendar', 'n8n-nodes-base.code', 2, [2640, -540], {
      jsCode: `const raw = $json.output?.[0]?.content?.[0]?.text || '{}';
let data = {};
try {
  data = JSON.parse(raw);
} catch (error) {}

const timezone = data.timezone || 'Europe/Madrid';
const lead = $('Prepara lead chat').first().json;
const context = $('Construye contexto').first().json;
const historyText = [
  ...(context.history || []).map(item => item.content || ''),
  context.message || ''
].join('\\n');

const resolveRequestedStart = () => {
  if (data.requested_start_iso) {
    const direct = new Date(data.requested_start_iso);
    if (!Number.isNaN(direct.getTime())) return direct;
  }

  const explicit = historyText.match(/(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4}).{0,24}?(?:a\\s+las\\s+)?(\\d{1,2})(?::(\\d{2}))?/i);
  if (explicit) {
    const [, day, month, year, hour, minute = '00'] = explicit;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  }

  const tomorrow = historyText.match(/ma[ñn]ana.{0,40}?(?:a\\s+las\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(de\\s+la\\s+tarde|pm)?/i);
  if (tomorrow) {
    const now = new Date();
    let hour = Number(tomorrow[1]);
    const minute = Number(tomorrow[2] || 0);
    if ((tomorrow[3] || '').toLowerCase().includes('tarde') && hour < 12) hour += 12;
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(hour, minute, 0, 0);
    return start;
  }

  return null;
};

const requestedStart = resolveRequestedStart();
const hasValidStart = requestedStart && !Number.isNaN(requestedStart.getTime());
const leadMissingFields = [
  !lead.nombre && 'nombre',
  !lead.email && 'email',
  !lead.telefono && 'telefono',
  !lead.empresa && 'empresa',
  !lead.servicio_interes && 'servicio_interes'
].filter(Boolean);
const meetingMissingFields = [
  ...leadMissingFields,
  !hasValidStart && 'fecha_hora'
];

let dayStart;
if (hasValidStart) {
  dayStart = new Date(requestedStart);
} else {
  dayStart = new Date();
}
dayStart.setHours(0, 0, 0, 0);

const dayEnd = new Date(dayStart);
dayEnd.setHours(23, 59, 59, 999);

return [{
  json: {
    wants_meeting: Boolean(data.wants_meeting),
    requested_start_iso: hasValidStart ? requestedStart.toISOString() : '',
    requested_end_iso: hasValidStart ? new Date(requestedStart.getTime() + 15 * 60 * 1000).toISOString() : '',
    day_start_iso: dayStart.toISOString(),
    day_end_iso: dayEnd.toISOString(),
    timezone,
    missing: Array.from(new Set([...(data.missing || []), ...meetingMissingFields])),
    lead_missing_fields: leadMissingFields,
    meeting_missing_fields: meetingMissingFields,
    ready_to_book: Boolean(data.wants_meeting) && meetingMissingFields.length === 0,
    notes: data.notes || '',
    lead
  }
}];`,
    }),
    node('¿Quiere cita?', 'n8n-nodes-base.if', 2.2, [2640, -540], {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
        },
        conditions: [
          {
            id: 'ready-to-book',
            leftValue: '={{ $json.ready_to_book }}',
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
    }),
    node(
      'Busca eventos del día',
      'n8n-nodes-base.googleCalendar',
      1.3,
      [2860, -660],
      {
        operation: 'getAll',
        calendar: calendarConfig,
        returnAll: true,
        timeMin: '={{ $json.day_start_iso }}',
        timeMax: '={{ $json.day_end_iso }}',
        options: {},
      },
      {
        alwaysOutputData: true,
        credentials: googleCalendarCredentials,
      },
    ),
    node('Decide hueco Calendar', 'n8n-nodes-base.code', 2, [3080, -660], {
      jsCode: `const request = $('Prepara consulta Calendar').first().json;
const events = $input.all().map(item => item.json);
const durationMs = 15 * 60 * 1000;
const requestedStart = request.requested_start_iso ? new Date(request.requested_start_iso) : null;

const busy = events
  .map(event => ({
    start: new Date(event.start?.dateTime || event.start?.date || event.startTime || event.start),
    end: new Date(event.end?.dateTime || event.end?.date || event.endTime || event.end)
  }))
  .filter(slot => !Number.isNaN(slot.start.getTime()) && !Number.isNaN(slot.end.getTime()));

const overlaps = (start, end) => busy.some(slot => start < slot.end && end > slot.start);
const businessStart = new Date(request.day_start_iso);
businessStart.setHours(9, 0, 0, 0);
const businessEnd = new Date(request.day_start_iso);
businessEnd.setHours(18, 0, 0, 0);

const findSlot = () => {
  for (let t = new Date(businessStart); t.getTime() + durationMs <= businessEnd.getTime(); t = new Date(t.getTime() + durationMs)) {
    const end = new Date(t.getTime() + durationMs);
    if (!overlaps(t, end)) return { start: t, end };
  }
  return null;
};

if ((request.meeting_missing_fields || []).length > 0) {
  const alternative = findSlot();
  return [{
    json: {
      ...request,
      calendar_status: 'missing_required_data',
      should_create_event: false,
      proposed_start_iso: alternative?.start.toISOString() || '',
      proposed_end_iso: alternative?.end.toISOString() || '',
      message: 'Faltan datos obligatorios para agendar. Pide todos los datos faltantes en una sola respuesta.'
    }
  }];
}

if (!request.requested_start_iso || !requestedStart || Number.isNaN(requestedStart.getTime())) {
  const alternative = findSlot();
  return [{
    json: {
      ...request,
      calendar_status: 'missing_datetime',
      should_create_event: false,
      proposed_start_iso: alternative?.start.toISOString() || '',
      proposed_end_iso: alternative?.end.toISOString() || '',
      message: alternative
        ? 'El usuario quiere cita pero falta una fecha/hora clara. Ofrece este hueco disponible.'
        : 'El usuario quiere cita pero falta una fecha/hora clara y no hay huecos disponibles hoy.'
    }
  }];
}

const requestedEnd = new Date(requestedStart.getTime() + durationMs);
if (!overlaps(requestedStart, requestedEnd)) {
  return [{
    json: {
      ...request,
      calendar_status: 'available',
      should_create_event: true,
      event_start_iso: requestedStart.toISOString(),
      event_end_iso: requestedEnd.toISOString(),
      proposed_start_iso: '',
      proposed_end_iso: '',
      message: 'El hueco solicitado está disponible. Crea la cita.'
    }
  }];
}

const alternative = findSlot();
return [{
  json: {
    ...request,
    calendar_status: 'busy',
    should_create_event: false,
    proposed_start_iso: alternative?.start.toISOString() || '',
    proposed_end_iso: alternative?.end.toISOString() || '',
    message: alternative
      ? 'El hueco solicitado está ocupado. Propón la alternativa disponible.'
      : 'El hueco solicitado está ocupado y no hay más huecos libres ese día.'
  }
}];`,
    }),
    node('¿Crear evento?', 'n8n-nodes-base.if', 2.2, [3300, -660], {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
        },
        conditions: [
          {
            id: 'create-event',
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
    }),
    node(
      'Crea cita Calendar',
      'n8n-nodes-base.googleCalendar',
      1.3,
      [3520, -760],
      {
        operation: 'create',
        calendar: calendarConfig,
        start: '={{ $json.event_start_iso }}',
        end: '={{ $json.event_end_iso }}',
        additionalFields: {
          summary: '={{ "Llamada ITERA - " + ($json.lead.nombre || $json.lead.empresa || "Lead web") }}',
          description:
            '={{ "Lead desde la landing ITERA\\nNombre: " + ($json.lead.nombre || "") + "\\nEmail: " + ($json.lead.email || "") + "\\nTeléfono: " + ($json.lead.telefono || "") + "\\nEmpresa: " + ($json.lead.empresa || "") + "\\nNecesidad: " + ($json.lead.necesidad || "") }}',
          attendees: '={{ $json.lead.email ? [{ email: $json.lead.email }] : [] }}',
          sendUpdates: 'all',
          useDefaultReminders: false,
          remindersUi: {
            remindersValues: [
              {
                method: 'email',
                minutes: 2880,
              },
              {
                method: 'popup',
                minutes: 2880,
              },
            ],
          },
        },
      },
      {
        credentials: googleCalendarCredentials,
      },
    ),
    node('Contexto agenda', 'n8n-nodes-base.code', 2, [3740, -540], {
      jsCode: `let calendarContext = $json || {};

try {
  const decision = $('Decide hueco Calendar').first().json;
  if (decision?.calendar_status) {
    calendarContext = {
      ...decision,
      created_event: $json?.id || $json?.htmlLink
        ? {
            id: $json.id || '',
            htmlLink: $json.htmlLink || '',
            summary: $json.summary || '',
            start: $json.start || {},
            end: $json.end || {}
          }
        : null
    };
  }
} catch (error) {
  // The meeting branch did not run.
}

if (!calendarContext.calendar_status) {
  if (calendarContext.wants_meeting) {
    calendarContext = {
      ...calendarContext,
      calendar_status: 'missing_required_data',
      should_create_event: false,
      message: 'Faltan datos obligatorios para agendar. Pide todos los datos faltantes en una sola respuesta.'
    };
  } else {
    calendarContext = {
      calendar_status: 'not_requested',
      should_create_event: false,
      meeting_missing_fields: [],
      message: 'El usuario no ha pedido cita en este mensaje.'
    };
  }
}

return [{ json: { calendar_context: calendarContext } }];`,
    }),
    node(
      'Agente comercial ITERA',
      '@n8n/n8n-nodes-langchain.openAi',
      2.3,
      [3960, -540],
      {
        modelId: {
          __rl: true,
          value: 'gpt-4o-mini',
          mode: 'list',
          cachedResultName: 'GPT-4O-MINI',
        },
        responses: {
          values: [
            {
              role: 'system',
              content:
                '={{ "Eres el asistente comercial oficial de ITERA. Responde en español, breve, claro y cercano. Tu objetivo es convertir solicitudes de cita en reuniones reales. Para agendar necesitas estos datos obligatorios: nombre, email, teléfono, empresa, servicio/interés y fecha+hora. Si el usuario quiere cita y calendar_context.meeting_missing_fields tiene valores, pide TODOS esos datos faltantes en una sola respuesta, con una frase natural y sin pedir datos que ya existan en lead. Si lead.nombre, lead.email, lead.telefono, lead.empresa o lead.servicio_interes ya existen, no los vuelvas a pedir: úsalos como datos confirmados salvo que el usuario los corrija. Si ya has saludado al usuario por su nombre en el historial, no vuelvas a pedir el nombre. No inventes citas ni horarios. Solo puedes decir que una cita está agendada si calendar_context.created_event existe con id o htmlLink. Si calendar_context.calendar_status es available pero created_event está vacío, di que el hueco está libre pero que no has podido crear todavía el evento y pide revisar Calendar. Si calendar_context.calendar_status es busy, ofrece proposed_start_iso como alternativa si existe. Usa este contexto sin inventar datos: " + JSON.stringify({ contexto: $("Construye contexto").item.json, lead: $("Prepara lead chat").item.json, calendar_context: $("Contexto agenda").item.json.calendar_context }) }}',
            },
            {
              content: '={{ $("Normaliza chat").item.json.message }}',
            },
          ],
        },
        builtInTools: {},
        options: {},
      },
      {
        credentials: openAiCredentials,
      },
    ),
    supabaseCreate('Guarda respuesta asistente', [1320, -260], 'conversaciones', {
      session_id: '={{ $("Normaliza chat").item.json.session_id }}',
      role: 'assistant',
      mensaje: '={{ $json.output[0].content[0].text }}',
      metadata: '={{ $json }}',
    }),
    node('Prepara respuesta chat', 'n8n-nodes-base.set', 3.4, [1540, -260], {
      assignments: {
        assignments: [
          {
            id: 'reply',
            name: 'reply',
            value: '={{ $("Agente comercial ITERA").item.json.output[0].content[0].text }}',
            type: 'string',
          },
          {
            id: 'session_id',
            name: 'sessionId',
            value: '={{ $("Normaliza chat").item.json.session_id }}',
            type: 'string',
          },
        ],
      },
      options: {},
    }),
    node('Respond Chat', 'n8n-nodes-base.respondToWebhook', 1.5, [1760, -260], {
      respondWith: 'json',
      responseBody: '={{ $json.toJsonString() }}',
      options: {
        responseCode: 200,
      },
    }),
    supabaseCreate('Guarda lead contacto', [440, 260], 'leads', {
      session_id: '={{ $json.session_id }}',
      nombre: '={{ $json.nombre }}',
      email: '={{ $json.email }}',
      telefono: '={{ $json.telefono }}',
      empresa: '={{ $json.empresa }}',
      necesidad: '={{ $json.mensaje }}',
      servicio_interes: '={{ $json.servicio_interes }}',
      estado_lead: '={{ $json.estado_lead }}',
      lead_score: '={{ $json.lead_score }}',
      source: '={{ $json.source }}',
      page: '={{ $json.page }}',
      url: '={{ $json.url }}',
      referrer: '={{ $json.referrer }}',
      utm: '={{ $json.utm }}',
      calculator: '={{ $json.calculator }}',
      metadata: '={{ $json.metadata }}',
    }),
    node('Prepara fila Sheets contacto', 'n8n-nodes-base.set', 3.4, [660, 160], {
      assignments: {
        assignments: [
          { id: 'fecha-contacto', name: 'Fecha', value: '={{ $now }}', type: 'string' },
          { id: 'origen-contacto', name: 'Origen', value: 'formulario', type: 'string' },
          { id: 'nombre-contacto', name: 'Nombre', value: '={{ $("Normaliza contacto").item.json.nombre }}', type: 'string' },
          { id: 'email-contacto', name: 'Email', value: '={{ $("Normaliza contacto").item.json.email }}', type: 'string' },
          { id: 'telefono-contacto', name: 'Telefono', value: '={{ $("Normaliza contacto").item.json.telefono }}', type: 'string' },
          { id: 'empresa-contacto', name: 'Empresa', value: '={{ $("Normaliza contacto").item.json.empresa }}', type: 'string' },
          { id: 'servicio-contacto', name: 'Servicio', value: '={{ $("Normaliza contacto").item.json.servicio_interes }}', type: 'string' },
          { id: 'necesidad-contacto', name: 'Necesidad', value: '={{ $("Normaliza contacto").item.json.mensaje }}', type: 'string' },
          { id: 'estado-contacto', name: 'Estado', value: '={{ $("Normaliza contacto").item.json.estado_lead }}', type: 'string' },
          { id: 'score-contacto', name: 'Score', value: '={{ $("Normaliza contacto").item.json.lead_score }}', type: 'number' },
          { id: 'session-contacto', name: 'Session', value: '={{ $("Normaliza contacto").item.json.session_id }}', type: 'string' },
        ],
      },
      options: {},
    }),
    node(
      'Añade contacto a Sheets',
      'n8n-nodes-base.googleSheets',
      4.7,
      [880, 160],
      {
        operation: 'append',
        documentId: sheetDocumentId,
        sheetName,
        columns: sheetColumns,
        options: {},
      },
      {
        credentials: googleSheetsCredentials,
      },
    ),
    node('Respond Contact', 'n8n-nodes-base.respondToWebhook', 1.5, [660, 360], {
      respondWith: 'json',
      responseBody:
        '={{ ({ ok: true, message: "Solicitud recibida correctamente", sessionId: $("Normaliza contacto").item.json.session_id }).toJsonString() }}',
      options: {
        responseCode: 200,
      },
    }),
  ],
  pinData: {},
  connections: {
    'Chat Webhook': {
      main: [[{ node: 'Normaliza chat', type: 'main', index: 0 }]],
    },
    'Normaliza chat': {
      main: [[{ node: 'Guarda mensaje usuario', type: 'main', index: 0 }]],
    },
    'Guarda mensaje usuario': {
      main: [[{ node: 'Busca conversaciones', type: 'main', index: 0 }]],
    },
    'Busca conversaciones': {
      main: [[{ node: 'Busca leads sesión', type: 'main', index: 0 }]],
    },
    'Busca leads sesión': {
      main: [[{ node: 'Construye contexto', type: 'main', index: 0 }]],
    },
    'Construye contexto': {
      main: [[{ node: 'Interpreta lead del chat', type: 'main', index: 0 }]],
    },
    'Interpreta lead del chat': {
      main: [[{ node: 'Prepara lead chat', type: 'main', index: 0 }]],
    },
    'Prepara lead chat': {
      main: [[{ node: 'Hay datos nuevos de lead?', type: 'main', index: 0 }]],
    },
    'Hay datos nuevos de lead?': {
      main: [
        [{ node: 'Guarda lead chat', type: 'main', index: 0 }],
        [{ node: 'Interpreta solicitud de cita', type: 'main', index: 0 }],
      ],
    },
    'Guarda lead chat': {
      main: [[{ node: 'Prepara fila Sheets chat', type: 'main', index: 0 }]],
    },
    'Prepara fila Sheets chat': {
      main: [[{ node: 'Añade lead chat a Sheets', type: 'main', index: 0 }]],
    },
    'Añade lead chat a Sheets': {
      main: [[{ node: 'Interpreta solicitud de cita', type: 'main', index: 0 }]],
    },
    'Interpreta solicitud de cita': {
      main: [[{ node: 'Prepara consulta Calendar', type: 'main', index: 0 }]],
    },
    'Prepara consulta Calendar': {
      main: [[{ node: '¿Quiere cita?', type: 'main', index: 0 }]],
    },
    '¿Quiere cita?': {
      main: [
        [{ node: 'Busca eventos del día', type: 'main', index: 0 }],
        [{ node: 'Contexto agenda', type: 'main', index: 0 }],
      ],
    },
    'Busca eventos del día': {
      main: [[{ node: 'Decide hueco Calendar', type: 'main', index: 0 }]],
    },
    'Decide hueco Calendar': {
      main: [[{ node: '¿Crear evento?', type: 'main', index: 0 }]],
    },
    '¿Crear evento?': {
      main: [
        [{ node: 'Crea cita Calendar', type: 'main', index: 0 }],
        [{ node: 'Contexto agenda', type: 'main', index: 0 }],
      ],
    },
    'Crea cita Calendar': {
      main: [[{ node: 'Contexto agenda', type: 'main', index: 0 }]],
    },
    'Contexto agenda': {
      main: [[{ node: 'Agente comercial ITERA', type: 'main', index: 0 }]],
    },
    'Agente comercial ITERA': {
      main: [[{ node: 'Guarda respuesta asistente', type: 'main', index: 0 }]],
    },
    'Guarda respuesta asistente': {
      main: [[{ node: 'Prepara respuesta chat', type: 'main', index: 0 }]],
    },
    'Prepara respuesta chat': {
      main: [[{ node: 'Respond Chat', type: 'main', index: 0 }]],
    },
    'Contact Webhook': {
      main: [[{ node: 'Normaliza contacto', type: 'main', index: 0 }]],
    },
    'Normaliza contacto': {
      main: [[{ node: 'Guarda lead contacto', type: 'main', index: 0 }]],
    },
    'Guarda lead contacto': {
      main: [[{ node: 'Prepara fila Sheets contacto', type: 'main', index: 0 }]],
    },
    'Prepara fila Sheets contacto': {
      main: [[{ node: 'Añade contacto a Sheets', type: 'main', index: 0 }]],
    },
    'Añade contacto a Sheets': {
      main: [[{ node: 'Respond Contact', type: 'main', index: 0 }]],
    },
  },
  active: original.active ?? false,
  settings: original.settings || {
    executionOrder: 'v1',
    binaryMode: 'separate',
    timeSavedMode: 'fixed',
    callerPolicy: 'workflowsFromSameOwner',
    availableInMCP: true,
    saveExecutionProgress: false,
  },
  versionId: original.versionId,
  meta: original.meta,
  id: original.id,
  tags: original.tags || [],
};

for (const generatedNode of workflow.nodes) {
  const exportedNode = sourceNode(generatedNode.name);
  if (!exportedNode) continue;

  generatedNode.id = exportedNode.id || generatedNode.id;
  if (exportedNode.webhookId) generatedNode.webhookId = exportedNode.webhookId;
  if (exportedNode.credentials) generatedNode.credentials = exportedNode.credentials;

  if (generatedNode.type === '@n8n/n8n-nodes-langchain.openAi' && exportedNode.parameters?.modelId) {
    generatedNode.parameters.modelId = exportedNode.parameters.modelId;
  }

  if (generatedNode.type === 'n8n-nodes-base.googleSheets') {
    generatedNode.parameters.documentId = exportedNode.parameters?.documentId || generatedNode.parameters.documentId;
    generatedNode.parameters.sheetName = exportedNode.parameters?.sheetName || generatedNode.parameters.sheetName;
    generatedNode.parameters.columns = exportedNode.parameters?.columns || generatedNode.parameters.columns;
    generatedNode.parameters.options = exportedNode.parameters?.options || generatedNode.parameters.options;
  }

  if (generatedNode.type === 'n8n-nodes-base.googleCalendar') {
    generatedNode.parameters.calendar = exportedNode.parameters?.calendar || generatedNode.parameters.calendar;
  }
}

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(outputPath);
