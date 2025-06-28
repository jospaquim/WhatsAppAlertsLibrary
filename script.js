/**
 * WhatsApp Alerts Library para Google Apps Script
 * 
 * Biblioteca completa para enviar alertas por WhatsApp desde cualquier proyecto
 * Soporta múltiples servicios, horarios, plantillas y más
 * 
 * @version 1.0.0
 */

/**
 * CONFIGURACIÓN GLOBAL
 */
const WHATSAPP_CONFIG = {
  // Servicios disponibles
  SERVICIO: 'CALLMEBOT', // CALLMEBOT | WHATSAPP_BUSINESS | TWILIO | WEBHOOK_CUSTOM
  
  // Configuración CallMeBot (Gratis)
  CALLMEBOT: {
    url: 'https://api.callmebot.com/whatsapp.php',
    phone: 'TU_NUMERO_AQUI', // +51987654321
    apikey: 'TU_API_KEY_AQUI'
  },
  
  // Configuración WhatsApp Business API
  WHATSAPP_BUSINESS: {
    url: 'https://graph.facebook.com/v17.0/TU_PHONE_ID/messages',
    token: 'TU_ACCESS_TOKEN',
    phone: 'TU_NUMERO_AQUI'
  },
  
  // Configuración Twilio
  TWILIO: {
    accountSid: 'TU_ACCOUNT_SID',
    authToken: 'TU_AUTH_TOKEN',
    from: 'whatsapp:+14155238886',
    to: 'whatsapp:+51987654321'
  },
  
  // Webhook personalizado
  WEBHOOK_CUSTOM: {
    url: 'TU_WEBHOOK_URL',
    headers: { 'Authorization': 'Bearer TU_TOKEN' }
  },
  
  // Configuración de horarios
  HORARIOS: {
    laboral: { inicio: 8, fin: 18 },
    extendido: { inicio: 7, fin: 22 },
    full: { inicio: 0, fin: 23 },
    personalizado: { inicio: 9, fin: 17, dias: [1, 2, 3, 4, 5] } // Lun-Vie
  },
  
  // Configuración de rate limiting
  RATE_LIMIT: {
    max_por_hora: 50,
    max_por_dia: 200,
    delay_entre_mensajes: 2000 // 2 segundos
  },
  
  // Zona horaria
  TIMEZONE: 'America/Lima',
  
  // Configuración de reintentos
  REINTENTOS: {
    max: 3,
    delay: 5000, // 5 segundos
    backoff: true // Incrementar delay en cada reintento
  }
};

/**
 * 📱 CLASE PRINCIPAL WhatsAppAlertas
 */
class WhatsAppAlertas {
  constructor(config = WHATSAPP_CONFIG) {
    this.config = config;
    this.ultimoEnvio = 0;
    this.contadorHoy = this.obtenerContadorHoy();
  }
  
  /**
   * 🚨 Envía alerta simple
   */
  enviarAlerta(mensaje, prioridad = 'NORMAL') {
    return this.enviarMensaje(mensaje, {
      prioridad: prioridad,
      emoji: this.obtenerEmojiPrioridad(prioridad),
      timestamp: true
    });
  }
  
  /**
   * 📊 Envía reporte con formato
   */
  enviarReporte(titulo, datos, opciones = {}) {
    const mensaje = this.formatearReporte(titulo, datos, opciones);
    return this.enviarMensaje(mensaje, { ...opciones, tipo: 'REPORTE' });
  }
  
  /**
   * ⚠️ Envía alerta de error crítico
   */
  enviarErrorCritico(error, contexto = '') {
    const mensaje = `🚨 *ERROR CRÍTICO*
${contexto ? `📍 *Contexto:* ${contexto}` : ''}
❌ *Error:* ${error.message || error}
⏰ *Timestamp:* ${new Date().toLocaleString('es-PE')}
🆔 *ID:* ${this.generarId()}

⚠️ Requiere atención inmediata`;

    return this.enviarMensaje(mensaje, { 
      prioridad: 'CRITICA',
      forzar_horario: true 
    });
  }
  
