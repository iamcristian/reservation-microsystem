import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentShell } from "@/components/LegalDocumentShell";
import { getLegalContext } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getLegalContext();
  return {
    title: "Política de Privacidad y Protección de Datos",
    description: `Conoce cómo ${ctx.businessName} recopila, protege y utiliza tus datos personales para gestionar citas, avisos por WhatsApp y acceso con Google.`,
    alternates: { canonical: "/privacidad" },
  };
}

export default async function PrivacidadPage() {
  const ctx = await getLegalContext();

  return (
    <LegalDocumentShell
      context={ctx}
      activeSlug="privacidad"
      title="Política de Privacidad y Datos Personales"
      subtitle={`Transparencia sobre qué datos recolectamos, por qué los necesitamos para gestionar tus citas en ${ctx.businessName} y cómo puedes ejercer tus derechos.`}
      summaryPoints={[
        "Solo solicitamos los datos mínimos para reservar y avisarte de tu cita: nombre, correo electrónico, teléfono/WhatsApp y detalle de turno.",
        "Nunca vendemos, alquilamos ni compartimos tu información con anunciantes ni terceros comerciales.",
        "Si eliges iniciar sesión con Google, únicamente leemos tu nombre, correo e imagen pública para identificarte de forma segura.",
        "Puedes solicitar actualización, descarga o eliminación de tu cuenta escribiendo por nuestro canal oficial de WhatsApp.",
      ]}
    >
      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          1. Responsable del Tratamiento
        </h2>
        <p>
          El responsable del tratamiento de los datos personales recabados en este portal es{" "}
          <strong>{ctx.businessName}</strong>, ubicado en <strong>{ctx.addressText}</strong>, con
          línea de contacto y atención directa <strong>{ctx.phoneWhatsapp}</strong>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          2. Datos Personales que Recopilamos
        </h2>
        <p>Aplicamos el principio de minimización: únicamente solicitamos los datos necesarios para operar tu agenda:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Datos de identificación y acceso:</strong> nombre completo, correo electrónico,
            contraseña cifrada (si te registras manualmente) o identificador público y avatar (si
            eliges Google Sign-In).
          </li>
          <li>
            <strong>Datos de contacto:</strong> número de teléfono móvil / WhatsApp obligatorio
            para confirmaciones, coordinación operativa y avisos urgentes si surge un imprevisto en
            tu horario.
          </li>
          <li>
            <strong>Datos operativos de citas:</strong> servicio elegido, profesional asignado,
            fecha, hora, estado de asistencia (pendiente, atendida, cancelada o inasistencia) y
            comentario breve opcional ingresado por el propio usuario.
          </li>
          <li>
            <strong>Datos técnicos esenciales:</strong> registros temporales mínimos de seguridad y
            control de frecuencia de peticiones para prevenir ataques automatizados o reservas
            abusivas.
          </li>
        </ul>
        <p className="text-zinc-600">
          <strong>Importante:</strong> este portal de reservas no solicita ni almacena datos de
          tarjetas bancarias ni expedientes médicos completos en línea. Evita incluir diagnósticos
          sensibles extensos en el campo opcional de comentarios.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          3. Finalidad y Base Legítima del Tratamiento
        </h2>
        <p>Utilizamos tus datos exclusivamente para:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Gestionar la programación, visualización, confirmación y cancelación de tus citas.</li>
          <li>Notificarte cambios de horario o imprevistos del establecimiento (dentro del portal o mediante enlace directo a WhatsApp).</li>
          <li>Aplicar de forma transparente las reglas de control anti-inasistencias y límites de cupos descritos en nuestros{" "}
            <Link href="/terminos#cancelaciones" className="text-[#1F1F23] font-semibold underline">
              Términos y Condiciones
            </Link>.
          </li>
          <li>Autenticar tu identidad y evitar suplantaciones o accesos indebidos.</li>
        </ul>
        <p>
          La base jurídica es la ejecución de tu solicitud de reserva precontractual/contractual, el
          consentimiento expreso otorgado al registrarte o confirmar tu cita, y el interés legítimo
          en la seguridad e integridad de la plataforma.
        </p>
      </section>

      <section id="google-oauth" className="space-y-2 scroll-mt-6">
        <h2 className="text-base font-bold text-[#1F1F23]">
          4. Uso de Google Sign-In (OAuth 2.0) y Servicios Externos
        </h2>
        <p>
          Cuando utilizas el botón de inicio de sesión con Google, la aplicación solicita
          únicamente los permisos básicos de identidad (<code>openid</code>, <code>email</code> y{" "}
          <code>profile</code>). No accedemos a tus correos de Gmail, calendario personal,
          contactos ni archivos de Google Drive.
        </p>
        <p>
          Los datos recibidos de Google se utilizan exclusivamente para crear o vincular tu sesión
          en <strong>{ctx.businessName}</strong>. El uso de la información recibida de las APIs de
          Google cumple con la política de datos de usuario de Google API Services, incluidos los
          requisitos de uso limitado.
        </p>
        <p>
          Asimismo, al pulsar voluntariamente enlaces externos hacia <strong>WhatsApp</strong> (
          <code>wa.me</code>) o mapas de ubicación (<strong>OpenStreetMap / Google Maps</strong>),
          tu interacción pasa a regirse por las políticas de privacidad propias de dichos
          proveedores.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          5. Cesión a Terceros, Seguridad y Tiempo de Conservación
        </h2>
        <p>
          <strong>No vendemos ni comercializamos tus datos personales.</strong> Solo tienen acceso
          al detalle de cada cita los profesionales vinculados a tu atención y el personal
          administrativo autorizado de {ctx.businessName}.
        </p>
        <p>
          Implementamos medidas técnicas razonables de seguridad, incluyendo almacenamiento de
          contraseñas mediante hash criptográfico (<code>bcrypt</code>), cookies de sesión firmadas
          con banderas de protección (<code>HttpOnly</code>, <code>SameSite</code>), verificación de
          origen en mutaciones sensibles y control estricto de roles.
        </p>
        <p>
          Conservaremos tus datos mientras tu cuenta permanezca activa o durante el tiempo mínimo
          necesario para atender consultas, prevenir fraude y cumplir exigencias administrativas o
          legales vigentes.
        </p>
      </section>

      <section id="derechos" className="space-y-2 scroll-mt-6">
        <h2 className="text-base font-bold text-[#1F1F23]">
          6. Tus Derechos (Acceso, Rectificación, Cancelación y Oposición)
        </h2>
        <p>En cualquier momento tienes derecho a:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Acceder</strong> a los datos personales e historial vinculados a tu cuenta.</li>
          <li><strong>Rectificar o actualizar</strong> tu nombre o número telefónico/WhatsApp si son inexactos.</li>
          <li><strong>Solicitar la supresión o baja</strong> de tu cuenta una vez concluidas las citas pendientes o cuando no exista obligación legal de conservación.</li>
          <li><strong>Oponerte o retirar tu consentimiento</strong> respecto de usos no esenciales.</li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos, envía tu solicitud al contacto oficial de{" "}
          {ctx.businessName} (WhatsApp <strong>{ctx.phoneWhatsapp}</strong> o presencialmente en{" "}
          <strong>{ctx.addressText}</strong>) indicando tu nombre y el correo electrónico asociado
          para verificar tu titularidad.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          7. Protección de Menores de Edad
        </h2>
        <p>
          Este portal está dirigido a personas mayores de 18 años con capacidad legal para contratar
          y gestionar turnos. En caso de requerir atención para niñas, niños o adolescentes, la
          reserva deberá efectuarse bajo la cuenta, consentimiento y representación directa de su
          madre, padre o tutor legal.
        </p>
      </section>
    </LegalDocumentShell>
  );
}
