// Inicializar Lucide Icons
lucide.createIcons();

// --- Theme Management ---
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const currentTheme = localStorage.getItem('theme') || 'dark';

if (currentTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeIcon.setAttribute('data-lucide', 'sun');
    lucide.createIcons(); // Re-render for the toggle button
}

themeToggle.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
        themeIcon.setAttribute('data-lucide', 'moon');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        themeIcon.setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
});


// --- Navbar Sticky y Mobile Menu ---
const navbar = document.getElementById('navbar');
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.getElementById('nav-links');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Cerrar menú móvil al hacer click en un enlace
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// --- FAQ Accordion ---
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Cerrar todos
        faqItems.forEach(otherItem => {
            otherItem.classList.remove('active');
            otherItem.querySelector('.faq-answer').style.maxHeight = null;
        });

        // Abrir el clickeado si no estaba activo
        if (!isActive) {
            item.classList.add('active');
            answer.style.maxHeight = answer.scrollHeight + "px";
        }
    });
});

// --- Chat Widget Logic ---
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatPanel = document.getElementById('chat-panel');
const chatClose = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSubmit = document.getElementById('chat-submit');
const heroCta = document.getElementById('hero-cta');

const N8N_WEBHOOK_URL = 'https://elkta.app.n8n.cloud/webhook/chat_landing';

// Generar o recuperar sessionId
let sessionId = localStorage.getItem('itera_sessionId');
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('itera_sessionId', sessionId);
}

// UI Toggles
function openChat() {
    chatPanel.classList.add('active');
    chatInput.focus();
    // Ocultar botón flotante temporalmente
    chatToggleBtn.style.transform = 'scale(0)';
    setTimeout(() => { chatToggleBtn.style.display = 'none'; }, 300);
}

chatToggleBtn.addEventListener('click', openChat);

if (heroCta) {
    heroCta.addEventListener('click', (e) => {
        e.preventDefault();
        openChat();
    });
}

chatClose.addEventListener('click', () => {
    chatPanel.classList.remove('active');
    chatToggleBtn.style.display = 'flex';
    setTimeout(() => { chatToggleBtn.style.transform = 'scale(1)'; }, 10);
});

// Scroll to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Añadir mensaje a la UI
function addMessage(text, sender, isError = false) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    if (isError) msgDiv.classList.add('error');
    
    // Parseo simple de saltos de línea a <br>
    msgDiv.innerHTML = text.replace(/\n/g, '<br>');
    
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

// Añadir indicador de escribiendo
function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.classList.add('typing-indicator');
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatMessages.appendChild(indicator);
    scrollToBottom();
}

// Remover indicador de escribiendo
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Manejar el envío
async function handleSend() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    // UI Updates
    chatInput.value = '';
    addMessage(messageText, 'user');
    addTypingIndicator();
    chatInput.disabled = true;
    chatSubmit.disabled = true;

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: messageText,
                sessionId: sessionId
            })
        });

        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }

        const data = await response.text();
        removeTypingIndicator();
        
        // Intentar parsear JSON, si no, usar texto plano
        try {
            const jsonData = JSON.parse(data);
            // Extraer respuesta del JSON asumiendo algunas estructuras comunes (reply, message, output)
            const botReply = jsonData.reply || jsonData.message || jsonData.output || (jsonData.length && jsonData[0].reply) || JSON.stringify(jsonData);
            addMessage(botReply, 'bot');
        } catch (e) {
            // Si no es JSON, es texto plano
            addMessage(data, 'bot');
        }

    } catch (error) {
        console.error('Error enviando mensaje al webhook:', error);
        removeTypingIndicator();
        addMessage('Lo siento, en este momento no puedo conectarme al servidor. Por favor, intenta de nuevo más tarde.', 'error', true);
    } finally {
        chatInput.disabled = false;
        chatSubmit.disabled = false;
        chatInput.focus();
    }
}

// Event Listeners para enviar
chatSubmit.addEventListener('click', handleSend);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});

// --- Tilt Effect for Hero Mockup ---
const mockupContainer = document.querySelector('.mockup-container');

