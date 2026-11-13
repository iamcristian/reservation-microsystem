import type { Metadata } from "next";
import { LegalDocumentShell } from "@/components/LegalDocumentShell";
import { getLegalContext } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getLegalContext();
  return {
    title: "Política de Cookies",
    description: `Detalle transparente de las cookies técnicas esenciales utilizadas por el sistema de reservas de ${ctx.businessName}.`,
    alternates: { canonical: "/cookies" },
  };
}

export default async function CookiesPage() {
  const ctx = await getLegalContext();

  return (
    <LegalDocumentShell
      context={ctx}
      activeSlug="cookies"
      title="Política de Cookies y Almacenamiento Local"
      subtitle={`Uso estricto y transparente de cookies técnicas indispensables para tu sesión y seguridad en ${ctx.businessName}.`}
      summaryPoints={[
        "Utilizamos únicamente cookies técnicas y de seguridad estrictamente necesarias para iniciar sesión y proteger tus reservas.",
        "NO utilizamos cookies de publicidad, rastreadores de terceros, píxeles de redes sociales ni perfiles comerciales.",
        "Las cookies de sesión son HttpOnly (inaccesibles desde scripts de JavaScript) y están firmadas criptográficamente.",
      ]}
    >
      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          1. ¿Qué son las cookies y por qué las usamos?
        </h2>
        <p>
          Las cookies son pequeños archivos de texto que tu navegador guarda temporalmente para
          recordar tu sesión autenticada y proteger formularios frente a accesos no autorizados. En{" "}
          <strong>{ctx.businessName}</strong> solo empleamos cookies técnicas indispensables para
          prestar el servicio de reservas solicitado por el propio usuario, por lo que no requieren
          consentimiento publicitario previo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#1F1F23]">
          2. Inventario de Cookies Técnicas Activas
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-700">
                <th className="py-2.5 px-3 font-bold">Nombre</th>
                <th className="py-2.5 px-3 font-bold">Tipo</th>
                <th className="py-2.5 px-3 font-bold">Finalidad</th>
                <th className="py-2.5 px-3 font-bold">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-600">
              <tr>
                <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900">
                  reserva_session
                </td>
                <td className="py-2.5 px-3">Esencial / Seguridad</td>
                <td className="py-2.5 px-3">
                  Mantiene iniciada tu sesión firmada (<code>HttpOnly</code>, <code>SameSite=Lax</code>) para consultar y cancelar tus citas.
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">Hasta 30 días o al salir</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900">
                  reserva_oauth_state
                </td>
                <td className="py-2.5 px-3">Esencial / Anti-CSRF</td>
                <td className="py-2.5 px-3">
                  Protege el intercambio OAuth 2.0 cuando inicias sesión con Google, verificando el retorno legítimo.
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">Unos minutos</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900">
                  reserva_impersonator
                </td>
                <td className="py-2.5 px-3">Esencial / Interno</td>
                <td className="py-2.5 px-3">
                  Utilizada exclusivamente por administradores autorizados para vista previa segura de agendas internas.
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">Solo sesión administrativa</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          3. Ausencia de Cookies Publicitarias y Analítica Invasiva
        </h2>
        <p>
          Esta aplicación <strong>no instala cookies de seguimiento publicitario</strong> (como
          Google Ads, Meta Pixel ni redes de retargeting) ni vende historial de navegación a
          terceros. Asimismo, la aplicación web progresiva (PWA) puede emplear caché local técnica
          del navegador únicamente para acelerar la carga visual de recursos estáticos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-[#1F1F23]">
          4. Cómo Gestionar o Desactivar Cookies en tu Navegador
        </h2>
        <p>
          Puedes consultar, bloquear o eliminar cookies en cualquier momento desde la
          configuración de privacidad de tu navegador (Chrome, Safari, Firefox o Edge). Ten en
          cuenta que, al tratarse de cookies técnicas estrictamente necesarias, bloquearlas impedirá
          mantener tu sesión iniciada, iniciar sesión con Google o gestionar reservas activas en{" "}
          {ctx.businessName}.
        </p>
      </section>
    </LegalDocumentShell>
  );
}
