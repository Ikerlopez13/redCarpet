import React from 'react';
import { useNavigate } from 'react-router-dom';

interface PrivacyPolicyProps {
    onClose?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6 pt-16 font-display">
            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm p-6 md:p-10 mb-10">
                <button
                    onClick={() => onClose ? onClose() : navigate(-1)}
                    className="mb-6 text-primary hover:text-primary/80 font-bold flex items-center"
                >
                    <span className="material-symbols-outlined mr-1">arrow_back_ios_new</span>
                    Volver
                </button>

                <h1 className="text-3xl font-bold mb-2 text-gray-900">POLÍTICA DE PRIVACIDAD – REDCARPET</h1>
                <h2 className="text-xl font-semibold mb-6 text-gray-700">SISTEMA DE SEGURIDAD PERSONAL INTELIGENTE</h2>
                <p className="text-sm text-gray-500 mb-8 pb-6 border-b border-gray-100">Última actualización: {new Date().toLocaleDateString()}</p>

                <div className="space-y-8 text-gray-700 leading-relaxed">
                    <section>
                        <p className="mb-4">
                            En REDCARPET consideramos la privacidad y seguridad de nuestros usuarios como un derecho absoluto. Cada dato que compartes con nosotros es tratado con el máximo nivel de protección legal, técnica y ética, asegurando que tu información personal nunca esté en riesgo y siempre esté bajo tu control.
                        </p>
                        <p className="font-semibold mb-2">Nuestra aplicación cumple estrictamente y de manera verificable con todas las leyes y regulaciones relevantes, incluyendo:</p>
                        <ul className="list-disc pl-5 mb-4 space-y-1">
                            <li>Reglamento General de Protección de Datos (RGPD / GDPR) – Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo.</li>
                            <li>Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).</li>
                            <li>Normativa fiscal, mercantil y sectorial española aplicable.</li>
                            <li>Directrices y recomendaciones del Comité Europeo de Protección de Datos (EDPB).</li>
                            <li>Principios de la OCDE sobre privacidad y mejores prácticas internacionales en protección de datos.</li>
                            <li>Estándares ISO y EN de seguridad de la información y cifrado de datos.</li>
                            <li>Protocolos de Evaluación de Impacto en Protección de Datos (EIPD) para identificar, evaluar y mitigar riesgos.</li>
                            <li>Legislación sobre comercio electrónico, pagos y protección del consumidor, garantizando transparencia y seguridad en todas las transacciones.</li>
                        </ul>
                        <p className="font-semibold mb-2">En REDCARPET estamos comprometidos con tu tranquilidad y control absoluto sobre tus datos:</p>
                        <ul className="list-disc pl-5 mb-4 space-y-1">
                            <li><strong>Transparencia total:</strong> siempre sabrás qué datos recopilamos, cómo los usamos y con quién se comparten.</li>
                            <li><strong>Seguridad máxima:</strong> cifrado en tránsito y reposo, autenticación reforzada, auditorías periódicas y controles internos estrictos.</li>
                            <li><strong>Anonimización y minimización:</strong> los datos que compartimos con terceros son siempre agregados o anonimizados, salvo que tú decidas voluntariamente permitir un uso comercial explícito.</li>
                            <li><strong>Derechos del usuario garantizados:</strong> acceso, rectificación, supresión, oposición, limitación del tratamiento, portabilidad y retirada de consentimiento, en cualquier momento y sin complicaciones.</li>
                            <li><strong>Compromiso ético y profesional:</strong> ningún dato se utilizará para fines no autorizados, y todas nuestras prácticas son supervisadas y revisadas constantemente por expertos en privacidad y seguridad.</li>
                        </ul>
                        <p>
                            Nuestro objetivo es que cada usuario se sienta protegido, informado y seguro desde el primer momento. Al usar REDCARPET, no solo accedes a un sistema de seguridad inteligente, sino que también confías en una empresa que pone tu privacidad y bienestar en primer lugar, cumpliendo con todas las leyes y estándares más exigentes del mundo.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">1. Identidad del Responsable del Tratamiento</h3>
                        <p>
                            El responsable del tratamiento de los datos personales es REDCARPET, titular de la aplicación móvil destinada a la protección y seguridad preventiva de personas mediante tecnología avanzada de geolocalización inteligente.
                        </p>
                        <p className="mt-2">
                            REDCARPET garantiza la confidencialidad, integridad y seguridad de tus datos personales en todo momento, con el máximo nivel de diligencia jurídica y técnica.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">2. Marco Normativo Aplicable</h3>
                        <p>El tratamiento de datos personales se realiza conforme a:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo (GDPR).</li>
                            <li>Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).</li>
                            <li>Normativa fiscal, mercantil y sectorial española aplicable.</li>
                            <li>Directrices del Comité Europeo de Protección de Datos (EDPB).</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">3. Principios Rectores del Tratamiento</h3>
                        <p>REDCARPET trata los datos personales respetando los siguientes principios:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Licitud, lealtad y transparencia.</li>
                            <li>Limitación de la finalidad.</li>
                            <li>Minimización de datos.</li>
                            <li>Exactitud y actualización.</li>
                            <li>Limitación del plazo de conservación.</li>
                            <li>Integridad y confidencialidad.</li>
                            <li>Responsabilidad proactiva.</li>
                            <li>Privacidad desde el diseño y por defecto.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">4. Categorías de Datos Tratados</h3>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">4.1 Datos Identificativos</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Nombre y apellidos.</li>
                            <li>Dirección postal.</li>
                            <li>Correo electrónico.</li>
                            <li>Número de teléfono.</li>
                        </ul>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">4.2 Datos Técnicos</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Dirección IP.</li>
                            <li>Identificador único de usuario.</li>
                            <li>Identificadores de dispositivo.</li>
                            <li>Registros de acceso y actividad.</li>
                            <li>Metadatos técnicos necesarios para la seguridad del sistema.</li>
                        </ul>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">4.3 Datos de Localización y Movilidad</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Ubicación GPS en tiempo real.</li>
                            <li>Historial detallado de ubicaciones.</li>
                            <li>Frecuencia de visitas a ubicaciones.</li>
                            <li>Tiempo de permanencia en lugares.</li>
                            <li>Horarios habituales de movilidad.</li>
                            <li>Patrones de desplazamiento.</li>
                        </ul>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">4.4 Datos Económicos</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Datos de facturación.</li>
                            <li>Historial de pagos.</li>
                            <li>Información contable necesaria para cumplimiento legal.</li>
                        </ul>

                        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-lg text-sm border border-red-100 font-medium">
                            REDCARPET declara expresamente que no trata categorías especiales de datos personales incluidas en el artículo 9 del RGPD.
                        </div>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">5. Finalidades del Tratamiento</h3>
                        <p>Los datos personales se tratan con las siguientes finalidades legítimas y determinadas:</p>
                        <ol className="list-decimal pl-5 mt-2 space-y-1">
                            <li>Prestación del servicio principal de seguridad preventiva.</li>
                            <li>Activación del botón de emergencia con transmisión de ubicación precisa.</li>
                            <li>Cálculo y recomendación de rutas seguras.</li>
                            <li>Detección de desviaciones potencialmente peligrosas respecto a patrones habituales.</li>
                            <li>Identificación de zonas de riesgo.</li>
                            <li>Gestión de la cuenta de usuario.</li>
                            <li>Gestión contractual y facturación.</li>
                            <li>Cumplimiento de obligaciones legales.</li>
                            <li>Mejora del sistema mediante estadísticas de seguridad y análisis anonimizados, destinadas a garantizar la seguridad del usuario y optimizar la App.</li>
                            <li>Prevención del fraude y protección de la seguridad tecnológica.</li>
                            <li>Compartición segura de datos con terceros, siempre de forma anonimizada para estudios de mercado, análisis estadísticos y mejoras de servicio.</li>
                            <li>Uso comercial opcional con consentimiento explícito: si el usuario acepta voluntariamente, algunos datos personales podrán ser utilizados para fines comerciales o cedidos a terceros, siempre garantizando control total y posibilidad de retirar el consentimiento en cualquier momento, sin comprometer la identidad del usuario.</li>
                        </ol>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">6. Base Jurídica del Tratamiento</h3>
                        <p>El tratamiento se fundamenta en:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Ejecución del contrato de prestación de servicios (artículo 6.1.b RGPD).</li>
                            <li>Consentimiento explícito del usuario, solicitado antes de activar funciones de geolocalización y recopilación de datos sensibles, para mejorar la seguridad del usuario, generar estadísticas de protección y permitir uso comercial opcional, de manera transparente y segura (artículo 6.1.a RGPD).</li>
                            <li>Cumplimiento de obligaciones legales aplicables (artículo 6.1.c RGPD).</li>
                            <li>Interés legítimo en garantizar la seguridad tecnológica y prevención del fraude, debidamente ponderado.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">7. Plazos de Conservación</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Ubicación en tiempo real:</strong> mientras el servicio esté activado.</li>
                            <li><strong>Historial de ubicaciones:</strong> máximo 30 días.</li>
                            <li><strong>Patrones, frecuencia y rutinas:</strong> máximo 90 días.</li>
                            <li><strong>Datos identificativos:</strong> durante la relación contractual y hasta 3 años posteriores.</li>
                            <li><strong>Datos fiscales y contables:</strong> 6 años conforme normativa vigente.</li>
                            <li><strong>Logs técnicos y dirección IP:</strong> máximo 12 meses.</li>
                        </ul>
                        <p className="mt-3 font-medium">Finalizados los plazos, los datos serán eliminados o anonimizados de forma irreversible.</p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">8. Comunicación y Notificaciones</h3>
                        <p>
                            REDCARPET podrá enviarte notificaciones push y comunicaciones electrónicas relacionadas con la seguridad del servicio, alertas críticas y actualizaciones de la política. Puedes gestionar estas preferencias desde los ajustes de la App.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">9. Derechos del Usuario</h3>
                        <p>
                            Puedes ejercer tus derechos de acceso, rectificación, supresión y portabilidad enviando un correo a soporte@redcarpet.com. Nos comprometemos a responder en los plazos legales establecidos.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">10. Cambios en la Política</h3>
                        <p>
                            REDCARPET se reserva el derecho de modificar esta política para adaptarla a novedades legislativas. Te notificaremos cualquier cambio sustancial a través de la App.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};