# WhatsApp Alerts Library for Google Apps Script

Biblioteca completa para enviar alertas por WhatsApp desde Google Apps Script. Soporta múltiples servicios, control de horarios, rate limiting y diferentes tipos de mensajes.

## Características

- 4 servicios de WhatsApp (CallMeBot, WhatsApp Business, Twilio, Custom)
- Control de horarios y días
- Rate limiting automático
- Reintentos con backoff
- Múltiples tipos de mensaje
- Emojis automáticos

## Instalación

1. Copia `script.js` a tu proyecto de Google Apps Script
2. Configura tu servicio preferido en `WHATSAPP_CONFIG`
3. ¡Empieza a enviar alertas!

## Uso rápido

```javascript
// Alerta simple
enviarAlertaRapida('Sistema iniciado correctamente');

// Error crítico
alertarError(new Error('Base de datos caída'), 'Módulo usuarios');

// Métricas
whatsapp.enviarMetricas('Ventas del día', {
  'Total': '$5,250',
  'Clientes': 12
});
