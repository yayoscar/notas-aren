-- Seed WhatsApp message templates for client birthdays
INSERT INTO configuracion (key, value) VALUES (
  'felicitacion_cumple_whatsapp',
  '¡Feliz cumpleaños, {nombre}! 🎂 En Notas de Aren queremos desearte un día lleno de momentos especiales. Te esperamos para consentirte con tu fragancia favorita. ✨'
) ON CONFLICT (key) DO NOTHING;

INSERT INTO configuracion (key, value) VALUES (
  'invitacion_cumple_whatsapp',
  'Hola {nombre}, se acerca tu cumpleaños y en Notas de Aren queremos celebrarlo contigo. Ven a consentirte con un detalle especial durante tu mes de cumpleaños. 🎁🌸'
) ON CONFLICT (key) DO NOTHING;