if (mockupContainer) {
    mockupContainer.addEventListener('mousemove', (e) => {
        const { left, top, width, height } = mockupContainer.getBoundingClientRect();
        const x = (e.clientX - left) / width;
        const y = (e.clientY - top) / height;
        
        // Calculamos la rotación (multiplicamos por un factor de intensidad, ej. 20)
        // Inclinación hacia el puntero: 
        // Si el ratón está arriba (y < 0.5), rotateX debe ser negativo (o positivo dependiendo del eje)
        // Para que se incline HACIA el ratón:
        const tiltX = (y - 0.5) * -20; 
        const tiltY = (x - 0.5) * 20;
        
        mockupContainer.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.05)`;
    });

    mockupContainer.addEventListener('mouseleave', () => {
        // Volver a la posición inicial suavemente
        mockupContainer.style.transform = `perspective(1000px) rotateY(-5deg) rotateX(5deg) scale(1)`;
    });
}

// --- Three.js Advanced Neural Global Network & Logo Integration ---
const initThreeJS = () => {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.z = 600;

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // --- 1. GLOBO POLIGONAL (ESTRUCTURA DE INGENIERÍA) ---
    const globeGroup = new THREE.Group();
    mainGroup.add(globeGroup);

    const globeRadius = 200;
    
    // Geometría Icosaedro para un look poligonal/técnico
    const globeGeom = new THREE.IcosahedronGeometry(globeRadius, 2); 
    
    // Nodos (Vértices)
    const pointsMat = new THREE.PointsMaterial({
        color: 0x39FF14,
        size: 5, // Aumentado de 3 a 5
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    const globeNodes = new THREE.Points(globeGeom, pointsMat);
    globeGroup.add(globeNodes);

    // Malla de Conexiones (Vectores Poligonales)
    const wireframe = new THREE.WireframeGeometry(globeGeom);
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x39FF14, 
        transparent: true,
        opacity: 0.4, // Aumentado de 0.2 a 0.4
        blending: THREE.AdditiveBlending
    });
    const networkLines = new THREE.LineSegments(wireframe, lineMat);
    globeGroup.add(networkLines);

    // Partículas flotantes adicionales para atmósfera
    const extraParticlesCount = 600;
    const extraPos = new Float32Array(extraParticlesCount * 3);
    for(let i=0; i<extraParticlesCount*3; i++) extraPos[i] = (Math.random()-0.5) * 600;
    const extraGeom = new THREE.BufferGeometry();
    extraGeom.setAttribute('position', new THREE.BufferAttribute(extraPos, 3));
    const extraMat = new THREE.PointsMaterial({ color: 0x39FF14, size: 2, transparent: true, opacity: 0.5 });
    globeGroup.add(new THREE.Points(extraGeom, extraMat));

    // --- NÚCLEO INCANDESCENTE (MÁS BRILLO) ---
    const coreGeom = new THREE.SphereGeometry(globeRadius * 0.85, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0x39FF14,
        transparent: true,
        opacity: 0.1, // Aumentado
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide 
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    globeGroup.add(core);

    const coreGlowGeom = new THREE.SphereGeometry(globeRadius * 0.6, 32, 32);
    const coreGlowMat = new THREE.MeshBasicMaterial({
        color: 0x39FF14,
        transparent: true,
        opacity: 0.2, // Aumentado
        blending: THREE.AdditiveBlending
    });
    const coreGlow = new THREE.Mesh(coreGlowGeom, coreGlowMat);
    globeGroup.add(coreGlow);

    // --- 3. HUD FUTURISTA ---
    const hudGroup = new THREE.Group();
    globeGroup.add(hudGroup);

    const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(globeRadius + 30, 0.3, 16, 100),
        new THREE.MeshBasicMaterial({ color: 0x39FF14, transparent: true, opacity: 0.1 })
    );
    ring1.rotation.x = Math.PI / 2;
    hudGroup.add(ring1);

    // --- ANIMACIÓN Y SCROLL ---
    let targetScrollY = 0;
    let currentScrollY = 0;

    window.addEventListener('scroll', () => {
        targetScrollY = window.scrollY;
    });

    const animate = () => {
        requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        currentScrollY += (targetScrollY - currentScrollY) * 0.05;

        // Rotación ULTRA LENTA (Deriva espacial)
        globeGroup.rotation.y += 0.0005; 
        globeGroup.rotation.x += 0.0002;

        // Descenso cinematográfico
        mainGroup.position.y = -currentScrollY * 0.35;
        mainGroup.position.z = currentScrollY * 0.15;


        // Rotación HUD
        ring1.rotation.z += 0.002;

        // Animación de pulso del núcleo
        if (coreGlow) {
            const pulse = (Math.sin(time * 2) + 1) / 2;
            coreGlow.scale.setScalar(1 + pulse * 0.1);
            coreGlow.material.opacity = 0.1 + pulse * 0.15; // Rango más brillante
        }

        renderer.render(scene, camera);
    };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
};

// --- ROI Calculator Logic ---
const initCalculator = () => {
    const taskSelect = document.getElementById('task-select');
    const inputHours = document.getElementById('input-hours');
    const inputEmployees = document.getElementById('input-employees');
    const inputCost = document.getElementById('input-cost');
    const inputPercent = document.getElementById('input-percent');

    const valHours = document.getElementById('val-hours');
    const valEmployees = document.getElementById('val-employees');
    const valCost = document.getElementById('val-cost');
    const valPercent = document.getElementById('val-percent');

    const resultMonthly = document.getElementById('result-monthly');
    const resultAnnual = document.getElementById('result-annual');
    const resTime = document.getElementById('res-time');
    const resROI = document.getElementById('res-roi');

    const updateCalculator = () => {
        const hours = parseInt(inputHours.value);
        const employees = parseInt(inputEmployees.value);
        const cost = parseInt(inputCost.value);
        const percent = parseInt(inputPercent.value) / 100;

        // Actualizar etiquetas UI
        valHours.textContent = hours + 'h';
        valEmployees.textContent = employees;
        valCost.textContent = cost + '€';
        valPercent.textContent = (percent * 100).toFixed(0) + '%';

        // Cálculos
        const totalHoursWeek = hours * employees;
        const totalCostWeek = totalHoursWeek * cost;
        const totalCostMonth = totalCostWeek * 4.33; // Promedio semanas/mes
        const totalCostYear = totalCostMonth * 12;

        const savingsMonth = totalCostMonth * percent;
        const savingsYear = totalCostYear * percent;
        const timeRecovered = totalHoursWeek * 4.33 * percent;

        // ROI Estimado (Factor de eficiencia basado en el porcentaje automatizable)
        const estimatedROI = (percent * 100) * 1.5; 

        // Animar resultados
        animateValue(resultMonthly, savingsMonth, '€');
        animateValue(resultAnnual, savingsYear, '€');
        animateValue(resTime, timeRecovered, 'h');
        animateValue(resROI, estimatedROI, '%');
    };

    const animateValue = (element, end, suffix) => {
        const currentText = element.textContent.replace(/[^0-9]/g, '');
        const start = parseInt(currentText) || 0;
        const duration = 500;
        let startTime = null;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value.toLocaleString('es-ES') + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    };

    // Event listeners para los inputs
    [taskSelect, inputHours, inputEmployees, inputCost, inputPercent].forEach(input => {
        if (input) input.addEventListener('input', updateCalculator);
    });

    if (taskSelect) {
        taskSelect.addEventListener('change', () => {
            const selectedOption = taskSelect.options[taskSelect.selectedIndex];
            const newRate = selectedOption.getAttribute('data-rate');
            inputCost.value = newRate;
            updateCalculator();
        });
    }

    updateCalculator();
};

// --- Cookie Banner Logic ---
const initCookies = () => {
    const cookieBanner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('btn-cookies-accept');
    const rejectBtn = document.getElementById('btn-cookies-reject');

    if (!cookieBanner) return;

    const cookiePreference = localStorage.getItem('itera_cookies');

    if (!cookiePreference) {
        setTimeout(() => {
            cookieBanner.classList.add('active');
        }, 2000);
    }

    const setPreference = (pref) => {
        localStorage.setItem('itera_cookies', pref);
        cookieBanner.classList.remove('active');
    };

    if (acceptBtn) acceptBtn.addEventListener('click', () => setPreference('accepted'));
    if (rejectBtn) rejectBtn.addEventListener('click', () => setPreference('rejected'));
};

const CONTACT_WEBHOOK_URL = 'https://elkta.app.n8n.cloud/webhook-test/a25e00a4-4c02-47e3-9c49-b8e1255f0cae';

// --- Contact Form Logic ---
const initContactForm = () => {
    const contactForm = document.getElementById('contact-form');
    
    if (!contactForm) return;

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Recopilar datos del formulario
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());

        // Visual feedback
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Enviando...';

        try {
            const response = await fetch(CONTACT_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Error en el envío');

            // Éxito
            submitBtn.innerHTML = '¡Enviado con éxito!';
            submitBtn.style.background = '#10b981';
            submitBtn.style.borderColor = '#10b981';
            submitBtn.style.color = '#fff';
            contactForm.reset();

        } catch (error) {
            console.error('Error al enviar el formulario:', error);
            submitBtn.innerHTML = 'Error al enviar';
            submitBtn.style.background = '#ef4444';
            submitBtn.style.borderColor = '#ef4444';
            submitBtn.style.color = '#fff';
        } finally {
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.style.borderColor = '';
                submitBtn.style.color = '';
            }, 3000);
        }
    });
};

// --- Global Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Si initThreeJS no está definida aquí pero sí en otro sitio, se asume su existencia
    if (typeof initThreeJS === 'function') initThreeJS();
    initCalculator();
    initCookies();
    initContactForm();
});
