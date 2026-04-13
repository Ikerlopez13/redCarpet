import React from 'react';
import { useNavigate } from 'react-router-dom';

export const TermsOfService: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6 pt-16">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 md:p-10">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-6 text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                    ← Volver
                </button>

                <h1 className="text-3xl font-bold mb-6 text-gray-900">Términos del Servicio</h1>
                <p className="text-sm text-gray-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>

                <div className="space-y-6 text-gray-700 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">1. Aceptación de los Términos</h2>
                        <p>
                            Al acceder y utilizar RedCarpet, usted acepta estar sujeto a estos Términos del Servicio y a todas las leyes y regulaciones aplicables. Si no está de acuerdo con alguno de estos términos, tiene prohibido usar o acceder a este sitio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">2. Licencia de Uso</h2>
                        <p>
                            Se concede permiso para descargar temporalmente una copia de los materiales (información o software) en la aplicación de RedCarpet solo para visualización transitoria personal y no comercial. Esta es la concesión de una licencia, no una transferencia de título.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Renuncia</h2>
                        <p>
                            Los materiales en la aplicación de RedCarpet se proporcionan "tal cual". RedCarpet no ofrece garantías, expresas o implícitas, y por la presente renuncia y niega todas las demás garantías, incluidas, entre otras, las garantías implícitas o las condiciones de comerciabilidad, idoneidad para un propósito particular o no infracción de la propiedad intelectual u otra violación de derechos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">4. Limitaciones</h2>
                        <p>
                            En ningún caso RedCarpet o sus proveedores serán responsables de ningún daño (incluidos, entre otros, daños por pérdida de datos o ganancias, o debido a la interrupción del negocio) que surjan del uso o la imposibilidad de usar los materiales en RedCarpet.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">5. Servicios de Ubicación y Emergencia</h2>
                        <p>
                            Nuestros servicios incluyen funciones de seguridad y ubicación. Usted reconoce que estos servicios dependen de la conectividad de la red y del GPS, y no deben considerarse como un sustituto de los servicios de emergencia profesionales.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">6. Ley Gobernante</h2>
                        <p>
                            Estos términos y condiciones se rigen e interpretan de acuerdo con las leyes de España y usted se somete irrevocablemente a la jurisdicción exclusiva de los tribunales de dicho estado o ubicación.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-gray-900">7. Suscripciones y Pagos (Apple App Store)</h2>
                        <div className="space-y-4">
                            <p>
                                RedCarpet ofrece suscripciones premium auto-renovables ("RedCarpet Pro"). Al comprar una suscripción, el pago se cargará a su cuenta de ID de Apple en la confirmación de la compra.
                            </p>
                            <ul className="list-disc pl-5 mt-2 space-y-2">
                                <li>La suscripción se renueva automáticamente a menos que se cancele al menos 24 horas antes del final del período actual.</li>
                                <li>Se le cobrará a su cuenta la renovación dentro de las 24 horas previas al final del período actual, indicando el coste de la renovación.</li>
                                <li>Puede administrar y cancelar sus suscripciones yendo a la Configuración de su cuenta en la App Store después de la compra.</li>
                                <li>Cualquier porción no utilizada de un período de prueba gratuito, si se ofrece, se perderá cuando el usuario compre una suscripción a esa publicación, cuando corresponda.</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
