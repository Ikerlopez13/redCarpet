import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface PrivacyPolicyProps {
    onClose?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6 pt-16 font-display">
            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm p-6 md:p-10 mb-10">
                <button
                    onClick={() => onClose ? onClose() : navigate(-1)}
                    className="mb-6 text-primary hover:text-primary/80 font-bold flex items-center"
                >
                    <span className="material-symbols-outlined mr-1">arrow_back_ios_new</span>
                    {t('privacy.back')}
                </button>

                <h1 className="text-3xl font-bold mb-2 text-gray-900">{t('privacy.title')}</h1>
                <h2 className="text-xl font-semibold mb-6 text-gray-700">{t('privacy.subtitle')}</h2>
                <p className="text-sm text-gray-500 mb-8 pb-6 border-b border-gray-100">{t('privacy.last_updated')}: {new Date().toLocaleDateString()}</p>

                <div className="space-y-8 text-gray-700 leading-relaxed">
                    <section>
                        <p className="mb-4">
                            {t('privacy.intro_p1')}
                        </p>
                        <p className="font-semibold mb-2">{t('privacy.intro_p2')}</p>
                        <ul className="list-disc pl-5 mb-4 space-y-1">
                            {(t('privacy.regulations_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                        <p className="font-semibold mb-2">{t('privacy.commitment_title')}</p>
                        <ul className="list-disc pl-5 mb-4 space-y-1">
                            {(t('privacy.commitments_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}><strong>{item.split(':')[0]}:</strong>{item.split(':')[1]}</li>
                            ))}
                        </ul>
                        <p>
                            {t('privacy.intro_footer')}
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section1_title')}</h3>
                        <p>{t('privacy.section1_content')}</p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section2_title')}</h3>
                        <p>{t('privacy.section2_content')}</p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section3_title')}</h3>
                        <p>{t('privacy.section3_content')}</p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section4_title')}</h3>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">{t('privacy.section4_1_title')}</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            {(t('privacy.section4_1_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">{t('privacy.section4_2_title')}</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            {(t('privacy.section4_2_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">{t('privacy.section4_3_title')}</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            {(t('privacy.section4_3_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>

                        <h4 className="font-semibold mt-4 mb-2 text-gray-800">{t('privacy.section4_4_title')}</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            {(t('privacy.section4_4_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>

                        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-lg text-sm border border-red-100 font-medium">
                            {t('privacy.section4_footer')}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section5_title')}</h3>
                        <p>{t('privacy.section5_content')}</p>
                        <ol className="list-decimal pl-5 mt-2 space-y-1">
                            {(t('privacy.section5_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ol>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section6_title')}</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            {(t('privacy.section6_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section7_title')}</h3>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            {(t('privacy.section7_list', { returnObjects: true }) as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                        <p className="mt-3 font-medium">{t('privacy.section7_footer')}</p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section8_title')}</h3>
                        <p>{t('privacy.section8_content')}</p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section9_title')}</h3>
                        <p>{t('privacy.section9_content')}</p>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold mb-3 text-gray-900">{t('privacy.section10_title')}</h3>
                        <p>{t('privacy.section10_content')}</p>
                    </section>
                </div>
            </div>
        </div>
    );
};