  /**
   * 📈 Envía métricas/estadísticas
   */
  enviarMetricas(titulo, metricas, comparacion = null) {
    let mensaje = `📊 *${titulo}*\n📅 ${new Date().toLocaleDateString('es-PE')}\n\n`;
    
    // Métricas principales
    Object.entries(metricas).forEach(([key, value]) => {
      const emoji = this.obtenerEmojiMetrica(key);
      mensaje += `${emoji} *${key}:* ${value}\n`;
    });
    
    // Comparación con período anterior
    if (comparacion) {
      mensaje += '\n📈 *Comparación:*\n';
      Object.entries(comparacion).forEach(([key, value]) => {
        const tendencia = value > 0 ? '📈' : (value < 0 ? '📉' : '➡️');
        mensaje += `${tendencia} ${key}: ${value > 0 ? '+' : ''}${value}\n`;
      });
    }
    
    return this.enviarMensaje(mensaje, { tipo: 'METRICAS' });
  }
  
  /**
   * 🔔 Envía recordatorio
   */
  enviarRecordatorio(titulo, descripcion, fechaVencimiento = null) {
    let mensaje = `🔔 *RECORDATORIO*\n📋 *${titulo}*\n\n${descripcion}`;
    
    if (fechaVencimiento) {
      const diasRestantes = Math.ceil((new Date(fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24));
      mensaje += `\n⏰ *Vence en:* ${diasRestantes} días`;
    }
    
    return this.enviarMensaje(mensaje, { tipo: 'RECORDATORIO' });
  }
  
  /**
   * 🏃‍♂️ Envía notificación de proceso completado
   */
  enviarProcesoCompletado(proceso, duracion, resultado = null) {
    let mensaje = `✅ *PROCESO COMPLETADO*
🔄 *Proceso:* ${proceso}
⏱️ *Duración:* ${duracion}
⏰ *Finalizado:* ${new Date().toLocaleTimeString('es-PE')}`;

    if (resultado) {
      mensaje += `\n📊 *Resultado:* ${resultado}`;
    }
    
    return this.enviarMensaje(mensaje, { tipo: 'PROCESO' });
  }
  
  /**
   * 📅 Envía resumen diario programado
   */
  enviarResumenDiario(datos, configuracion = {}) {
    const { incluirGraficos = false, incluirTendencias = true } = configuracion;
    
    let mensaje = `📅 *RESUMEN DIARIO*
📆 ${new Date().toLocaleDateString('es-PE', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n\n`;
    
    // Agregar datos principales
    if (datos.metricas) {
      mensaje += '📊 *Métricas del día:*\n';
      Object.entries(datos.metricas).forEach(([key, value]) => {
        mensaje += `• ${key}: ${value}\n`;
      });
      mensaje += '\n';
    }
    
    // Agregar eventos importantes
    if (datos.eventos && datos.eventos.length > 0) {
      mensaje += '🎯 *Eventos importantes:*\n';
      datos.eventos.forEach(evento => {
        mensaje += `• ${evento}\n`;
      });
      mensaje += '\n';
    }
    
    // Agregar alertas del día
    if (datos.alertas && datos.alertas.length > 0) {
      mensaje += '⚠️ *Alertas del día:*\n';
      datos.alertas.forEach(alerta => {
        mensaje += `• ${alerta}\n`;
      });
    }
    
    return this.enviarMensaje(mensaje, { tipo: 'RESUMEN_DIARIO' });
  }
  
  /**
   * 🚀 FUNCIÓN PRINCIPAL DE ENVÍO
   */
  async enviarMensaje(mensaje, opciones = {}) {
    const config = { ...this.config, ...opciones };
    
    try {
      // Validaciones previas
      if (!this.validarMensaje(mensaje)) {
        throw new Error('Mensaje inválido');
      }
      
      if (!this.verificarHorario(config)) {
        console.log('🔕 Fuera del horario permitido');
        return { success: false, motivo: 'FUERA_DE_HORARIO' };
      }
      
      if (!this.verificarRateLimit(config)) {
        console.log('⏸️ Rate limit excedido');
        return { success: false, motivo: 'RATE_LIMIT' };
      }
      
      // Formatear mensaje final
      const mensajeFinal = this.formatearMensaje(mensaje, config);
      
      // Enviar según el servicio configurado
      let resultado;
      switch (config.SERVICIO || this.config.SERVICIO) {
        case 'CALLMEBOT':
          resultado = await this.enviarPorCallMeBot(mensajeFinal);
          break;
        case 'WHATSAPP_BUSINESS':
          resultado = await this.enviarPorWhatsAppBusiness(mensajeFinal);
          break;
        case 'TWILIO':
          resultado = await this.enviarPorTwilio(mensajeFinal);
          break;
        case 'WEBHOOK_CUSTOM':
          resultado = await this.enviarPorWebhookCustom(mensajeFinal);
          break;
        default:
          throw new Error(`Servicio no soportado: ${config.SERVICIO}`);
      }
      
      // Actualizar contadores
      this.actualizarContadores();
      
      return resultado;
      
    } catch (error) {
      console.error(`❌ Error enviando WhatsApp: ${error.message}`);
      
      // Reintentar si está configurado
      if (config.reintentar !== false && config.REINTENTOS?.max > 0) {
        return this.reintentarEnvio(mensaje, opciones, 1);
      }
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 🔄 SERVICIOS DE ENVÍO
   */
  
  async enviarPorCallMeBot(mensaje) {
    const config = this.config.CALLMEBOT;
    const url = `${config.url}?phone=${encodeURIComponent(config.phone)}&text=${encodeURIComponent(mensaje)}&apikey=${config.apikey}`;
    
    const respuesta = await UrlFetchApp.fetch(url, {
      method: 'GET',
      muteHttpExceptions: true
    });
    
    const success = respuesta.getResponseCode() === 200;
    console.log(`📱 CallMeBot: ${respuesta.getResponseCode()}`);
    
    return { success, codigo: respuesta.getResponseCode(), respuesta: respuesta.getContentText() };
  }
  
  async enviarPorWhatsAppBusiness(mensaje) {
    const config = this.config.WHATSAPP_BUSINESS;
    const payload = {
      messaging_product: "whatsapp",
      to: config.phone,
      type: "text",
      text: { body: mensaje }
    };
    
    const respuesta = await UrlFetchApp.fetch(config.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const success = respuesta.getResponseCode() === 200;
    console.log(`📱 WhatsApp Business: ${respuesta.getResponseCode()}`);
    
    return { success, codigo: respuesta.getResponseCode(), respuesta: respuesta.getContentText() };
  }
  
  async enviarPorTwilio(mensaje) {
    const config = this.config.TWILIO;
    const credentials = Utilities.base64Encode(`${config.accountSid}:${config.authToken}`);
    
    const payload = {
      From: config.from,
      To: config.to,
      Body: mensaje
    };
    
    const respuesta = await UrlFetchApp.fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: Object.keys(payload).map(key => `${key}=${encodeURIComponent(payload[key])}`).join('&'),
      muteHttpExceptions: true
    });
    
    const success = respuesta.getResponseCode() === 201;
    console.log(`📱 Twilio: ${respuesta.getResponseCode()}`);
    
    return { success, codigo: respuesta.getResponseCode(), respuesta: respuesta.getContentText() };
  }
  
  async enviarPorWebhookCustom(mensaje) {
    const config = this.config.WEBHOOK_CUSTOM;
    const payload = {
      message: mensaje,
      timestamp: new Date().toISOString(),
      source: 'google-apps-script'
    };
    
    const respuesta = await UrlFetchApp.fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const success = respuesta.getResponseCode() >= 200 && respuesta.getResponseCode() < 300;
    console.log(`📱 Webhook Custom: ${respuesta.getResponseCode()}`);
    
    return { success, codigo: respuesta.getResponseCode(), respuesta: respuesta.getContentText() };
  }
  
  /**
   * 🔄 FUNCIONES DE SOPORTE
   */
  
  validarMensaje(mensaje) {
    if (!mensaje || typeof mensaje !== 'string') return false;
    if (mensaje.length > 4096) return false; // Límite WhatsApp
    return true;
  }
  
  verificarHorario(config) {
    if (config.forzar_horario) return true;
    
    const ahora = new Date();
    const hora = ahora.getHours();
    const dia = ahora.getDay(); // 0 = Domingo
    
    const horario = config.horario || this.config.HORARIOS.laboral;
    
    // Verificar hora
    if (hora < horario.inicio || hora > horario.fin) {
      return false;
    }
    
    // Verificar día de la semana si está especificado
    if (horario.dias && !horario.dias.includes(dia)) {
      return false;
    }
    
    return true;
  }
  
  verificarRateLimit(config) {
    const ahora = Date.now();
    
    // Verificar delay entre mensajes
    if (ahora - this.ultimoEnvio < this.config.RATE_LIMIT.delay_entre_mensajes) {
      return false;
    }
    
    // Verificar límite diario (implementar según necesidades)
    if (this.contadorHoy >= this.config.RATE_LIMIT.max_por_dia) {
      return false;
    }
    
    return true;
  }
  
  formatearMensaje(mensaje, config) {
    let mensajeFinal = mensaje;
    
    // Agregar emoji de prioridad
    if (config.emoji) {
      mensajeFinal = `${config.emoji} ${mensajeFinal}`;
    }
    
    // Agregar timestamp si está solicitado
    if (config.timestamp) {
      mensajeFinal += `\n\n⏰ ${new Date().toLocaleString('es-PE')}`;
    }
    
    // Agregar ID único si está solicitado
    if (config.incluir_id) {
      mensajeFinal += `\n🆔 ${this.generarId()}`;
    }
    
    return mensajeFinal;
  }
  
  formatearReporte(titulo, datos, opciones = {}) {
    const { incluirTotales = true, incluirPorcentajes = false } = opciones;
    
    let mensaje = `📊 *${titulo}*\n📅 ${new Date().toLocaleDateString('es-PE')}\n\n`;
    
    if (Array.isArray(datos)) {
      datos.forEach((item, index) => {
        mensaje += `${index + 1}. ${item}\n`;
      });
    } else if (typeof datos === 'object') {
      Object.entries(datos).forEach(([key, value]) => {
        const emoji = this.obtenerEmojiMetrica(key);
        mensaje += `${emoji} *${key}:* ${value}\n`;
      });
    }
    
    return mensaje;
  }
  
  obtenerEmojiPrioridad(prioridad) {
    const emojis = {
      'BAJA': '🔵',
      'NORMAL': '🟡',
      'ALTA': '🟠',
      'CRITICA': '🔴',
      'URGENTE': '⚠️'
    };
    return emojis[prioridad] || '📱';
  }
  
  obtenerEmojiMetrica(clave) {
    const emojis = {
      'total': '📊',
      'exitosos': '✅',
      'exitoso': '✅',
      'fallidos': '❌',
      'fallido': '❌',
      'pendientes': '⏳',
      'pendiente': '⏳',
      'errores': '💥',
      'error': '💥',
      'usuarios': '👥',
      'ventas': '💰',
      'ingresos': '💵',
      'tiempo': '⏱️',
      'velocidad': '🚀',
      'memoria': '🧠',
      'cpu': '⚙️',
      'disco': '💾'
    };
    
    const claveMinuscula = clave.toLowerCase();
    return emojis[claveMinuscula] || '📈';
  }
  
  generarId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  
  obtenerContadorHoy() {
    // Implementar persistencia según necesidades (PropertiesService, etc.)
    return 0;
  }
  
  actualizarContadores() {
    this.ultimoEnvio = Date.now();
    this.contadorHoy++;
    // Persistir contadores si es necesario
  }
  
  async reintentarEnvio(mensaje, opciones, intento) {
    if (intento > this.config.REINTENTOS.max) {
      return { success: false, motivo: 'MAX_REINTENTOS_EXCEDIDO' };
    }
    
    const delay = this.config.REINTENTOS.delay * (this.config.REINTENTOS.backoff ? intento : 1);
    console.log(`🔄 Reintento ${intento} en ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      return await this.enviarMensaje(mensaje, { ...opciones, reintentar: false });
    } catch (error) {
      return this.reintentarEnvio(mensaje, opciones, intento + 1);
    }
  }
}

/**
 * 🚀 FUNCIONES DE UTILIDAD RÁPIDA
 */

// Instancia global para uso rápido
const whatsapp = new WhatsAppAlertas();

/**
 * Función rápida para alertas simples
 */
function enviarAlertaRapida(mensaje) {
  return whatsapp.enviarAlerta(mensaje);
}

/**
 * Función rápida para errores críticos
 */
function alertarError(error, contexto = '') {
  return whatsapp.enviarErrorCritico(error, contexto);
}

/**
 * Función rápida para métricas
 */
function enviarMetricasRapidas(titulo, metricas) {
  return whatsapp.enviarMetricas(titulo, metricas);
}

/**
 * 🧪 FUNCIONES DE PRUEBA
 */

function probarWhatsApp() {
  const mensaje = `🧪 *Test WhatsApp Library*
📱 Biblioteca funcionando correctamente
⏰ ${new Date().toLocaleString('es-PE')}
🆔 ${Math.random().toString(36).substr(2, 9)}

✅ Sistema operativo`;

  return whatsapp.enviarMensaje(mensaje, { 
    prioridad: 'NORMAL',
    timestamp: false // Ya incluido manualmente
  });
}

function probarTodosLosFormatos() {
  const pruebas = [
    () => whatsapp.enviarAlerta('Prueba de alerta simple'),
    () => whatsapp.enviarErrorCritico(new Error('Error de prueba'), 'Contexto de prueba'),
    () => whatsapp.enviarMetricas('Métricas de Prueba', { 
      total: 100, 
      exitosos: 85, 
      fallidos: 15 
    }),
    () => whatsapp.enviarReporte('Reporte de Prueba', {
      'Usuarios activos': 250,
      'Nuevos registros': 45,
      'Errores detectados': 3
    }),
    () => whatsapp.enviarProcesoCompletado('Backup diario', '45 minutos', 'Exitoso'),
    () => whatsapp.enviarRecordatorio('Reunión semanal', 'Revisar métricas del proyecto', '2024-07-01')
  ];
  
  console.log('🧪 Ejecutando todas las pruebas...');
  
  pruebas.forEach((prueba, index) => {
    setTimeout(() => {
      console.log(`Ejecutando prueba ${index + 1}...`);
      prueba();
    }, index * 3000); // 3 segundos entre cada prueba
  });
}

/**
 * 📚 EJEMPLOS DE USO
 * 
 * // Uso básico
 * enviarAlertaRapida('Sistema iniciado correctamente');
 * 
 * // Error crítico
 * alertarError(new Error('Base de datos no responde'), 'Modulo de usuarios');
 * 
 * // Métricas personalizadas
 * whatsapp.enviarMetricas('Ventas del día', {
 *   'Total vendido': '$5,250',
 *   'Nuevos clientes': 12,
 *   'Productos más vendidos': 'Laptop HP'
 * });
 * 
 * // Reporte diario
 * whatsapp.enviarResumenDiario({
 *   metricas: { emails: 150, exitosos: 145, fallidos: 5 },
 *   eventos: ['Backup completado', 'Actualización instalada'],
 *   alertas: ['Disco al 85% de capacidad']
 * });
 * 
 * // Configuración personalizada
 * const whatsappPersonalizado = new WhatsAppAlertas({
 *   ...WHATSAPP_CONFIG,
 *   SERVICIO: 'TWILIO',
 *   HORARIOS: { inicio: 9, fin: 17, dias: [1,2,3,4,5] }
 * });
 */
