import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentShell } from "@/components/LegalDocumentShell";
import { getLegalContext } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getLegalContext();
  return {
    title: "Términos y Condiciones de Uso",
    description: `Términos y condiciones, política de cancelación, límites de reserva y aviso legal de ${ctx.businessName} en ${ctx.locality}.`,
    alternates: { canonical: "/terminos" },
  };
}

export default async function TerminosPage() {
  const ctx = await getLegalContext();
  const staffLower = ctx.staffLabel.toLowerCase();

  return (
    <LegalDocumentShell
      context={ctx}
      activeSlug="terminos"
      title="Términos y Condiciones de Uso"
      subtitle={`Reglas aplicables a la reserva de citas en línea, cancelaciones, uso aceptable y límites de responsabilidad de ${ctx.businessName}.`}
      summaryPoints={[
        `Puedes cancelar gratis hasta ${ctx.minCancelNoticeHours} horas antes del inicio de tu cita (o en cualquier momento sin penalización si el establecimiento reprogramó tu turno).`,
        `Se permiten hasta ${ctx.maxActiveBookings} reservas activas futuras simultáneamente, con anticipación máxima de ${ctx.bookingHorizonDays} días y margen previo de ${ctx.minLeadTimeMinutes} minutos.`,
        "Acumular 2 inasistencias activas injustificadas restringe temporalmente las reservas web hasta regularizar tu situación por WhatsApp.",
        ctx.isHealthDomain
          ? "Este portal es únicamente para citas programadas y NO atiende emergencias médicas ni urgencias vitales."
          : "Este portal gestiona citas programadas sujetas a disponibilidad y NO sustituye atención presencial de urgencia.",
      ]}
    >
      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          1. Identificación del Titular y Aceptación
        </h2>
        <p>
          El presente portal web de agenda y reservas en línea es operado por{" "}
          <strong>{ctx.businessName}</strong>, con domicilio de atención presencial en{" "}
          <strong>{ctx.addressText}</strong> y canal oficial de atención al cliente en{" "}
          <strong>{ctx.phoneWhatsapp}</strong>.
        </p>
        <p>
          Al acceder al sitio, crear una cuenta, iniciar sesión con Google o confirmar una cita,
          el usuario declara haber leído, comprendido y aceptado íntegramente estos Términos y
          Condiciones, junto con la{" "}
          <Link href="/privacidad" className="text-[#1F1F23] font-semibold underline">
            Política de Privacidad
          </Link>{" "}
          y la{" "}
          <Link href="/cookies" className="text-[#1F1F23] font-semibold underline">
            Política de Cookies
          </Link>
          . Si no está de acuerdo con alguno de los términos aquí establecidos, deberá abstenerse
          de utilizar la plataforma.
        </p>
      </section>

      <section
        id="emergencias"
        className="p-4 sm:p-5 rounded-2xl bg-red-50 border border-red-200 text-red-950 space-y-2 scroll-mt-6"
      >
        <h2 className="text-base font-bold text-red-900">
          2. Exclusión de Emergencias y Naturaleza Informativa
        </h2>
        {ctx.isHealthDomain ? (
          <p>
            <strong>ESTE SISTEMA NO ES UN SERVICIO DE EMERGENCIAS MÉDICAS U ODONTOLÓGICAS.</strong>{" "}
            Ante dolor agudo severo, hemorragia, traumatismo, dificultad respiratoria o cualquier
            urgencia vital, no utilices la agenda web: acude de inmediato al servicio de urgencias
            hospitalarias más cercano o contacta a los servicios médicos de emergencia de tu localidad.
          </p>
        ) : (
          <p>
            <strong>ESTE SISTEMA NO ATIENDE URGENCIAS INMEDIATAS NI EMERGENCIAS.</strong> Las citas
            reservadas corresponden exclusivamente a horarios programados sujetos a capacidad de agenda.
          </p>
        )}
        <p>
          La información sobre servicios, descripciones y duraciones mostradas en el portal es
          meramente referencial y{" "}
          <strong>
            {ctx.isHealthDomain
              ? "no constituye diagnóstico médico, asesoramiento clínico ni compromiso de resultado"
              : "no constituye evaluación técnica definitiva ni compromiso cerrado fuera del servicio listado"}
          </strong>{" "}
          sin una valoración profesional presencial previa.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          3. Reglas de Reserva, Capacidad y Veracidad de Datos
        </h2>
        <p>
          Para garantizar acceso equitativo a toda la comunidad de usuarios y evitar el acaparamiento
          de horarios disponibles, rigen las siguientes reglas operativas en el sistema:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Límite de reservas activas:</strong> cada cuenta puede mantener un máximo de{" "}
            <strong>{ctx.maxActiveBookings}</strong> citas futuras activas simultáneamente.
          </li>
          <li>
            <strong>Horizonte y margen previo:</strong> los turnos pueden solicitarse hasta con{" "}
            <strong>{ctx.bookingHorizonDays} días</strong> de anticipación y con un margen mínimo de{" "}
            <strong>{ctx.minLeadTimeMinutes} minutos</strong> antes de la hora de inicio (salvo
            reglas particulares publicadas por cada {staffLower}).
          </li>
          <li>
            <strong>Veracidad de identidad y contacto:</strong> el usuario se obliga a proporcionar
            nombre real, correo electrónico válido y un número telefónico/WhatsApp activo donde
            pueda recibir confirmaciones o avisos urgentes de reprogramación.
          </li>
          <li>
            <strong>Validación previa del establecimiento:</strong> nos reservamos el derecho de
            cancelar citas creadas con datos manifiestamente falsos, teléfonos inexistentes o
            patrones automatizados de reserva masiva.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          4. Tarifas, Precios Referenciales y Modificaciones en Atención
        </h2>
        <p>
          Los importes visibles en el catálogo están expresados en moneda{" "}
          <strong>
            {ctx.currencyCode} ({ctx.currencySymbol})
          </strong>{" "}
          y corresponden al costo base estimado del servicio estándar seleccionado. La plataforma no
          procesa cobros ni retenciones automáticas con tarjeta en línea salvo indicación expresa
          en el establecimiento.
        </p>
        <p>
          Si durante la atención presencial el {staffLower} verifica que se requieren insumos
          especiales, exámenes complementarios o procedimientos adicionales no incluidos en el turno
          básico, informará el presupuesto actualizado de forma clara para contar con tu
          autorización expresa antes de realizarlos.
        </p>
      </section>

      <section id="cancelaciones" className="space-y-2 scroll-mt-6">
        <h2 className="text-base font-bold text-[#1F1F23]">
          5. Política de Cancelaciones, Reprogramaciones e Inasistencias (No-Show)
        </h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Cancelación ordinaria sin penalización:</strong> puedes cancelar libremente
            desde la pestaña <em>Mis Citas</em> con al menos{" "}
            <strong>{ctx.minCancelNoticeHours} horas</strong> de anticipación respecto a la hora de
            tu cita.
          </li>
          <li>
            <strong>Cancelación fuera de plazo:</strong> cuando falten menos de{" "}
            {ctx.minCancelNoticeHours} horas, la cancelación directa desde la web queda bloqueada
            para proteger el tiempo reservado; deberás comunicarte directamente por WhatsApp al{" "}
            <strong>{ctx.phoneWhatsapp}</strong> para evaluar reprogramación o justificación.
          </li>
          <li>
            <strong>Excepción a favor del usuario por imprevisto del establecimiento:</strong> si{" "}
            {ctx.businessName} o tu {staffLower} necesita mover tu cita por imprevisto operativo o
            cierre puntual, podrás <strong>aceptar el nuevo horario o cancelar libremente sin
            penalización</strong> incluso dentro de las últimas {ctx.minCancelNoticeHours} horas.
          </li>
          <li>
            <strong>Impuntualidad y faltas injustificadas:</strong> te recomendamos presentarte al
            menos 10 minutos antes. La inasistencia sin aviso previo podrá registrarse como falta
            operativa. Al acumular <strong>2 faltas activas</strong>, la cuenta quedará restringida
            temporalmente para nuevas reservas en línea hasta regularizar o justificar la causa con
            administración vía WhatsApp.
          </li>
          <li>
            <strong>Fuerza mayor y cierres excepcionales:</strong> cortes eléctricos, emergencias
            sanitarias, disposiciones gubernamentales o imprevistos graves del personal podrán
            motivar el cierre o reprogramación de la jornada sin responsabilidad indemnizatoria,
            ofreciéndose prioridad de reagendamiento o cancelación sin cargo.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          6. Uso Aceptable y Conducta Prohibida
        </h2>
        <p>Queda estrictamente prohibido utilizar este portal para:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ejecutar bots, scripts automatizados, ataques de denegación o scraping de disponibilidad.</li>
          <li>Reservar turnos con identidad ajena o suplantar a terceras personas sin autorización.</li>
          <li>Intentar acceder sin autorización a rutas administrativas, cuentas de otros usuarios o APIs internas.</li>
          <li>Utilizar el campo de comentarios para publicar contenido ilícito, ofensivo o spam.</li>
        </ul>
        <p>
          El incumplimiento podrá conllevar la cancelación de las reservas implicadas y la
          suspensión inmediata de la cuenta, sin perjuicio de las acciones legales que correspondan.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          7. Propiedad Intelectual
        </h2>
        <p>
          El nombre comercial, logotipos, interfaz visual, textos, íconos y software de agenda son
          propiedad de {ctx.businessName} o de sus respectivos licenciantes, encontrándose
          protegidos por las normas de propiedad intelectual e industrial aplicables. Queda prohibida
          su copia, ingeniería inversa, redistribución o uso comercial sin autorización escrita.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          8. Limitación de Responsabilidad Técnica y Servicios de Terceros
        </h2>
        <p>
          El servicio digital se ofrece bajo criterio de mejor esfuerzo razonable (“tal cual” y
          “según disponibilidad”). {ctx.businessName} no será responsable por interrupciones
          temporales derivadas de mantenimiento programado, fallas en redes de telecomunicaciones,
          cortes de proveedores externos (incluyendo autenticación con Google, servicios de mapas o
          mensajería WhatsApp) o eventos de fuerza mayor, sin perjuicio de los derechos
          irrenunciables que asistan al consumidor conforme a la legislación imperativa aplicable.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          9. Modificaciones, Legislación Aplicable y Resolución de Conflictos
        </h2>
        <p>
          {ctx.businessName} podrá actualizar estos Términos y Condiciones cuando cambien sus
          políticas operativas o requisitos normativos, publicando siempre la versión vigente y su
          fecha de actualización en esta página. Las citas confirmadas previamente se respetarán en
          las condiciones informadas al momento de su confirmación.
        </p>
        <p>
          Este documento se rige por las leyes vigentes del <strong>{ctx.countryName}</strong> (incluyendo
          las disposiciones civiles, de telecomunicaciones y de defensa de los derechos de las
          usuarias y los usuarios y de las consumidoras y los consumidores aplicables). Ante
          cualquier divergencia, las partes procurarán primero una solución directa y amistosa a
          través del canal oficial del establecimiento, sometiéndose en su defecto a las
          autoridades competentes de <strong>{ctx.locality}</strong>.
        </p>
      </section>
    </LegalDocumentShell>
  );
}
